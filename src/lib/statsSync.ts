// ─────────────────────────────────────────────────────────────────────────────
// Live stats sync — aggregates tournament stats from api-football and writes
// them into Supabase. Triggered on a schedule by /api/cron/sync-stats.
//
// What it does, each run:
//   1. Pull every finished WC fixture's per-player stats (/fixtures/players)
//      and sum them per player across the whole tournament.
//   2. Match each api-football player to a DB roster row — by stored
//      api_player_id when known, else by name within the team (26 players,
//      so this is reliable). On match, backfill api_player_id so the next
//      run is exact.
//   3. Write the aggregated PlayerStats into players.stats.
//   4. Aggregate team-level stats (possession, corners, …) and write
//      team_stats — so /api/worldcup reads the DB instead of hammering the API.
//
// Server-only: uses the Supabase service-role key (writes bypass RLS).
// Safe to run repeatedly; everything is upsert/idempotent. Returns 0s
// gracefully when there are no finished fixtures yet (pre-tournament).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient } from "@supabase/supabase-js";

import {
  getFinishedLeagueFixtures,
  getFixturePlayers,
  WC_LEAGUE_ID,
} from "@/lib/apiFootball";
import { findLocalTeam } from "@/lib/resolver";
import { aggregateWorldCupTeamStats } from "@/lib/teamFixtureStats";
import { ZERO_STATS, type PlayerStats } from "@/lib/squads";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SyncSummary = {
  ok: boolean;
  fixtures: number;
  playersSet: number;
  playersUnmatched: number;
  teamsSet: number;
  note: string;
};

// Per-player accumulator: a PlayerStats plus the internal running totals
// needed to finalize the two derived fields (passAccuracy, rating).
type Acc = PlayerStats & {
  _teamCode: string;
  _name: string;
  _accuratePasses: number;
  _ratingSum: number;
  _ratingCount: number;
};

function freshAcc(teamCode: string, name: string): Acc {
  return {
    ...ZERO_STATS,
    _teamCode: teamCode,
    _name: name,
    _accuratePasses: 0,
    _ratingSum: 0,
    _ratingCount: 0,
  };
}

const n = (v: number | null | undefined) => v ?? 0;

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Sum one fixture's stat line for a player into their accumulator. */
function accumulate(acc: Acc, st: NonNullable<ReturnType<typeof firstStat>>) {
  const minutes = n(st.games.minutes);
  if (minutes > 0) {
    acc.appearances += 1;
    if (!st.games.substitute) acc.started += 1;
  }
  acc.minutesPlayed  += minutes;
  acc.goals          += n(st.goals.total);
  acc.assists        += n(st.goals.assists);
  acc.shots          += n(st.shots.total);
  acc.shotsOnTarget  += n(st.shots.on);
  acc.keyPasses      += n(st.passes.key);
  acc.passes         += n(st.passes.total);
  acc.dribbles       += n(st.dribbles.success);
  acc.dribbleAttempts+= n(st.dribbles.attempts);
  acc.tackles        += n(st.tackles.total);
  acc.interceptions  += n(st.tackles.interceptions);
  acc.duelsWon       += n(st.duels.won);
  acc.duelsTotal     += n(st.duels.total);
  acc.foulsCommitted += n(st.fouls.committed);
  acc.foulsDrawn     += n(st.fouls.drawn);
  acc.offsides       += n(st.offsides);
  acc.penaltyScored  += n(st.penalty?.scored);
  acc.penaltyMissed  += n(st.penalty?.missed);
  acc.penaltyWon     += n(st.penalty?.won);
  acc.penaltySaved   += n(st.penalty?.saved);
  acc.yellowCards    += n(st.cards.yellow);
  acc.redCards       += n(st.cards.red);
  acc.saves          += n(st.goals.saves);
  acc.goalsConceded  += n(st.goals.conceded);

  // Clean sheet: a keeper who played and conceded nothing this match.
  const pos = (st.games.position ?? "").toUpperCase();
  if (minutes > 0 && pos.startsWith("G") && n(st.goals.conceded) === 0) {
    acc.cleanSheets += 1;
  }

  // accurate passes (count, not %) for a proper weighted accuracy later
  const accurate =
    typeof st.passes.accuracy === "string"
      ? parseInt(st.passes.accuracy, 10) || 0
      : n(st.passes.accuracy as number | null);
  acc._accuratePasses += accurate;

  const rating = st.games.rating ? parseFloat(st.games.rating) : NaN;
  if (!Number.isNaN(rating)) {
    acc._ratingSum += rating;
    acc._ratingCount += 1;
  }
}

function firstStat(p: {
  statistics: Array<NonNullable<unknown>>;
}) {
  return (p.statistics?.[0] ?? null) as
    | (import("@/lib/apiFootball").AFPlayerStats["players"][number]["statistics"][number])
    | null;
}

/** Finalize derived fields and strip internal accumulators. */
function finalize(acc: Acc): PlayerStats {
  const passAccuracy =
    acc.passes > 0 ? Math.round((acc._accuratePasses / acc.passes) * 100) : 0;
  const rating =
    acc._ratingCount > 0
      ? Math.round((acc._ratingSum / acc._ratingCount) * 10) / 10
      : 0;
  // copy the public PlayerStats fields only
  const out: PlayerStats = { ...ZERO_STATS };
  (Object.keys(out) as (keyof PlayerStats)[]).forEach((k) => {
    out[k] = acc[k] as number;
  });
  out.passAccuracy = passAccuracy;
  out.rating = rating;
  return out;
}

export async function syncStats(season = 2026): Promise<SyncSummary> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return mk(false, 0, 0, 0, 0, "Supabase env not configured");
  }
  void WC_LEAGUE_ID; // (league id used inside the helpers)

  const fixtures = await getFinishedLeagueFixtures(WC_LEAGUE_ID, season);
  if (!fixtures || fixtures.length === 0) {
    // Still refresh team stats (also empty) and timestamp the run.
    await writeSyncState(0, 0, 0, 0, "no finished fixtures");
    return mk(true, 0, 0, 0, 0, "no finished fixtures yet");
  }

  // ── 1. Pull per-fixture player stats and accumulate per api-football id ──
  const perFixture = await Promise.all(
    fixtures.map((f) => getFixturePlayers(f.fixture.id)),
  );

  // key: api-football player id → accumulator
  const byApiId = new Map<number, Acc>();
  // remember each api id's local team + name for matching
  for (const fixtureStats of perFixture) {
    if (!fixtureStats) continue;
    for (const teamBlock of fixtureStats) {
      const local = findLocalTeam({ id: teamBlock.team.id, name: teamBlock.team.name });
      if (!local) continue;
      for (const entry of teamBlock.players) {
        const st = firstStat(entry);
        if (!st) continue;
        let acc = byApiId.get(entry.player.id);
        if (!acc) {
          acc = freshAcc(local.code, entry.player.name);
          byApiId.set(entry.player.id, acc);
        }
        accumulate(acc, st);
      }
    }
  }

  // ── 2. Load DB roster and match ──
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: rosterRows, error: rosterErr } = await supabase
    .from("players")
    .select("id, team_code, name, api_player_id");
  if (rosterErr) {
    return mk(false, fixtures.length, 0, 0, 0, `roster read failed: ${rosterErr.message}`);
  }
  const roster = rosterRows ?? [];

  // index roster by team for name matching
  const byTeam = new Map<string, typeof roster>();
  const byApiIdRow = new Map<number, (typeof roster)[number]>();
  for (const r of roster) {
    if (r.api_player_id != null) byApiIdRow.set(r.api_player_id, r);
    const list = byTeam.get(r.team_code) ?? [];
    list.push(r);
    byTeam.set(r.team_code, list);
  }

  const updates: { id: number; stats: PlayerStats; api_player_id: number }[] = [];
  let unmatched = 0;

  for (const [apiId, acc] of byApiId) {
    // (a) exact match by previously-stored api id
    let row = byApiIdRow.get(apiId) ?? null;
    // (b) else match by name within the team
    if (!row) {
      const candidates = byTeam.get(acc._teamCode) ?? [];
      const target = strip(acc._name);
      const tTokens = new Set(target.split(" ").filter((t) => t.length > 2));
      row =
        candidates.find((c) => strip(c.name) === target) ??
        candidates.find((c) => {
          const cs = strip(c.name);
          // surname/token overlap (handles "G. Jesus" vs "Gabriel Jesus")
          const cTokens = new Set(cs.split(" ").filter((t) => t.length > 2));
          const overlap = [...tTokens].filter((t) => cTokens.has(t));
          return overlap.length >= 1 && (cs.includes(target) || target.includes(cs) || overlap.length >= 2);
        }) ??
        null;
    }
    if (!row) {
      unmatched += 1;
      continue;
    }
    updates.push({ id: row.id, stats: finalize(acc), api_player_id: apiId });
  }

  // ── 3. Write player stats (chunked upsert by id) ──
  let playersSet = 0;
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("players")
      .upsert(
        slice.map((u) => ({ id: u.id, stats: u.stats, api_player_id: u.api_player_id })),
        { onConflict: "id" },
      );
    if (error) {
      return mk(false, fixtures.length, playersSet, unmatched, 0, `player write failed: ${error.message}`);
    }
    playersSet += slice.length;
  }

  // ── 4. Team stats ──
  const teamAgg = await aggregateWorldCupTeamStats(season);
  const teamRows = Object.entries(teamAgg).map(([team_code, data]) => ({ team_code, data }));
  let teamsSet = 0;
  if (teamRows.length > 0) {
    const { error } = await supabase
      .from("team_stats")
      .upsert(teamRows, { onConflict: "team_code" });
    if (error) {
      return mk(false, fixtures.length, playersSet, unmatched, 0, `team write failed: ${error.message}`);
    }
    teamsSet = teamRows.length;
  }

  await writeSyncState(fixtures.length, playersSet, unmatched, teamsSet, "ok");
  return mk(true, fixtures.length, playersSet, unmatched, teamsSet, "ok");
}

async function writeSyncState(
  fixtures: number, players_set: number, players_unmatched: number,
  teams_set: number, note: string,
) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  await supabase.from("sync_state").upsert(
    { id: 1, last_run_at: new Date().toISOString(), fixtures, players_set, players_unmatched, teams_set, note },
    { onConflict: "id" },
  );
}

function mk(
  ok: boolean, fixtures: number, playersSet: number,
  playersUnmatched: number, teamsSet: number, note: string,
): SyncSummary {
  return { ok, fixtures, playersSet, playersUnmatched, teamsSet, note };
}

// ─────────────────────────────────────────────────────────────────────────────
// Live stats sync — aggregates tournament stats from sportapi7 (Sofascore)
// and writes them into Supabase. Triggered on a schedule by
// /api/cron/sync-stats.
//
// Why Sofascore and not api-football: the free api-football plan can't read
// World Cup 2026 ("Free plans do not have access to this season"), so it
// returns zero finished fixtures and every player ends up with 0 stats.
// sportapi7 covers WC 2026 (unique-tournament 16, season 58210) and exposes
// rich per-player statistics in its lineups endpoint.
//
// What it does, each run:
//   1. List every WC event, keep the finished ones.
//   2. For each, pull lineups (per-player stats) + incidents (goals/cards) +
//      the event (score/result) and sum each player's line across the whole
//      tournament, keyed by Sofascore player id.
//   3. Match each Sofascore player to a DB roster row — primarily by the
//      Sofascore id encoded in the row's `photo` (/api/player-photo/<id>),
//      falling back to name-within-team.
//   4. Write the aggregated PlayerStats into players.stats.
//   5. Aggregate team-level stats and write team_stats — so /api/worldcup
//      reads the DB instead of hammering the API.
//
// Server-only: uses the Supabase service-role key (writes bypass RLS).
// Safe to run repeatedly; everything is upsert/idempotent. Returns 0s
// gracefully when there are no finished fixtures yet (pre-tournament).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient } from "@supabase/supabase-js";

import { findLocalTeam } from "@/lib/resolver";
import { aggregateWorldCupTeamStats } from "@/lib/teamFixtureStats";
import {
  getS7Event,
  getS7Incidents,
  getS7Lineups,
  getS7WorldCupEvents,
  type S7Incident,
  type S7LineupSide,
} from "@/lib/sportApi7";
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
// needed to finalize the derived fields (passAccuracy, rating).
type Acc = PlayerStats & {
  _teamCode: string;
  _name: string;
  _sofaId: number;
  _accuratePasses: number;
  _ratingSum: number;
  _ratingCount: number;
};

function freshAcc(teamCode: string, name: string, sofaId: number): Acc {
  return {
    ...ZERO_STATS,
    _teamCode: teamCode,
    _name: name,
    _sofaId: sofaId,
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

/** Extract the Sofascore player id a roster photo URL points at, if any. */
function sofaIdFromPhoto(photo: string | null | undefined): number | null {
  if (!photo) return null;
  const m = photo.match(/player-photo\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Sum one finished event into the per-player accumulators.
 * `side` aggregates one team's lineup; goals/cards come from incidents.
 */
function accumulateSide(
  byId: Map<number, Acc>,
  teamCode: string,
  lineup: S7LineupSide | undefined,
  incidents: S7Incident[] | null,
  isHome: boolean,
  result: "W" | "D" | "L",
  goalsConceded: number,
) {
  // Goals / cards / penalties from the incidents feed (not in lineup stats).
  const goalsByPlayer = new Map<number, number>();
  const penGoalsByPlayer = new Map<number, number>();
  const yellowByPlayer = new Map<number, number>();
  const redByPlayer = new Map<number, number>();
  for (const inc of incidents ?? []) {
    if (inc.isHome !== isHome) continue;
    if (inc.incidentType === "goal" && inc.player && inc.incidentClass !== "ownGoal") {
      goalsByPlayer.set(inc.player.id, (goalsByPlayer.get(inc.player.id) ?? 0) + 1);
      if (inc.goalType === "penalty") {
        penGoalsByPlayer.set(inc.player.id, (penGoalsByPlayer.get(inc.player.id) ?? 0) + 1);
      }
    } else if (inc.incidentType === "card" && inc.player) {
      const cls = (inc.incidentClass ?? "").toLowerCase();
      if (cls.includes("red")) redByPlayer.set(inc.player.id, 1);
      else yellowByPlayer.set(inc.player.id, (yellowByPlayer.get(inc.player.id) ?? 0) + 1);
    }
  }

  for (const lp of lineup?.players ?? []) {
    const s = lp.statistics ?? {};
    const id = lp.player.id;
    let acc = byId.get(id);
    if (!acc) {
      acc = freshAcc(teamCode, lp.player.name, id);
      byId.set(id, acc);
    }

    const minutes = n(s.minutesPlayed);
    const played = minutes > 0;
    if (played) {
      acc.appearances += 1;
      if (!lp.substitute) acc.started += 1;
      if (result === "W") acc.matchesWon += 1;
      else if (result === "D") acc.matchesDrawn += 1;
      else acc.matchesLost += 1;
    }
    acc.minutesPlayed += minutes;

    acc.goals += goalsByPlayer.get(id) ?? n(s.goals);
    acc.assists += n(s.goalAssist);
    acc.shots += n(s.totalShots);
    acc.shotsOnTarget += n(s.onTargetScoringAttempt);
    acc.keyPasses += n(s.keyPass);
    acc.passes += n(s.totalPass);
    acc._accuratePasses += n(s.accuratePass);
    acc.dribbles += n(s.wonContest);
    acc.dribbleAttempts += n(s.totalContest);
    acc.tackles += n(s.totalTackle);
    acc.interceptions += n(s.interceptionWon);
    acc.duelsWon += n(s.duelWon);
    acc.duelsTotal += n(s.duelWon) + n(s.duelLost);
    acc.foulsCommitted += n(s.fouls);
    acc.foulsDrawn += n(s.wasFouled);
    acc.offsides += n(s.totalOffside);
    acc.penaltyScored += penGoalsByPlayer.get(id) ?? 0;
    acc.yellowCards += yellowByPlayer.get(id) ?? 0;
    acc.redCards += redByPlayer.get(id) ?? 0;
    acc.saves += n(s.saves);
    acc.goalsPrevented += n(s.goalsPrevented);
    acc.clearances += n(s.totalClearance);
    acc.errorsLeadToShot += n(s.errorLeadToAShot);
    acc.crosses += n(s.accurateCross);
    acc.ballRecoveries += n(s.ballRecovery);
    acc.longBalls += n(s.totalLongBalls);
    acc.touches += n(s.touches);
    acc.expectedAssists += n(s.expectedAssists);
    acc.expectedGoals += n(s.expectedGoals);

    // Goalkeepers: per-match goals conceded / clean sheets.
    const pos = (lp.position ?? lp.player.position ?? "").toUpperCase();
    if (played && pos.startsWith("G")) {
      acc.goalsConceded += goalsConceded;
      if (goalsConceded === 0) acc.cleanSheets += 1;
    }

    const rating = typeof s.rating === "number" ? s.rating : NaN;
    if (!Number.isNaN(rating) && rating > 0) {
      acc._ratingSum += rating;
      acc._ratingCount += 1;
    }
  }
}

/** Finalize derived fields and strip internal accumulators. */
function finalize(acc: Acc): PlayerStats {
  const passAccuracy =
    acc.passes > 0 ? Math.round((acc._accuratePasses / acc.passes) * 100) : 0;
  const rating =
    acc._ratingCount > 0
      ? Math.round((acc._ratingSum / acc._ratingCount) * 10) / 10
      : 0;
  const out: PlayerStats = { ...ZERO_STATS };
  (Object.keys(out) as (keyof PlayerStats)[]).forEach((k) => {
    out[k] = acc[k] as number;
  });
  out.passAccuracy = passAccuracy;
  out.rating = rating;
  // Round the float-valued advanced metrics for clean display.
  out.expectedGoals = Math.round(out.expectedGoals * 100) / 100;
  out.expectedAssists = Math.round(out.expectedAssists * 100) / 100;
  out.goalsPrevented = Math.round(out.goalsPrevented * 100) / 100;
  return out;
}

export async function syncStats(season = 2026): Promise<SyncSummary> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return mk(false, 0, 0, 0, 0, "Supabase env not configured");
  }

  const events = await getS7WorldCupEvents();
  const finished = events.filter((e) => e.statusType === "finished");
  if (finished.length === 0) {
    await writeSyncState(0, 0, 0, 0, "no finished fixtures");
    return mk(true, 0, 0, 0, 0, "no finished fixtures yet");
  }

  // ── 1. Pull each finished event's lineups + incidents + score, accumulate ──
  const byId = new Map<number, Acc>();
  const perEvent = await Promise.all(
    finished.map(async (e) => {
      const [lineups, incidents, ev] = await Promise.all([
        getS7Lineups(e.id),
        getS7Incidents(e.id),
        getS7Event(e.id),
      ]);
      return { e, lineups, incidents, ev };
    }),
  );

  for (const { lineups, incidents, ev } of perEvent) {
    if (!ev || !lineups) continue;
    const homeLocal = findLocalTeam({ id: ev.homeTeam.id, name: ev.homeTeam.name });
    const awayLocal = findLocalTeam({ id: ev.awayTeam.id, name: ev.awayTeam.name });
    const hs = n(ev.homeScore.current);
    const as = n(ev.awayScore.current);
    const homeResult = hs > as ? "W" : hs < as ? "L" : "D";
    const awayResult = as > hs ? "W" : as < hs ? "L" : "D";
    if (homeLocal) {
      accumulateSide(byId, homeLocal.code, lineups.home, incidents, true, homeResult, as);
    }
    if (awayLocal) {
      accumulateSide(byId, awayLocal.code, lineups.away, incidents, false, awayResult, hs);
    }
  }

  // ── 2. Load DB roster and match (by Sofascore photo id, then name) ──
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  // Paginate: there are ~1,250 players (48 × 26) and PostgREST caps a single
  // response at 1,000 rows, so a plain select silently truncates the roster.
  type RosterRow = { id: number; team_code: string; name: string; photo: string | null };
  const roster: RosterRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select("id, team_code, name, photo")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      return mk(false, finished.length, 0, 0, 0, `roster read failed: ${error.message}`);
    }
    const rows = (data ?? []) as RosterRow[];
    roster.push(...rows);
    if (rows.length < PAGE) break;
  }

  const byTeam = new Map<string, typeof roster>();
  const bySofaId = new Map<number, (typeof roster)[number]>();
  for (const r of roster) {
    const sid = sofaIdFromPhoto(r.photo);
    if (sid != null) bySofaId.set(sid, r);
    const list = byTeam.get(r.team_code) ?? [];
    list.push(r);
    byTeam.set(r.team_code, list);
  }

  const updates: { id: number; stats: PlayerStats }[] = [];
  const unmatchedNames: string[] = [];
  let unmatched = 0;

  for (const [sofaId, acc] of byId) {
    // Only players who actually featured in a finished match get written;
    // unused bench players stay at their default (zeroed) stats.
    if (acc.appearances === 0) continue;
    // (a) exact match by the Sofascore id baked into the photo URL
    let row = bySofaId.get(sofaId) ?? null;
    // (b) else match by name within the team
    if (!row) {
      const candidates = byTeam.get(acc._teamCode) ?? [];
      const target = strip(acc._name);
      const tTokens = new Set(target.split(" ").filter((t) => t.length > 2));
      row =
        candidates.find((c) => strip(c.name) === target) ??
        candidates.find((c) => {
          const cs = strip(c.name);
          const cTokens = new Set(cs.split(" ").filter((t) => t.length > 2));
          const overlap = [...tTokens].filter((t) => cTokens.has(t));
          return (
            overlap.length >= 1 &&
            (cs.includes(target) || target.includes(cs) || overlap.length >= 2)
          );
        }) ??
        null;
    }
    if (!row) {
      unmatched += 1;
      unmatchedNames.push(`${acc._teamCode}:${acc._name}`);
      continue;
    }
    updates.push({ id: row.id, stats: finalize(acc) });
  }
  if (unmatchedNames.length > 0) {
    console.warn(`[statsSync] ${unmatched} unmatched players:`, unmatchedNames.join(", "));
  }

  // ── 3. Write player stats (per-row UPDATE — players.id is an identity
  //       column, so an upsert that carries id can't INSERT). Every id here
  //       came from an existing roster row, so a plain update is correct. ──
  let playersSet = 0;
  const CHUNK = 25;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((u) =>
        supabase.from("players").update({ stats: u.stats }).eq("id", u.id),
      ),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      return mk(false, finished.length, playersSet, unmatched, 0, `player write failed: ${firstErr.message}`);
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
      return mk(false, finished.length, playersSet, unmatched, 0, `team write failed: ${error.message}`);
    }
    teamsSet = teamRows.length;
  }

  await writeSyncState(finished.length, playersSet, unmatched, teamsSet, "ok");
  return mk(true, finished.length, playersSet, unmatched, teamsSet, "ok");
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

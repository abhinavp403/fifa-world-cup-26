// ─────────────────────────────────────────────────────────────────────────────
// Live stats sync — aggregates tournament stats from sportapi7 (Sofascore)
// and writes them into Supabase. Triggered on a schedule by
// /api/cron/sync-stats, and opportunistically (non-blocking) when a freshly
// finished match is first opened (see /api/match → after()).
//
// Incremental design — two phases:
//   1. INGEST: list finished fixtures, skip the ones already cached, and for
//      each NEW one fetch lineups + incidents + statistics + event, compute its
//      raw per-player and per-team contributions, and store them verbatim in
//      `fixture_stats`. This is the only phase that hits the (rate-limited)
//      Sofascore API, and it touches each fixture exactly once.
//   2. AGGREGATE: sum every cached fixture row in the DB (no API calls),
//      finalize derived fields (passAccuracy, rating, possession), match each
//      Sofascore player to a roster row, and write players.stats + team_stats.
//
// Why Sofascore and not api-football: the free api-football plan can't read
// World Cup 2026 ("Free plans do not have access to this season").
//
// Server-only: uses the Supabase service-role key (writes bypass RLS).
// Safe to run repeatedly; everything is upsert/idempotent.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { findLocalTeam } from "@/lib/resolver";
import {
  computeFixtureTeamLines,
  finalizeTeamLine,
  mergeTeamLine,
  ZERO_TEAM_LINE,
  type TeamRawLine,
} from "@/lib/teamFixtureStats";
import {
  getS7Event,
  getS7Incidents,
  getS7Lineups,
  getS7Statistics,
  getS7WorldCupEvents,
  type S7Incident,
  type S7LineupSide,
} from "@/lib/sportApi7";
import { ZERO_STATS, type PlayerStats } from "@/lib/squads";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SyncSummary = {
  ok: boolean;
  fixtures: number; // total fixtures in the cache
  ingested: number; // new fixtures fetched + cached this run
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

// What we persist per player in fixture_stats: identity + the raw numeric line
// (every Acc field except the identity strings/id), JSON-serializable.
type PlayerLine = Omit<Acc, "_teamCode" | "_name" | "_sofaId">;
type StoredPlayer = {
  sofaId: number;
  teamCode: string;
  name: string;
  line: PlayerLine;
};
type FixtureData = {
  players: StoredPlayer[];
  teams: Record<string, TeamRawLine>;
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

/** Strip an Acc down to the JSON-serializable line stored per fixture. */
function accToStored(acc: Acc): StoredPlayer {
  const { _teamCode, _name, _sofaId, ...line } = acc;
  return { sofaId: _sofaId, teamCode: _teamCode, name: _name, line };
}

/** Add a stored per-fixture line into a running per-player accumulator. */
function mergeStoredPlayer(into: Acc, sp: StoredPlayer) {
  const line = sp.line as unknown as Record<string, number>;
  const target = into as unknown as Record<string, number>;
  for (const k of Object.keys(line)) {
    target[k] = (target[k] ?? 0) + (line[k] ?? 0);
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

// ── Phase 1: ingest new finished fixtures into the cache ────────────────────

/** Fetch one finished fixture and build its raw per-player + per-team lines. */
async function buildFixtureData(eventId: number): Promise<{
  data: FixtureData;
  homeCode: string | null;
  awayCode: string | null;
} | null> {
  const [lineups, incidents, stats, ev] = await Promise.all([
    getS7Lineups(eventId),
    getS7Incidents(eventId),
    getS7Statistics(eventId),
    getS7Event(eventId),
  ]);
  if (!ev || !lineups) return null;

  const homeLocal = findLocalTeam({ id: ev.homeTeam.id, name: ev.homeTeam.name });
  const awayLocal = findLocalTeam({ id: ev.awayTeam.id, name: ev.awayTeam.name });
  const hs = n(ev.homeScore.current);
  const as = n(ev.awayScore.current);
  const homeResult = hs > as ? "W" : hs < as ? "L" : "D";
  const awayResult = as > hs ? "W" : as < hs ? "L" : "D";

  const byId = new Map<number, Acc>();
  if (homeLocal) {
    accumulateSide(byId, homeLocal.code, lineups.home, incidents, true, homeResult, as);
  }
  if (awayLocal) {
    accumulateSide(byId, awayLocal.code, lineups.away, incidents, false, awayResult, hs);
  }

  const players = [...byId.values()].map(accToStored);
  const teams = computeFixtureTeamLines(stats, lineups, ev);

  return {
    data: { players, teams },
    homeCode: homeLocal?.code ?? null,
    awayCode: awayLocal?.code ?? null,
  };
}

/**
 * Ingest every finished fixture not yet in the cache. Returns how many new
 * fixtures were stored this run and the total cached afterwards.
 */
async function ingestNewFixtures(
  supabase: SupabaseClient,
): Promise<{ ingested: number; cached: number }> {
  const events = await getS7WorldCupEvents();
  const finished = events.filter((e) => e.statusType === "finished");

  const { data: existing } = await supabase
    .from("fixture_stats")
    .select("fixture_id");
  const cachedIds = new Set((existing ?? []).map((r) => Number(r.fixture_id)));

  const toIngest = finished.filter((e) => !cachedIds.has(e.id));

  let ingested = 0;
  // Insert with ignoreDuplicates so concurrent triggers can't double-count.
  for (const e of toIngest) {
    const built = await buildFixtureData(e.id);
    if (!built) continue;
    const { data, error } = await supabase
      .from("fixture_stats")
      .upsert(
        {
          fixture_id: e.id,
          home_code: built.homeCode,
          away_code: built.awayCode,
          data: built.data,
        },
        { onConflict: "fixture_id", ignoreDuplicates: true },
      )
      .select("fixture_id");
    if (error) {
      console.warn(`[statsSync] ingest ${e.id} failed: ${error.message}`);
      continue;
    }
    if (data && data.length > 0) {
      ingested++;
      cachedIds.add(e.id);
    }
  }

  return { ingested, cached: cachedIds.size };
}

// ── Phase 2: aggregate the cache into players.stats + team_stats ────────────

type RosterRow = { id: number; team_code: string; name: string; photo: string | null };

async function aggregateFromCache(
  supabase: SupabaseClient,
): Promise<{ playersSet: number; playersUnmatched: number; teamsSet: number }> {
  // 1. Read every cached fixture (DB-only, no API).
  const { data: rows } = await supabase
    .from("fixture_stats")
    .select("data");
  const fixtures = (rows ?? []) as { data: FixtureData }[];

  // 2. Merge per-player by Sofascore id, and per-team by code.
  const byId = new Map<number, Acc>();
  const teamAcc: Record<string, TeamRawLine> = {};
  for (const { data } of fixtures) {
    for (const sp of data.players ?? []) {
      let acc = byId.get(sp.sofaId);
      if (!acc) {
        acc = freshAcc(sp.teamCode, sp.name, sp.sofaId);
        byId.set(sp.sofaId, acc);
      }
      mergeStoredPlayer(acc, sp);
    }
    for (const [code, line] of Object.entries(data.teams ?? {})) {
      teamAcc[code] ??= ZERO_TEAM_LINE();
      mergeTeamLine(teamAcc[code], line);
    }
  }

  // 3. Load DB roster (paginated — PostgREST caps a response at 1,000 rows).
  const roster: RosterRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select("id, team_code, name, photo")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`roster read failed: ${error.message}`);
    const page = (data ?? []) as RosterRow[];
    roster.push(...page);
    if (page.length < PAGE) break;
  }

  const byTeam = new Map<string, RosterRow[]>();
  const bySofaId = new Map<number, RosterRow>();
  for (const r of roster) {
    const sid = sofaIdFromPhoto(r.photo);
    if (sid != null) bySofaId.set(sid, r);
    const list = byTeam.get(r.team_code) ?? [];
    list.push(r);
    byTeam.set(r.team_code, list);
  }

  // 4. Match each player (by Sofascore photo id, then name-within-team).
  const updates: { id: number; stats: PlayerStats }[] = [];
  const unmatchedNames: string[] = [];
  for (const [sofaId, acc] of byId) {
    if (acc.appearances === 0) continue;
    let row = bySofaId.get(sofaId) ?? null;
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
      unmatchedNames.push(`${acc._teamCode}:${acc._name}`);
      continue;
    }
    updates.push({ id: row.id, stats: finalize(acc) });
  }
  if (unmatchedNames.length > 0) {
    console.warn(`[statsSync] ${unmatchedNames.length} unmatched players:`, unmatchedNames.join(", "));
  }

  // 5. Write player stats (per-row UPDATE — id is an identity column).
  let playersSet = 0;
  const CHUNK = 25;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((u) => supabase.from("players").update({ stats: u.stats }).eq("id", u.id)),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw new Error(`player write failed: ${firstErr.message}`);
    playersSet += slice.length;
  }

  // 6. Write team stats.
  const teamRows = Object.entries(teamAcc).map(([team_code, raw]) => ({
    team_code,
    data: finalizeTeamLine(raw),
  }));
  let teamsSet = 0;
  if (teamRows.length > 0) {
    const { error } = await supabase
      .from("team_stats")
      .upsert(teamRows, { onConflict: "team_code" });
    if (error) throw new Error(`team write failed: ${error.message}`);
    teamsSet = teamRows.length;
  }

  return { playersSet, playersUnmatched: unmatchedNames.length, teamsSet };
}

/**
 * Run the stats sync.
 * @param opts.force  when true (default) always re-aggregate from the cache;
 *   when false, only re-aggregate if this run ingested a new fixture (used by
 *   the opportunistic on-match-open trigger to avoid needless DB writes).
 */
export async function syncStats(
  season = 2026,
  opts: { force?: boolean } = {},
): Promise<SyncSummary> {
  void season; // fixed by the sportapi7 tournament/season constants
  const force = opts.force ?? true;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return mk(false, 0, 0, 0, 0, 0, "Supabase env not configured");
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { ingested, cached } = await ingestNewFixtures(supabase);

  if (cached === 0) {
    await writeSyncState(supabase, 0, 0, 0, 0, "no finished fixtures");
    return mk(true, 0, ingested, 0, 0, 0, "no finished fixtures yet");
  }

  // Nothing new and not forced → leave the existing aggregate untouched.
  if (ingested === 0 && !force) {
    return mk(true, cached, 0, 0, 0, 0, "no new fixtures");
  }

  const { playersSet, playersUnmatched, teamsSet } = await aggregateFromCache(supabase);
  await writeSyncState(supabase, cached, playersSet, playersUnmatched, teamsSet, "ok");
  return mk(true, cached, ingested, playersSet, playersUnmatched, teamsSet, "ok");
}

async function writeSyncState(
  supabase: SupabaseClient,
  fixtures: number, players_set: number, players_unmatched: number,
  teams_set: number, note: string,
) {
  await supabase.from("sync_state").upsert(
    { id: 1, last_run_at: new Date().toISOString(), fixtures, players_set, players_unmatched, teams_set, note },
    { onConflict: "id" },
  );
}

function mk(
  ok: boolean, fixtures: number, ingested: number, playersSet: number,
  playersUnmatched: number, teamsSet: number, note: string,
): SyncSummary {
  return { ok, fixtures, ingested, playersSet, playersUnmatched, teamsSet, note };
}

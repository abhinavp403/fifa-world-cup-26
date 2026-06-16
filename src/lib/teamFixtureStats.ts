// Tournament-wide aggregation of team-level stats from sportapi7 (Sofascore).
//
// Was built on api-football, but the free plan can't read WC 2026, so it
// returned nothing and every team showed zeros. sportapi7 covers WC 2026.
//
// Two sources per finished event:
//   • /event/{id}/statistics — team-level totals (shots, fouls, cards,
//     possession, corners, passes, saves, etc.). One value per side.
//   • /event/{id}/lineups    — per-player stats; summed across each side to
//     recover team totals for fields the statistics endpoint doesn't expose
//     (key passes, tackles, interceptions).
//
// Output shape is unchanged from the old api-football version so callers
// (/api/worldcup, the team-stats modal, statsSync) keep working as-is.

import { findLocalTeam } from "@/lib/resolver";
import {
  getS7Event,
  getS7Lineups,
  getS7Statistics,
  getS7WorldCupEvents,
  type S7LineupSide,
  type S7StatPeriod,
} from "@/lib/sportApi7";

export type TeamFixtureAggregate = {
  // From /event/{id}/statistics (team-level totals)
  possession:     number; // average possession % (0–100)
  corners:        number;
  shots:          number;
  shotsOnTarget:  number;
  fouls:          number;
  offsides:       number;
  yellowCards:    number;
  redCards:       number;
  saves:          number;
  passes:         number;
  passesAccurate: number;
  // From /event/{id}/lineups (per-player, summed across the roster)
  keyPasses:      number;
  tackles:        number;
  interceptions:  number;
  // Bookkeeping
  matches:        number;
};

export type TeamFixtureAggregateMap = Record<string, TeamFixtureAggregate>;

// Read one team-level statistic (home or away) from the "ALL" period.
function teamStat(
  stats: S7StatPeriod[] | null,
  key: string,
  side: "home" | "away",
): number {
  if (!stats) return 0;
  const all = stats.find((p) => p.period === "ALL");
  if (!all) return 0;
  for (const g of all.groups) {
    const item = g.statisticsItems.find((i) => i.key === key);
    if (item) return (side === "home" ? item.homeValue : item.awayValue) ?? 0;
  }
  return 0;
}

// Raw per-team accumulator: the aggregate fields plus the un-averaged
// possessionSum, so partial sums from individual fixtures can be merged before
// possession is finalized.
export type TeamRawLine = TeamFixtureAggregate & { possessionSum: number };

export const ZERO_TEAM_LINE = (): TeamRawLine => ({
  possession: 0, corners: 0, shots: 0, shotsOnTarget: 0,
  fouls: 0, offsides: 0, yellowCards: 0, redCards: 0,
  saves: 0, passes: 0, passesAccurate: 0,
  keyPasses: 0, tackles: 0, interceptions: 0,
  matches: 0,
  possessionSum: 0,
});

const ZERO_AGG = ZERO_TEAM_LINE;
type AccMap = Record<string, TeamRawLine>;

function ensure(acc: AccMap, code: string) {
  acc[code] ??= ZERO_AGG();
  return acc[code];
}

// Accumulate one side of one finished event into the per-team aggregate.
function accumulateSide(
  a: ReturnType<typeof ZERO_AGG>,
  stats: S7StatPeriod[] | null,
  lineup: S7LineupSide | undefined,
  side: "home" | "away",
) {
  a.shots          += teamStat(stats, "totalShotsOnGoal", side);
  a.shotsOnTarget  += teamStat(stats, "shotsOnGoal", side);
  a.fouls          += teamStat(stats, "fouls", side);
  a.offsides       += teamStat(stats, "offsides", side);
  a.corners        += teamStat(stats, "cornerKicks", side);
  a.yellowCards    += teamStat(stats, "yellowCards", side);
  a.redCards       += teamStat(stats, "redCards", side);
  a.saves          += teamStat(stats, "goalkeeperSaves", side);
  a.passes         += teamStat(stats, "passes", side);
  a.passesAccurate += teamStat(stats, "accuratePasses", side);
  a.possessionSum  += teamStat(stats, "ballPossession", side);

  for (const lp of lineup?.players ?? []) {
    const s = lp.statistics ?? {};
    a.keyPasses     += s.keyPass ?? 0;
    a.tackles       += s.totalTackle ?? 0;
    a.interceptions += s.interceptionWon ?? 0;
  }

  a.matches++;
}

// ── Per-fixture helpers (used by the incremental stats cache) ───────────────

type S7Ev = NonNullable<Awaited<ReturnType<typeof getS7Event>>>;

/**
 * Raw team contributions from a single finished fixture, keyed by local team
 * code. Stored verbatim in fixture_stats so the tournament aggregate can be
 * rebuilt by summing these without re-hitting the API.
 */
export function computeFixtureTeamLines(
  stats: S7StatPeriod[] | null,
  lineups: { home?: S7LineupSide; away?: S7LineupSide } | null,
  ev: S7Ev,
): Record<string, TeamRawLine> {
  const out: Record<string, TeamRawLine> = {};
  const homeLocal = findLocalTeam({ id: ev.homeTeam.id, name: ev.homeTeam.name });
  const awayLocal = findLocalTeam({ id: ev.awayTeam.id, name: ev.awayTeam.name });
  if (homeLocal) {
    const line = ZERO_TEAM_LINE();
    accumulateSide(line, stats, lineups?.home, "home");
    out[homeLocal.code] = line;
  }
  if (awayLocal) {
    const line = ZERO_TEAM_LINE();
    accumulateSide(line, stats, lineups?.away, "away");
    out[awayLocal.code] = line;
  }
  return out;
}

/** Sum one raw team line into a running total (in place). */
export function mergeTeamLine(into: TeamRawLine, add: Partial<TeamRawLine>) {
  for (const k of Object.keys(into) as (keyof TeamRawLine)[]) {
    into[k] += add[k] ?? 0;
  }
}

/** Finalize a merged raw line: average possession, drop bookkeeping. */
export function finalizeTeamLine(v: TeamRawLine): TeamFixtureAggregate {
  return {
    possession: v.matches > 0
      ? Math.round((v.possessionSum / v.matches) * 10) / 10
      : 0,
    corners:        v.corners,
    shots:          v.shots,
    shotsOnTarget:  v.shotsOnTarget,
    fouls:          v.fouls,
    offsides:       v.offsides,
    yellowCards:    v.yellowCards,
    redCards:       v.redCards,
    saves:          v.saves,
    passes:         v.passes,
    passesAccurate: v.passesAccurate,
    keyPasses:      v.keyPasses,
    tackles:        v.tackles,
    interceptions:  v.interceptions,
    matches:        v.matches,
  };
}

// Live (non-cached) aggregation — re-fetches every finished fixture. Used by
// /api/worldcup as a fallback when the DB team_stats table is empty. The stats
// sync no longer calls this; it aggregates from the fixture_stats cache instead.
export async function aggregateWorldCupTeamStats(
  _season: number,
): Promise<TeamFixtureAggregateMap> {
  void _season; // season is fixed by the sportapi7 tournament/season constants
  const events = await getS7WorldCupEvents();
  const finished = events.filter((e) => e.statusType === "finished");
  if (finished.length === 0) return {};

  const perEvent = await Promise.all(
    finished.map(async (e) => {
      const [stats, lineups, ev] = await Promise.all([
        getS7Statistics(e.id),
        getS7Lineups(e.id),
        getS7Event(e.id),
      ]);
      return { stats, lineups, ev };
    }),
  );

  const acc: AccMap = {};
  for (const { stats, lineups, ev } of perEvent) {
    if (!ev) continue;
    const lines = computeFixtureTeamLines(stats, lineups, ev);
    for (const [code, line] of Object.entries(lines)) {
      mergeTeamLine(ensure(acc, code), line);
    }
  }

  const out: TeamFixtureAggregateMap = {};
  for (const [code, v] of Object.entries(acc)) {
    out[code] = finalizeTeamLine(v);
  }
  return out;
}

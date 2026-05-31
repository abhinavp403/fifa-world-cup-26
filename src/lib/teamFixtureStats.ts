// Tournament-wide aggregation of api-football per-fixture stats.
//
// Two parallel passes per finished fixture:
//   • /fixtures/statistics — team-level totals (shots, fouls, cards,
//     possession, corners, passes, saves, etc.). One row per side.
//   • /fixtures/players    — per-player stats; summed across each side
//     to recover team-level totals for fields that don't exist at the
//     fixture-statistics level (key passes, tackles, interceptions).
//
// Both endpoints go through the `next: { revalidate: 300 }` cache
// wrapper in apiFootball.ts, so callers within a 5-minute window reuse
// the same data without re-hitting the API.

import {
  WC_LEAGUE_ID,
  getFinishedLeagueFixtures,
  getFixturePlayers,
  getFixtureStatistics,
} from "@/lib/apiFootball";
import { findLocalTeam } from "@/lib/resolver";

export type TeamFixtureAggregate = {
  // From /fixtures/statistics (team-level totals)
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
  // From /fixtures/players (per-player, summed across the roster)
  keyPasses:      number;
  tackles:        number;
  interceptions:  number;
  // Bookkeeping
  matches:        number;
};

export type TeamFixtureAggregateMap = Record<string, TeamFixtureAggregate>;

function statValueAsNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  // possession comes back as e.g. "60%" — strip non-digits
  const n = parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// Map of API-Football statistic type names → which TeamFixtureAggregate
// field they should accumulate into. Possession is averaged at the end;
// everything else is a simple sum.
const STAT_FIELD_MAP: Record<string, keyof TeamFixtureAggregate | "possession_sum"> = {
  "Total Shots":       "shots",
  "Shots on Goal":     "shotsOnTarget",
  "Fouls":             "fouls",
  "Offsides":          "offsides",
  "Corner Kicks":      "corners",
  "Yellow Cards":      "yellowCards",
  "Red Cards":         "redCards",
  "Goalkeeper Saves":  "saves",
  "Total passes":      "passes",
  "Passes accurate":   "passesAccurate",
  "Ball Possession":   "possession_sum",
};

const ZERO_AGG = (): TeamFixtureAggregate & { possessionSum: number } => ({
  possession: 0, corners: 0, shots: 0, shotsOnTarget: 0,
  fouls: 0, offsides: 0, yellowCards: 0, redCards: 0,
  saves: 0, passes: 0, passesAccurate: 0,
  keyPasses: 0, tackles: 0, interceptions: 0,
  matches: 0,
  possessionSum: 0,
});

type AccMap = Record<string, ReturnType<typeof ZERO_AGG>>;

function ensure(acc: AccMap, code: string) {
  acc[code] ??= ZERO_AGG();
  return acc[code];
}

export async function aggregateWorldCupTeamStats(
  season: number,
): Promise<TeamFixtureAggregateMap> {
  const fixtures = await getFinishedLeagueFixtures(WC_LEAGUE_ID, season);
  if (!fixtures || fixtures.length === 0) return {};

  // Parallel-fetch per-fixture statistics AND per-fixture players for
  // every finished match. Each individual call is cached at the fetch
  // layer (5-min revalidate), so re-renders within that window are free.
  const [statsByFixture, playersByFixture] = await Promise.all([
    Promise.all(fixtures.map((f) => getFixtureStatistics(f.fixture.id))),
    Promise.all(fixtures.map((f) => getFixturePlayers(f.fixture.id))),
  ]);

  const acc: AccMap = {};

  // ── Pass 1: team-level stats from /fixtures/statistics ──
  fixtures.forEach((_fixture, idx) => {
    const fixtureStats = statsByFixture[idx];
    if (!fixtureStats) return;

    for (const teamStat of fixtureStats) {
      const local = findLocalTeam({
        id:   teamStat.team.id,
        name: teamStat.team.name,
      });
      if (!local) continue;

      const a = ensure(acc, local.code);

      for (const row of teamStat.statistics) {
        const field = STAT_FIELD_MAP[row.type];
        if (!field) continue;
        const val = statValueAsNumber(row.value);
        if (field === "possession_sum") {
          a.possessionSum += val;
        } else {
          a[field] = (a[field] as number) + val;
        }
      }
      a.matches++;
    }
  });

  // ── Pass 2: player-level sums from /fixtures/players for the few
  // fields that aren't at the fixture-statistics level. ──
  fixtures.forEach((_fixture, idx) => {
    const fixturePlayers = playersByFixture[idx];
    if (!fixturePlayers) return;

    for (const teamPlayers of fixturePlayers) {
      const local = findLocalTeam({
        id:   teamPlayers.team.id,
        name: teamPlayers.team.name,
      });
      if (!local) continue;

      const a = ensure(acc, local.code);

      for (const playerEntry of teamPlayers.players) {
        const s = playerEntry.statistics[0];
        if (!s) continue;
        a.keyPasses     += s.passes.key            ?? 0;
        a.tackles       += s.tackles.total         ?? 0;
        a.interceptions += s.tackles.interceptions ?? 0;
      }
    }
  });

  // ── Finalize: compute averaged possession and drop bookkeeping ──
  const out: TeamFixtureAggregateMap = {};
  for (const [code, v] of Object.entries(acc)) {
    out[code] = {
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
  return out;
}

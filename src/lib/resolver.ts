// Resolves live football-data.org standings + matches into the shapes our
// dashboard already consumes:
//   • Group standings with computed positions
//   • Bracket slots populated with real Team objects where known
//
// Anything we can't resolve falls back to the static proxy data, so the page
// always renders.

import {
  GROUPS,
  type Group,
  type Team,
} from "@/lib/worldcup";
import { BRACKET, THIRD_PLACE_MATCH, type Match, type Round, type Slot } from "@/lib/bracket";
import {
  type FDMatch,
  type FDTeam,
} from "@/lib/footballData";

// ─────────────────────────────────────────────────────────────────────────────
// Team lookup — match football-data team → our local Team by name / code
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TEAMS: Team[] = GROUPS.flatMap((g) => g.teams);

// The score to display: for penalty shootouts football-data's `fullTime` folds
// in the shootout goals (a 1-1 reads 4-5), so use regular + extra time instead.
function fdScore(score: FDMatch["score"]): { home: number | null; away: number | null } {
  if (score.duration === "PENALTY_SHOOTOUT" && score.regularTime) {
    const et = score.extraTime;
    return {
      home: (score.regularTime.home ?? 0) + (et?.home ?? 0),
      away: (score.regularTime.away ?? 0) + (et?.away ?? 0),
    };
  }
  return score.fullTime;
}

const NAME_OVERRIDES: Record<string, string> = {
  // football-data → local code
  "united states": "USA",
  "united states of america": "USA",
  "usa": "USA",
  "korea republic": "KOR",
  "south korea": "KOR",
  "iran (islamic republic of)": "IRN",
  "ir iran": "IRN",
  "ivory coast": "CIV",
  "côte d'ivoire": "CIV",
  "cote d'ivoire": "CIV",
  "turkey": "TUR",
  "türkiye": "TUR",
  "cape verde islands": "CPV",
  "cabo verde": "CPV",
  "congo dr": "COD",
  "dr congo": "COD",
  "democratic republic of the congo": "COD",
  "bosnia-herzegovina": "BIH",
  "bosnia and herzegovina": "BIH",
  "czechia": "CZE",
  "czech republic": "CZE",
};

export function findLocalTeam(fd: FDTeam | undefined | null): Team | null {
  if (!fd) return null;

  // 1. Try TLA / our code
  if (fd.tla) {
    const byCode = ALL_TEAMS.find((t) => t.code === fd.tla?.toUpperCase());
    if (byCode) return byCode;
  }

  // 2. Manual overrides on full or short name
  for (const candidate of [fd.name, fd.shortName].filter(Boolean) as string[]) {
    const key = candidate.toLowerCase().trim();
    const overrideCode = NAME_OVERRIDES[key];
    if (overrideCode) {
      const byOverride = ALL_TEAMS.find((t) => t.code === overrideCode);
      if (byOverride) return byOverride;
    }
  }

  // 3. Loose name compare
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  for (const candidate of [fd.name, fd.shortName].filter(Boolean) as string[]) {
    const target = norm(candidate);
    const hit = ALL_TEAMS.find(
      (t) => norm(t.name) === target || target.includes(norm(t.name)),
    );
    if (hit) return hit;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group standings — augment static groups with live results
// ─────────────────────────────────────────────────────────────────────────────

export type GroupRow = {
  team: Team;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type GroupMatch = {
  id: number;
  fixtureId: number | null;
  utcDate: string;
  status: string;
  homeCode: string;
  homeFlag: string;
  homeName: string;
  awayCode: string;
  awayFlag: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  stadium: string | null;
};

export type ResolvedGroup = Group & {
  rows: GroupRow[] | null;
  matches: GroupMatch[] | null;
};

// Compute group standings from finished group-stage matches.
// (The /standings endpoint on the free tier returns a single 48-team aggregate
// without group breakdown, so we derive standings ourselves.)
export function resolveGroups(matches: FDMatch[] | null): ResolvedGroup[] {
  if (!matches) return GROUPS.map((g) => ({ ...g, rows: null, matches: null }));

  return GROUPS.map((g) => {
    const groupKey = `GROUP_${g.letter}`;
    const groupMatches = matches.filter(
      (m) => m.stage === "GROUP_STAGE" && m.group === groupKey,
    );

    if (groupMatches.length === 0) return { ...g, rows: null, matches: null };

    // Build simplified match list sorted by date.
    const matchItems: GroupMatch[] = groupMatches
      .map((m) => {
        const home = findLocalTeam(m.homeTeam);
        const away = findLocalTeam(m.awayTeam);
        return {
          id: m.id,
          fixtureId: null,
          utcDate: m.utcDate,
          status: m.status,
          homeCode: home?.code ?? m.homeTeam?.tla ?? "TBD",
          homeFlag: home?.flag ?? "🏳️",
          homeName: home?.name ?? m.homeTeam?.name ?? "TBD",
          awayCode: away?.code ?? m.awayTeam?.tla ?? "TBD",
          awayFlag: away?.flag ?? "🏳️",
          awayName: away?.name ?? m.awayTeam?.name ?? "TBD",
          homeScore: fdScore(m.score).home,
          awayScore: fdScore(m.score).away,
          stadium: null,
        };
      })
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

    // Initialize a row per local team in this group
    const stats = new Map<string, GroupRow>();
    g.teams.forEach((t) => {
      stats.set(t.code, {
        team: t,
        position: 0,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      });
    });

    let anyPlayed = false;

    groupMatches.forEach((m) => {
      if (m.status !== "FINISHED" && m.status !== "AWARDED") return;
      const home = findLocalTeam(m.homeTeam);
      const away = findLocalTeam(m.awayTeam);
      if (!home || !away) return;
      const h = stats.get(home.code);
      const a = stats.get(away.code);
      if (!h || !a) return;

      const hg = m.score.fullTime.home ?? 0;
      const ag = m.score.fullTime.away ?? 0;
      h.played++; a.played++;
      h.gf += hg; h.ga += ag;
      a.gf += ag; a.ga += hg;

      if (m.score.winner === "HOME_TEAM") {
        h.won++; a.lost++; h.points += 3;
      } else if (m.score.winner === "AWAY_TEAM") {
        a.won++; h.lost++; a.points += 3;
      } else {
        h.drawn++; a.drawn++; h.points += 1; a.points += 1;
      }
      anyPlayed = true;
    });

    if (!anyPlayed) return { ...g, rows: null, matches: matchItems };

    const rows = Array.from(stats.values())
      .map((r) => ({ ...r, gd: r.gf - r.ga }))
      // FIFA tiebreak (subset): points → goal difference → goals for
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      })
      .map((r, i) => ({ ...r, position: i + 1 }));

    return { ...g, rows, matches: matchItems };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracket — resolve slot.team using live matches when stage data exists
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_TO_ROUND_SHORT: Record<string, string> = {
  LAST_32: "R32",
  ROUND_OF_32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  QUARTER_FINAL: "QF",
  SEMI_FINALS: "SF",
  SEMI_FINAL: "SF",
  FINAL: "FINAL",
  THIRD_PLACE: "THIRD",
};

function slotFromFD(team: FDTeam | undefined, fallback: Slot): Slot {
  const local = findLocalTeam(team);
  return local ? { label: local.code, team: local } : fallback;
}

export function resolveBracket(matches: FDMatch[] | null): {
  rounds: Round[];
  thirdPlace: Match;
} {
  if (!matches || matches.length === 0) {
    return { rounds: BRACKET, thirdPlace: THIRD_PLACE_MATCH };
  }

  // Bucket matches by round in chronological order
  const buckets: Record<string, FDMatch[]> = {};
  matches.forEach((m) => {
    const short = STAGE_TO_ROUND_SHORT[m.stage];
    if (!short) return;
    (buckets[short] ??= []).push(m);
  });
  Object.values(buckets).forEach((arr) =>
    arr.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()),
  );

  const rounds = BRACKET.map<Round>((round) => {
    const live = buckets[round.short] ?? [];
    if (live.length === 0) return round;

    const newMatches = round.matches.map((m, idx) => {
      const fd = live[idx];
      if (!fd) return m;
      return {
        ...m,
        date: fd.utcDate,
        slot1: slotFromFD(fd.homeTeam, m.slot1),
        slot2: slotFromFD(fd.awayTeam, m.slot2),
        homeScore: fdScore(fd.score).home,
        awayScore: fdScore(fd.score).away,
        status: fd.status,
      } satisfies Match;
    });

    return { ...round, matches: newMatches };
  });

  const thirdLive = (buckets["THIRD"] ?? [])[0];
  const thirdPlace: Match = thirdLive
    ? {
        ...THIRD_PLACE_MATCH,
        date: thirdLive.utcDate,
        slot1: slotFromFD(thirdLive.homeTeam, THIRD_PLACE_MATCH.slot1),
        slot2: slotFromFD(thirdLive.awayTeam, THIRD_PLACE_MATCH.slot2),
        // Carry the score + status through (like the rounds above) so the
        // worldcup route can attach a Sofascore fixtureId for its analytics.
        homeScore: fdScore(thirdLive.score).home,
        awayScore: fdScore(thirdLive.score).away,
        status: thirdLive.status,
      }
    : THIRD_PLACE_MATCH;

  return { rounds, thirdPlace };
}

// Find the World Cup champion by looking at the FINAL fixture's winner.
// Returns null if the final hasn't been played (or wasn't decided) yet.
export function resolveChampion(
  matches: FDMatch[] | null,
): import("@/lib/worldcup").Team | null {
  if (!matches || matches.length === 0) return null;
  const finals = matches.filter((m) => STAGE_TO_ROUND_SHORT[m.stage] === "FINAL");
  if (finals.length === 0) return null;
  // Pick the latest by date (there's only one, but be defensive).
  finals.sort(
    (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime(),
  );
  const final = finals[0];
  if (final.status !== "FINISHED") return null;
  if (final.score.winner === "HOME_TEAM") return findLocalTeam(final.homeTeam);
  if (final.score.winner === "AWAY_TEAM") return findLocalTeam(final.awayTeam);
  return null;
}

// The losing finalist. Null until the final has been played and decided.
export function resolveRunnerUp(matches: FDMatch[] | null): Team | null {
  if (!matches || matches.length === 0) return null;
  const finals = matches.filter((m) => STAGE_TO_ROUND_SHORT[m.stage] === "FINAL");
  if (finals.length === 0) return null;
  finals.sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
  const final = finals[0];
  if (final.status !== "FINISHED") return null;
  // The runner-up is the finalist that didn't win (winner via football-data's
  // score.winner, which accounts for extra time / penalties).
  if (final.score.winner === "HOME_TEAM") return findLocalTeam(final.awayTeam);
  if (final.score.winner === "AWAY_TEAM") return findLocalTeam(final.homeTeam);
  return null;
}

// Winner of the third-place play-off. Null until it's been played and decided.
export function resolveThirdPlace(matches: FDMatch[] | null): Team | null {
  if (!matches || matches.length === 0) return null;
  const games = matches.filter((m) => STAGE_TO_ROUND_SHORT[m.stage] === "THIRD");
  if (games.length === 0) return null;
  games.sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
  const g = games[0];
  if (g.status !== "FINISHED") return null;
  if (g.score.winner === "HOME_TEAM") return findLocalTeam(g.homeTeam);
  if (g.score.winner === "AWAY_TEAM") return findLocalTeam(g.awayTeam);
  return null;
}

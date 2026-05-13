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

export type ResolvedGroup = Group & {
  rows: GroupRow[] | null; // null → no live data yet
};

// Compute group standings from finished group-stage matches.
// (The /standings endpoint on the free tier returns a single 48-team aggregate
// without group breakdown, so we derive standings ourselves.)
export function resolveGroups(matches: FDMatch[] | null): ResolvedGroup[] {
  if (!matches) return GROUPS.map((g) => ({ ...g, rows: null }));

  return GROUPS.map((g) => {
    const groupKey = `GROUP_${g.letter}`;
    const groupMatches = matches.filter(
      (m) => m.stage === "GROUP_STAGE" && m.group === groupKey,
    );

    if (groupMatches.length === 0) return { ...g, rows: null };

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

    if (!anyPlayed) return { ...g, rows: null };

    const rows = Array.from(stats.values())
      .map((r) => ({ ...r, gd: r.gf - r.ga }))
      // FIFA tiebreak (subset): points → goal difference → goals for
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      })
      .map((r, i) => ({ ...r, position: i + 1 }));

    return { ...g, rows };
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
      } satisfies Match;
    });

    return { ...round, matches: newMatches };
  });

  const thirdLive = (buckets["THIRD"] ?? [])[0];
  const thirdPlace = thirdLive
    ? {
        ...THIRD_PLACE_MATCH,
        date: thirdLive.utcDate,
        slot1: slotFromFD(thirdLive.homeTeam, THIRD_PLACE_MATCH.slot1),
        slot2: slotFromFD(thirdLive.awayTeam, THIRD_PLACE_MATCH.slot2),
      }
    : THIRD_PLACE_MATCH;

  return { rounds, thirdPlace };
}

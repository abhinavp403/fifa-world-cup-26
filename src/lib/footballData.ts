// Minimal client for football-data.org v4 — only the bits we need.

const BASE = "https://api.football-data.org/v4";

export type FDTeam = {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;     // 3-letter abbrev
  crest?: string;
};

export type FDStandingRow = {
  position: number;
  team: FDTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type FDStandingGroup = {
  stage: string;     // "GROUP_STAGE"
  type: string;      // "TOTAL"
  group: string | null; // e.g. "GROUP_A"
  table: FDStandingRow[];
};

export type FDMatch = {
  id: number;
  utcDate: string;
  status: string;        // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage: string;         // GROUP_STAGE | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL | THIRD_PLACE | LAST_32
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    // fullTime folds in penalty-shootout goals; regularTime/extraTime give the
    // pre-shootout result.
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
    extraTime?: { home: number | null; away: number | null };
  };
};

export type FDResponse<T> = T;

async function fd<T>(path: string): Promise<T | null> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Auth-Token": key },
      // Server-side cache for 5 min — Next will revalidate
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn(`[football-data] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[football-data] ${path} failed:`, err);
    return null;
  }
}

// ── Public helpers ─────────────────────────────────────────────────────────

export async function getStandings(season = 2026) {
  const data = await fd<{ standings: FDStandingGroup[] }>(
    `/competitions/WC/standings?season=${season}`,
  );
  return data?.standings ?? null;
}

export async function getMatches(season = 2026) {
  const data = await fd<{ matches: FDMatch[] }>(
    `/competitions/WC/matches?season=${season}`,
  );
  return data?.matches ?? null;
}

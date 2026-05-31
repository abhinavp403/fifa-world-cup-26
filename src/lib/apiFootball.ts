// Client for api-football.com v3 (free tier: 100 req/day).
// Docs: https://www.api-football.com/documentation-v3

const BASE = "https://v3.football.api-sports.io";

// Premier League competition id in API-Football.
export const PL_LEAGUE_ID = 39;

// FIFA World Cup competition id in API-Football.
export const WC_LEAGUE_ID = 1;

// Common team ids we care about.
export const TEAM_IDS = {
  manCity: 50,
  crystalPalace: 52,
} as const;

async function af<T>(path: string): Promise<T | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": key },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn(`[api-football] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    const json = (await res.json()) as { response: T; errors?: unknown };
    if (json.errors && Object.keys(json.errors as object).length > 0) {
      console.warn(`[api-football] ${path} errors:`, json.errors);
    }
    return json.response;
  } catch (err) {
    console.warn(`[api-football] ${path} failed:`, err);
    return null;
  }
}

// ── Types (subset of api-football responses) ───────────────────────────────

export type AFFixtureSummary = {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null; city: string | null };
    status: { short: string; long: string };
  };
  league: { id: number; name: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
};

export type AFEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: "Goal" | "Card" | "subst" | "Var" | string;
  detail: string; // "Normal Goal" | "Yellow Card" | "Red Card" | "Substitution 1" | ...
  comments: string | null;
};

export type AFStatistic = {
  team: { id: number; name: string; logo: string };
  statistics: Array<{ type: string; value: number | string | null }>;
};

export type AFLineupPlayer = {
  player: {
    id: number;
    name: string;
    number: number;
    pos: "G" | "D" | "M" | "F";
    grid: string | null; // "row:col" — row 1 is GK
  };
};

export type AFLineup = {
  team: { id: number; name: string };
  formation: string;
  startXI: AFLineupPlayer[];
  substitutes: AFLineupPlayer[];
};

export type AFPlayerStats = {
  team: { id: number; name: string };
  players: Array<{
    player: { id: number; name: string };
    statistics: Array<{
      games: {
        minutes: number | null;
        number: number | null;
        position: string | null;
        rating: string | null;
        captain: boolean;
        substitute: boolean;
      };
      shots: { total: number | null; on: number | null };
      goals: {
        total: number | null;
        assists: number | null;
        saves: number | null;
        conceded: number | null;
      };
      passes: { total: number | null; key: number | null; accuracy: number | string | null };
      penalty?: {
        won: number | null;
        commited: number | null;
        scored: number | null;
        missed: number | null;
        saved: number | null;
      };
      tackles: { total: number | null; interceptions: number | null };
      duels: { total: number | null; won: number | null };
      dribbles: { attempts: number | null; success: number | null };
      fouls: { drawn: number | null; committed: number | null };
      offsides: number | null;
      cards: { yellow: number; red: number };
    }>;
  }>;
};

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Find the most recent fixture between two teams (default: Man City vs Palace,
 * Premier League). Returns the fixture id and summary.
 */
export async function getLatestH2H(
  teamA = TEAM_IDS.manCity,
  teamB = TEAM_IDS.crystalPalace,
): Promise<AFFixtureSummary | null> {
  // Free plan blocks last/next params, so we fetch the full h2h and sort.
  const res = await af<AFFixtureSummary[]>(
    `/fixtures/headtohead?h2h=${teamA}-${teamB}`,
  );
  if (!res || res.length === 0) return null;

  // Sort newest first.
  const sorted = [...res].sort(
    (a, b) =>
      new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime(),
  );

  // Prefer the most recent finished match; fall back to any.
  return sorted.find((f) => f.fixture.status.short === "FT") ?? sorted[0];
}

export async function getFixture(id: number) {
  const res = await af<AFFixtureSummary[]>(`/fixtures?id=${id}`);
  return res?.[0] ?? null;
}

export async function getFixtureEvents(id: number) {
  return await af<AFEvent[]>(`/fixtures/events?fixture=${id}`);
}

export async function getFixtureStatistics(id: number) {
  return await af<AFStatistic[]>(`/fixtures/statistics?fixture=${id}`);
}

export async function getFixtureLineups(id: number) {
  return await af<AFLineup[]>(`/fixtures/lineups?fixture=${id}`);
}

export async function getFixturePlayers(id: number) {
  return await af<AFPlayerStats[]>(`/fixtures/players?fixture=${id}`);
}

/**
 * List every finished fixture in a league/season — used to drive
 * tournament-wide aggregations (possession, corners).
 */
export async function getFinishedLeagueFixtures(leagueId: number, season: number) {
  return await af<AFFixtureSummary[]>(
    `/fixtures?league=${leagueId}&season=${season}&status=FT`,
  );
}

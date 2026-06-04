// Client for sportapi7 (Sofascore data) on RapidAPI.
// Used as an alternative match-analytics source to api-football — the free
// api-football plan can't read World Cup 2026, but sportapi7 covers it and
// returns richer per-player data (ratings, xG, ball carries).
//
// Docs (informal): https://rapidapi.com/fluis.lacasse/api/sportapi7
// Endpoints used here, all keyed by a Sofascore "event" id:
//   /api/v1/event/{id}             → score, teams, venue, status, round
//   /api/v1/event/{id}/statistics  → team-level stat groups
//   /api/v1/event/{id}/lineups     → formation + per-player statistics
//   /api/v1/event/{id}/incidents   → goals, cards, substitutions

const HOST = "sportapi7.p.rapidapi.com";
const BASE = `https://${HOST}/api/v1`;

async function s7<T>(path: string): Promise<T | null> {
  const key = process.env.RAPID_API_KEY;
  if (!key) {
    console.warn("[sportapi7] RAPID_API_KEY not set");
    return null;
  }
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn(`[sportapi7] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[sportapi7] ${path} failed:`, err);
    return null;
  }
}

// ── Types (subset of sportapi7 responses) ──────────────────────────────────

export type S7Player = {
  id: number;
  name: string;
  position?: "G" | "D" | "M" | "F";
  jerseyNumber?: string;
};

export type S7Team = { id: number; name: string };

export type S7Event = {
  id: number;
  homeTeam: S7Team;
  awayTeam: S7Team;
  homeScore: { current?: number };
  awayScore: { current?: number };
  status: { type: string; description: string };
  startTimestamp: number;
  tournament: { name: string };
  roundInfo?: { round?: number };
  venue?: { stadium?: { name?: string } };
};

export type S7StatItem = {
  key: string;
  name: string;
  homeValue?: number;
  awayValue?: number;
};
export type S7StatGroup = { groupName: string; statisticsItems: S7StatItem[] };
export type S7StatPeriod = { period: string; groups: S7StatGroup[] };

// Per-player statistics are an open bag of optional numeric counters.
export type S7PlayerStats = Record<string, number>;

export type S7LineupPlayer = {
  player: S7Player;
  shirtNumber?: number;
  position?: "G" | "D" | "M" | "F";
  substitute: boolean;
  statistics?: S7PlayerStats;
};
export type S7LineupSide = {
  formation?: string;
  players: S7LineupPlayer[];
};
export type S7Lineups = {
  confirmed?: boolean;
  home: S7LineupSide;
  away: S7LineupSide;
};

export type S7Incident = {
  incidentType: "goal" | "card" | "substitution" | "period" | "injuryTime";
  time?: number;
  addedTime?: number;
  isHome?: boolean;
  // goal
  player?: S7Player;
  assist1?: S7Player;
  goalType?: string;
  // card
  incidentClass?: string; // "yellow" | "red" | "yellowRed" | …
  // substitution
  playerIn?: S7Player;
  playerOut?: S7Player;
};

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function getS7Event(id: number) {
  const json = await s7<{ event: S7Event }>(`event/${id}`);
  return json?.event ?? null;
}

export async function getS7Statistics(id: number) {
  const json = await s7<{ statistics: S7StatPeriod[] }>(`event/${id}/statistics`);
  return json?.statistics ?? null;
}

export async function getS7Lineups(id: number) {
  return s7<S7Lineups>(`event/${id}/lineups`);
}

export async function getS7Incidents(id: number) {
  const json = await s7<{ incidents: S7Incident[] }>(`event/${id}/incidents`);
  return json?.incidents ?? null;
}

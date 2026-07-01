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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The free RapidAPI tier rate-limits bursts (the stats sync fans out ~24
// requests at once), so a single 429 would silently drop a whole fixture.
// Retry 429s with exponential backoff, honoring Retry-After when present.
const MAX_RETRIES = 4;

async function s7<T>(path: string): Promise<T | null> {
  const key = process.env.RAPID_API_KEY;
  if (!key) {
    console.warn("[sportapi7] RAPID_API_KEY not set");
    return null;
  }
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
        next: { revalidate: 300 },
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s
        console.warn(`[sportapi7] ${path} → 429, retrying in ${delay}ms (attempt ${attempt + 1})`);
        await sleep(delay);
        continue;
      }
      if (!res.ok) {
        console.warn(`[sportapi7] ${path} → ${res.status} ${res.statusText}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      console.warn(`[sportapi7] ${path} failed:`, err);
      return null;
    }
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
  // `current` includes penalty-shootout goals; `display`/`normaltime` is the
  // 1-1-style result, and `penalties` is the shootout score.
  homeScore: { current?: number; display?: number; normaltime?: number; penalties?: number };
  awayScore: { current?: number; display?: number; normaltime?: number; penalties?: number };
  status: { type: string; description: string };
  startTimestamp: number;
  tournament: { name: string };
  roundInfo?: { round?: number };
  venue?: { stadium?: { name?: string }; name?: string };
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

// Match momentum ("attack pressure") graph — per-minute signed values where
// positive = home pressure, negative = away. Not available for every match.
export type S7GraphPoint = { minute: number; value: number };
export async function getS7Graph(id: number) {
  const json = await s7<{ graphPoints: S7GraphPoint[] }>(`event/${id}/graph`);
  return json?.graphPoints ?? null;
}

// Best (highest-rated) player per side — used to surface the man of the match.
export type S7BestPlayer = {
  player: { id: number; name: string; position?: string };
  value: string; // rating, as a string e.g. "8.8"
  label: string; // "rating"
};
export type S7BestPlayers = {
  bestHomeTeamPlayer?: S7BestPlayer;
  bestAwayTeamPlayer?: S7BestPlayer;
};

export async function getS7BestPlayers(id: number) {
  return s7<S7BestPlayers>(`event/${id}/best-players`);
}

// ── World Cup 2026 fixtures (Sofascore unique-tournament 16, season 58210) ──
// Used to attach a Sofascore event id to each dashboard match so the analytics
// modal can fetch real per-match data (stats/lineups/incidents).
const S7_WC_TOURNAMENT = 16;
const S7_WC_SEASON_2026 = 58210;

export type S7WorldCupEvent = {
  id: number;
  home: string;
  away: string;
  startTimestamp: number;
  statusType: string; // "finished" | "inprogress" | "notstarted" | …
  stadium: string | null;
};

export async function getS7WorldCupEvents(): Promise<S7WorldCupEvent[]> {
  const base = `unique-tournament/${S7_WC_TOURNAMENT}/season/${S7_WC_SEASON_2026}/events`;
  // `last` = played/in-progress (most recent first), `next` = upcoming. Paginate
  // a few pages each way so all played fixtures are covered as the tournament
  // grows (a single page caps at ~30 events).
  const pages = await Promise.all([
    s7<{ events: S7Event[] }>(`${base}/last/0`),
    s7<{ events: S7Event[] }>(`${base}/last/1`),
    s7<{ events: S7Event[] }>(`${base}/last/2`),
    s7<{ events: S7Event[] }>(`${base}/next/0`),
    s7<{ events: S7Event[] }>(`${base}/next/1`),
  ]);
  const out: S7WorldCupEvent[] = [];
  const seen = new Set<number>();
  for (const page of pages) {
    for (const e of page?.events ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        home: e.homeTeam.name,
        away: e.awayTeam.name,
        startTimestamp: e.startTimestamp,
        statusType: e.status?.type ?? "",
        stadium: e.venue?.stadium?.name ?? e.venue?.name ?? null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Squad data source — Supabase-backed with static fallback.
//
// getSquads() returns the SAME shape the app already uses
// (Record<string, Squad>), so components don't change their data model.
//
//   • If Supabase env vars are set  → read from the database (cached 5 min).
//   • Otherwise                     → fall back to the static SQUADS in
//                                     src/lib/squads.ts.
//
// This means the app keeps working before, during, and after the migration:
// connect Supabase whenever you're ready and the source flips automatically.
//
// Server-only: relies on fetch caching + env vars. Call it from Server
// Components / route handlers, then pass the result down to client components.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import {
  SQUADS as STATIC_SQUADS,
  type Squad,
  type SquadPlayer,
  type PlayerStats,
} from "@/lib/squads";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const squadsSource: "supabase" | "static" =
  SUPABASE_URL && SUPABASE_ANON ? "supabase" : "static";

type TeamRow   = { code: string; coach: string };
type PlayerRow = {
  team_code: string;
  name: string;
  number: number;
  position: SquadPlayer["position"];
  club: string;
  age: number;
  captain: boolean;
  photo: string | null;
  stats: PlayerStats | null;
};

async function rest<T>(path: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      // Next.js caches this for 5 minutes; updates in the DB appear within
      // that window without a redeploy.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn(`[squadsData] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[squadsData] ${path} failed:`, err);
    return null;
  }
}

/**
 * Returns the full squad map keyed by team code. Falls back to the static
 * file if Supabase isn't configured or a fetch fails — never throws.
 */
export async function getSquads(): Promise<Record<string, Squad>> {
  if (squadsSource === "static") return STATIC_SQUADS;

  const [teams, players] = await Promise.all([
    rest<TeamRow[]>("teams?select=code,coach"),
    rest<PlayerRow[]>(
      "players?select=team_code,name,number,position,club,age,captain,photo,stats&order=team_code,number",
    ),
  ]);

  // Any failure → safe fallback to the bundled data.
  if (!teams || !players || teams.length === 0) {
    console.warn("[squadsData] Supabase returned no data — using static fallback");
    return STATIC_SQUADS;
  }

  const map: Record<string, Squad> = {};
  for (const t of teams) {
    map[t.code] = { coach: t.coach, players: [] };
  }
  for (const p of players) {
    const squad = map[p.team_code];
    if (!squad) continue;
    const player: SquadPlayer = {
      name: p.name,
      number: p.number,
      position: p.position,
      club: p.club,
      age: p.age,
      ...(p.captain ? { captain: true } : {}),
      ...(p.photo ? { photo: p.photo } : {}),
      ...(p.stats ? { stats: p.stats } : {}),
    };
    squad.players.push(player);
  }
  return map;
}

// Per-team aggregated fixture stats (possession, corners, …), written by the
// stats-sync cron into the team_stats table. Read here so /api/worldcup serves
// them instantly instead of fanning out to api-football on every request.
type TeamStatsRow = { team_code: string; data: Record<string, number> };

export async function getTeamFixtureStats(): Promise<
  Record<string, Record<string, number>> | null
> {
  if (squadsSource === "static") return null;
  const rows = await rest<TeamStatsRow[]>("team_stats?select=team_code,data");
  if (!rows || rows.length === 0) return null;
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) out[r.team_code] = r.data;
  return out;
}

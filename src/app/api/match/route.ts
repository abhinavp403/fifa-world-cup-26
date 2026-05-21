// GET /api/match
// Returns the assembled analytics payload for the most recent Man City vs
// Crystal Palace Premier League match (the example match the analytics
// component is built around).
//
// Optional query params:
//   ?id=<fixtureId> to fetch a specific fixture instead.

import { NextResponse } from "next/server";

import {
  getFixture,
  getFixtureEvents,
  getFixtureLineups,
  getFixturePlayers,
  getFixtureStatistics,
  getLatestH2H,
  type AFEvent,
  type AFLineup,
  type AFPlayerStats,
  type AFStatistic,
} from "@/lib/apiFootball";

export const revalidate = 300;

// ── Shape returned to the client ───────────────────────────────────────────

export type TeamSummary = {
  id: number;
  name: string;
  logo: string;
  goals: number;
  shots: number;
  shotsOnTarget: number;
  possession: number;
  passAccuracy: number;
  totalPasses: number;
  keyPasses: number;
  fouls: number;
  corners: number;
  yellowCards: number;
  redCards: number;
  saves: number;
};

export type MatchPlayer = {
  id: number;
  name: string;
  number: number;
  position: string;
  rating: number | null;
  minutes: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  assists: number;
  offsides: number;
  passes: number;
  passAccuracy: number | null;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  dribbles: number;
  duelsWon: number;
  saves: number;
  goalsConceded: number;
  penaltiesSaved: number;
  cards: { yellow: number; red: number };
  substitute: boolean;
};

export type MatchFormationPlayer = {
  id: number;
  name: string;
  number: number;
  pos: "G" | "D" | "M" | "F";
  x: number; // 0–100 (left-right)
  y: number; // 0–100 (own goal → opponent goal)
};

export type MatchSide = {
  team: { id: number; name: string; logo: string };
  stats: TeamSummary;
  formation: string;
  startXI: MatchFormationPlayer[];
  players: MatchPlayer[];
};

export type MatchEvent = {
  minute: number;
  extra: number | null;
  type: "goal" | "yellowCard" | "redCard" | "substitution" | "var" | "other";
  teamId: number;
  player: string;
  assist: string | null;
  detail: string;
};

export type MatchPayload = {
  live: boolean;
  fixtureId: number;
  date: string;
  venue: string | null;
  status: string;
  competition: string;
  round: string;
  home: MatchSide;
  away: MatchSide;
  events: MatchEvent[];
  updatedAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function statNum(stats: AFStatistic | undefined, type: string): number {
  if (!stats) return 0;
  const row = stats.statistics.find((s) => s.type === type);
  if (!row || row.value == null) return 0;
  if (typeof row.value === "number") return row.value;
  // possession comes as "60%"
  const n = parseInt(String(row.value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function buildTeamSummary(
  team: { id: number; name: string; logo: string },
  goals: number,
  stats: AFStatistic | undefined,
): TeamSummary {
  return {
    id: team.id,
    name: team.name,
    logo: team.logo,
    goals,
    shots: statNum(stats, "Total Shots"),
    shotsOnTarget: statNum(stats, "Shots on Goal"),
    possession: statNum(stats, "Ball Possession"),
    passAccuracy: statNum(stats, "Passes %"),
    totalPasses: statNum(stats, "Total passes"),
    keyPasses: 0, // not available at team level; sum from players
    fouls: statNum(stats, "Fouls"),
    corners: statNum(stats, "Corner Kicks"),
    yellowCards: statNum(stats, "Yellow Cards"),
    redCards: statNum(stats, "Red Cards"),
    saves: statNum(stats, "Goalkeeper Saves"),
  };
}

function gridToXY(grid: string | null, pos: "G" | "D" | "M" | "F"): { x: number; y: number } {
  // grid is "row:col" where row 1 = GK, increasing toward opposition.
  // We map row → y (0..100 from own goal upward).
  if (!grid) {
    const yByPos = { G: 8, D: 28, M: 55, F: 82 } as const;
    return { x: 50, y: yByPos[pos] };
  }
  const [rowStr, colStr] = grid.split(":");
  const row = parseInt(rowStr, 10);
  const col = parseInt(colStr, 10);

  // Approximate y by row (1 = own GK, 5+ = striker).
  const yByRow: Record<number, number> = {
    1: 8,
    2: 28,
    3: 48,
    4: 65,
    5: 82,
    6: 88,
  };
  const y = yByRow[row] ?? 50;

  // x: api-football's `col` is 1..N within the row, but we don't know N here.
  // Best effort: assume cols 1..5; for typical PL formations this works.
  // Caller layer normalizes by total in row.
  return { x: 20 + (col - 1) * 15, y };
}

function buildSide(
  fixture: NonNullable<Awaited<ReturnType<typeof getFixture>>>,
  side: "home" | "away",
  stats: AFStatistic[] | null,
  lineups: AFLineup[] | null,
  players: AFPlayerStats[] | null,
): MatchSide {
  const team = fixture.teams[side];
  const goals = fixture.goals[side] ?? 0;
  const teamStats = stats?.find((s) => s.team.id === team.id);
  const teamLineup = lineups?.find((l) => l.team.id === team.id);
  const teamPlayers = players?.find((p) => p.team.id === team.id);

  // Build player list with per-player stats.
  const allPlayers: MatchPlayer[] = (teamPlayers?.players ?? []).map((p) => {
    const s = p.statistics[0];
    const passes = s?.passes.total ?? 0;
    // passes.accuracy is the count of accurate passes, not a percentage — compute it.
    const accuratePasses =
      typeof s?.passes.accuracy === "string"
        ? parseInt(s.passes.accuracy, 10) || null
        : (s?.passes.accuracy as number | null) ?? null;
    const passAcc =
      passes > 0 && accuratePasses != null
        ? Math.round((accuratePasses / passes) * 100)
        : null;

    return {
      id: p.player.id,
      name: p.player.name,
      number: s?.games.number ?? 0,
      position: s?.games.position ?? "?",
      rating: s?.games.rating ? parseFloat(s.games.rating) : null,
      minutes: s?.games.minutes ?? 0,
      shots: s?.shots.total ?? 0,
      shotsOnTarget: s?.shots.on ?? 0,
      goals: s?.goals.total ?? 0,
      assists: s?.goals.assists ?? 0,
      offsides: s?.offsides ?? 0,
      passes,
      passAccuracy: passAcc,
      keyPasses: s?.passes.key ?? 0,
      tackles: s?.tackles.total ?? 0,
      interceptions: s?.tackles.interceptions ?? 0,
      dribbles: s?.dribbles.success ?? 0,
      duelsWon: s?.duels.won ?? 0,
      saves: s?.goals.saves ?? 0,
      goalsConceded: s?.goals.conceded ?? 0,
      penaltiesSaved: s?.penalty?.saved ?? 0,
      cards: { yellow: s?.cards.yellow ?? 0, red: s?.cards.red ?? 0 },
      substitute: s?.games.substitute ?? false,
    };
  });

  // Aggregate key passes for team-level stat.
  const totalKeyPasses = allPlayers.reduce((sum, p) => sum + (p.keyPasses ?? 0), 0);

  const summary = buildTeamSummary(team, goals, teamStats);
  summary.keyPasses = totalKeyPasses;

  // Build formation grid. Normalize col positions within each row.
  const startXIRaw = teamLineup?.startXI ?? [];
  const byRow = new Map<number, typeof startXIRaw>();
  for (const sp of startXIRaw) {
    const row = sp.player.grid ? parseInt(sp.player.grid.split(":")[0], 10) : 0;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(sp);
  }

  const startXI: MatchFormationPlayer[] = [];
  for (const [row, rowPlayers] of byRow) {
    // Sort by col so left/right placement is consistent.
    rowPlayers.sort((a, b) => {
      const ac = a.player.grid ? parseInt(a.player.grid.split(":")[1], 10) : 0;
      const bc = b.player.grid ? parseInt(b.player.grid.split(":")[1], 10) : 0;
      return ac - bc;
    });
    const n = rowPlayers.length;
    // Tighter spacing for narrow rows so 2-/3-player lines don't hug the
    // sidelines. Spread grows with player count, capped at 70% of pitch width.
    const spread = Math.min(70, n * 15 + 5);
    const left = (100 - spread) / 2;
    rowPlayers.forEach((sp, i) => {
      const { y } = gridToXY(sp.player.grid, sp.player.pos);
      const x = n === 1 ? 50 : left + (i * spread) / (n - 1);
      // For away side we flip vertically so own goal is at top.
      const yFlipped = side === "away" ? 100 - y : y;
      startXI.push({
        id: sp.player.id,
        name: sp.player.name,
        number: sp.player.number,
        pos: sp.player.pos,
        x,
        y: yFlipped,
      });
    });
  }
  // Sort top→bottom for stable rendering.
  startXI.sort((a, b) => a.y - b.y);

  return {
    team,
    stats: summary,
    formation: teamLineup?.formation ?? "?",
    startXI,
    players: allPlayers,
  };
}

function classifyEvent(e: AFEvent): MatchEvent["type"] {
  if (e.type === "Goal") return "goal";
  if (e.type === "Card") {
    if (e.detail.toLowerCase().includes("yellow")) return "yellowCard";
    if (e.detail.toLowerCase().includes("red")) return "redCard";
    return "other";
  }
  if (e.type === "subst") return "substitution";
  if (e.type === "Var") return "var";
  return "other";
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");

  const fixture = idParam
    ? await getFixture(parseInt(idParam, 10))
    : await getLatestH2H();

  if (!fixture) {
    return NextResponse.json(
      { live: false, error: "No fixture found", updatedAt: new Date().toISOString() },
      { status: 200 },
    );
  }

  const fixtureId = fixture.fixture.id;

  const [events, stats, lineups, players] = await Promise.all([
    getFixtureEvents(fixtureId),
    getFixtureStatistics(fixtureId),
    getFixtureLineups(fixtureId),
    getFixturePlayers(fixtureId),
  ]);

  const home = buildSide(fixture, "home", stats, lineups, players);
  const away = buildSide(fixture, "away", stats, lineups, players);

  const matchEvents: MatchEvent[] = (events ?? [])
    .map((e) => ({
      minute: e.time.elapsed,
      extra: e.time.extra,
      type: classifyEvent(e),
      teamId: e.team.id,
      player: e.player.name ?? "Unknown",
      assist: e.assist.name,
      detail: e.detail,
    }))
    // Drop noisy "other" entries (substitutions show up nicely; var is too noisy).
    .filter((e) => e.type !== "other" && e.type !== "var");

  const payload: MatchPayload = {
    live: true,
    fixtureId,
    date: fixture.fixture.date,
    venue: fixture.fixture.venue.name,
    status: fixture.fixture.status.short,
    competition: fixture.league.name,
    round: fixture.league.round,
    home,
    away,
    events: matchEvents,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}

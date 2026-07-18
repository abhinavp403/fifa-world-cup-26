// GET /api/worldcup
// Returns live group standings + resolved knockout bracket.
// Falls back to the static proxy data when no API key is configured or
// football-data.org has no matches for the season yet.

import { NextResponse } from "next/server";

import { getMatches } from "@/lib/footballData";
import { findLocalTeam, resolveBracket, resolveChampion, resolveGroups, resolveRunnerUp, resolveThirdPlace } from "@/lib/resolver";
import type { Match } from "@/lib/bracket";
import { getS7WorldCupEvents } from "@/lib/sportApi7";
import { aggregateWorldCupTeamStats } from "@/lib/teamFixtureStats";
import { getTeamFixtureStats } from "@/lib/squadsData";

// Re-cache every 5 minutes server-side; the underlying fetches also use
// `next: { revalidate: 300 }`.
export const revalidate = 300;

export async function GET() {
  // Prefer the DB-cached team stats (written by the sync cron) — instant, no
  // per-request API fan-out. Fall back to live aggregation when the table is
  // empty or Supabase isn't configured.
  const [matches, dbTeamStats, s7events] = await Promise.all([
    getMatches(2026),
    getTeamFixtureStats(),
    getS7WorldCupEvents(),
  ]);
  const teamFixtureStats =
    dbTeamStats ?? (await aggregateWorldCupTeamStats(2026));

  // Both groups and bracket are now derived from the matches feed, since the
  // free-tier /standings endpoint doesn't break out by group.
  const groups = resolveGroups(matches);
  const { rounds, thirdPlace } = resolveBracket(matches);
  const champion = resolveChampion(matches);
  const runnerUp = resolveRunnerUp(matches);
  const thirdPlaceWinner = resolveThirdPlace(matches);

  // Attach a Sofascore event id to each match (keyed by the unordered team-code
  // pair + day) so the analytics modal can load real per-match data. Two teams
  // meet at most once in the group stage, so the pair is a reliable key.
  type S7Pair = { id: number; day: string; stadium: string | null };
  // Some Sofascore knockout events append a city suffix (e.g. "MetLife Stadium
  // · New Jersey"); strip it so the name matches the HOST_CITIES stadium key.
  const baseStadium = (s: string | null) => (s ? s.split("·")[0].trim() : null);
  const s7ByPair = new Map<string, S7Pair[]>();
  for (const ev of s7events) {
    const h = findLocalTeam({ id: 0, name: ev.home });
    const a = findLocalTeam({ id: 0, name: ev.away });
    if (!h || !a) continue;
    const key = [h.code, a.code].sort().join("-");
    const day = new Date(ev.startTimestamp * 1000).toISOString().slice(0, 10);
    const list = s7ByPair.get(key) ?? [];
    list.push({ id: ev.id, day, stadium: baseStadium(ev.stadium) });
    s7ByPair.set(key, list);
  }
  const lookupEvent = (homeCode: string, awayCode: string, utcDate: string): S7Pair | null => {
    const list = s7ByPair.get([homeCode, awayCode].sort().join("-"));
    if (!list || list.length === 0) return null;
    if (list.length === 1) return list[0];
    const day = utcDate.slice(0, 10);
    return list.find((x) => x.day === day) ?? list[0];
  };
  // Only played/in-progress matches get an analytics id — upcoming matches keep
  // fixtureId null so a click shows the simple "not played yet" dialog. The
  // stadium is attached regardless so host-city views can list every match.
  const PLAYED = new Set(["FINISHED", "AWARDED", "IN_PLAY", "PAUSED"]);
  for (const g of groups) {
    for (const m of g.matches ?? []) {
      const ev = lookupEvent(m.homeCode, m.awayCode, m.utcDate);
      m.fixtureId = ev && PLAYED.has(m.status) ? ev.id : null;
      m.stadium = ev?.stadium ?? null;
    }
  }
  // Knockout matches too — once both slots are resolved to real teams.
  const attachToBracket = (m: Match) => {
    const h = m.slot1.team?.code;
    const a = m.slot2.team?.code;
    if (!h || !a) return;
    const ev = lookupEvent(h, a, m.date ?? "");
    if (ev && PLAYED.has(m.status ?? "")) m.fixtureId = ev.id;
    if (ev?.stadium) m.venue = ev.stadium;
  };
  for (const round of rounds) round.matches.forEach(attachToBracket);
  attachToBracket(thirdPlace);

  const live = matches != null;

  return NextResponse.json({
    live,
    updatedAt: new Date().toISOString(),
    groups,
    bracket: rounds,
    thirdPlace,
    champion,
    runnerUp,
    thirdPlaceWinner,
    teamFixtureStats,
  });
}

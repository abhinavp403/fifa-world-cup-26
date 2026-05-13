// GET /api/worldcup
// Returns live group standings + resolved knockout bracket.
// Falls back to the static proxy data when no API key is configured or
// football-data.org has no matches for the season yet.

import { NextResponse } from "next/server";

import { getMatches } from "@/lib/footballData";
import { resolveBracket, resolveGroups } from "@/lib/resolver";

// Re-cache every 5 minutes server-side; the underlying fetches also use
// `next: { revalidate: 300 }`.
export const revalidate = 300;

export async function GET() {
  const matches = await getMatches(2026);

  // Both groups and bracket are now derived from the matches feed, since the
  // free-tier /standings endpoint doesn't break out by group.
  const groups = resolveGroups(matches);
  const { rounds, thirdPlace } = resolveBracket(matches);

  const live = matches != null;

  return NextResponse.json({
    live,
    updatedAt: new Date().toISOString(),
    groups,
    bracket: rounds,
    thirdPlace,
  });
}

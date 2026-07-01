// Backfill durable match-analytics snapshots for every finished fixture.
//
// The match route (/api/match) persists a snapshot the first time a finished
// match is opened; this script just "opens" them all so the whole tournament is
// captured before the Sofascore (RapidAPI) subscription lapses. It hits the
// running app, which builds each payload live and stores it in `match_analytics`.
//
// Usage (with a server running):
//   npm run dev            # in another terminal (serves on :3000)
//   npm run snapshot:matches
//
// Or against production (must have the snapshot code deployed):
//   SNAPSHOT_BASE_URL=https://fifa-world-cup-26-nu.vercel.app npm run snapshot:matches
//
// Idempotent: matches already snapshotted are served from the store (no API call).

import { getS7WorldCupEvents } from "../src/lib/sportApi7";

const BASE = process.env.SNAPSHOT_BASE_URL ?? "http://localhost:3000";

async function main() {
  const events = await getS7WorldCupEvents();
  const finished = events.filter((e) => e.statusType === "finished");
  console.log(`Snapshotting ${finished.length} finished match(es) via ${BASE} …\n`);

  let ok = 0;
  const failures: string[] = [];
  for (const e of finished) {
    try {
      const res = await fetch(`${BASE}/api/match?source=rapidapi&id=${e.id}`);
      const p = await res.json();
      if (p && !p.error && p.home?.players?.length > 0) {
        ok++;
      } else {
        failures.push(`${e.home} v ${e.away} (${e.id}) — ${p?.error ?? "thin payload"}`);
      }
    } catch (err) {
      failures.push(`${e.home} v ${e.away} (${e.id}) — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n✓ ${ok}/${finished.length} snapshotted.`);
  if (failures.length) {
    console.log(`${failures.length} not captured (retry once they're settled / rate limit clears):`);
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exitCode = 1;
  }
}

main();

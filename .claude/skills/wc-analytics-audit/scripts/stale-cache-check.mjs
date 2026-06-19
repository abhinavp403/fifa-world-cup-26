// Scans fixture_stats + team_stats for stale / missing expanded team-stat fields.
// Run from the project root:  node .claude/skills/wc-analytics-audit/scripts/stale-cache-check.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Fields every cached fixture team-line should carry after the stats expansion.
const TEAM_FIELDS = [
  "xg", "clearances", "crosses", "freeKicks", "shotsInsideBox",
  "shotsOutsideBox", "touchesInBox", "tacklesWonPct", "duelsPct", "dribblesPct",
];

const { data: fixtures, error: fxErr } = await sb
  .from("fixture_stats")
  .select("fixture_id,home_code,away_code,data");
if (fxErr) { console.error("fixture_stats read failed:", fxErr.message); process.exit(1); }

const staleIds = [];
for (const r of fixtures ?? []) {
  for (const [code, t] of Object.entries(r.data?.teams ?? {})) {
    const missing = TEAM_FIELDS.filter((k) => t[k] === undefined);
    if (missing.length) {
      staleIds.push(r.fixture_id);
      console.log(`  STALE  ${r.home_code} v ${r.away_code} (${r.fixture_id}) — ${code} missing: ${missing.join(", ")}`);
      break;
    }
  }
}

const { data: ts } = await sb.from("team_stats").select("team_code,data");
const zeroNew = (ts ?? []).filter(
  (r) => r.data?.matches > 0 && !r.data.xg && !r.data.clearances && !r.data.touchesInBox,
);

console.log(`\nCached fixtures: ${fixtures?.length ?? 0} | stale: ${staleIds.length}`);
console.log(`team_stats with matches>0 but empty new stats: ${zeroNew.length}${zeroNew.length ? " -> " + zeroNew.map((r) => r.team_code).join(", ") : ""}`);

if (staleIds.length) {
  const ids = [...new Set(staleIds)];
  console.log("\nTo fix, delete the stale rows then re-sync:");
  console.log(`  // delete: .from("fixture_stats").delete().in("fixture_id", [${ids.join(", ")}])`);
  console.log(`  npm run sync:stats`);
  process.exit(2);
}
console.log("\n✓ Cache is consistent.");

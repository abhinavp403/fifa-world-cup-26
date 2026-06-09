/**
 * One-time (and re-runnable) migration: seed Supabase `teams` + `players`
 * from the static SQUADS in src/lib/squads.ts.
 *
 * Idempotent — upserts on (team_code, name), so running it again just
 * updates existing rows. Safe to re-run after squad edits.
 *
 * Usage:
 *   npm run migrate:squads
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (service_role key — bypasses RLS; NEVER commit)
 */

import { createClient } from "@supabase/supabase-js";
import { SQUADS } from "../src/lib/squads";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "in .env.local, then run: npm run migrate:squads",
  );
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const teamRows = Object.entries(SQUADS).map(([code, squad]) => ({
    code,
    coach: squad.coach,
  }));

  const playerRows = Object.entries(SQUADS).flatMap(([code, squad]) =>
    squad.players.map((p) => ({
      team_code: code,
      name: p.name,
      number: p.number,
      position: p.position,
      club: p.club,
      age: p.age,
      captain: p.captain ?? false,
      photo: p.photo ?? null,
    })),
  );

  console.log(`Upserting ${teamRows.length} teams …`);
  const { error: teamErr } = await supabase
    .from("teams")
    .upsert(teamRows, { onConflict: "code" });
  if (teamErr) throw teamErr;

  console.log(`Upserting ${playerRows.length} players …`);
  // chunk to stay well under any payload limits
  const CHUNK = 500;
  for (let i = 0; i < playerRows.length; i += CHUNK) {
    const slice = playerRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("players")
      .upsert(slice, { onConflict: "team_code,name" });
    if (error) throw error;
    console.log(`  …${Math.min(i + CHUNK, playerRows.length)}/${playerRows.length}`);
  }

  // Prune stale players: a player renamed or removed in squads.ts leaves an
  // orphaned row behind (upsert is purely additive), so a team can drift above
  // 26. For each team, delete rows whose name is no longer in the current
  // squad. Idempotent — a clean DB deletes nothing. We only ever remove
  // genuinely-absent players (matched by name within the team), so rows that
  // simply have no stats yet are untouched.
  console.log("Pruning stale players …");
  let prunedTotal = 0;
  for (const [code, squad] of Object.entries(SQUADS)) {
    const validNames = squad.players.map((p) => p.name);
    const { data: pruned, error: pruneErr } = await supabase
      .from("players")
      .delete()
      .eq("team_code", code)
      .not("name", "in", `(${validNames.map((n) => `"${n.replace(/"/g, '""')}"`).join(",")})`)
      .select("name");
    if (pruneErr) throw pruneErr;
    if (pruned && pruned.length) {
      prunedTotal += pruned.length;
      console.log(`  ${code}: removed ${pruned.length} (${pruned.map((r) => r.name).join(", ")})`);
    }
  }
  console.log(`  …${prunedTotal} stale player(s) removed.`);

  // sanity read-back
  const { count: teamCount } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });
  const { count: playerCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  console.log(
    `\n✓ Done. DB now has ${teamCount} teams, ${playerCount} players.`,
  );
}

main().catch((err) => {
  console.error("Migration failed:", err.message ?? err);
  process.exit(1);
});

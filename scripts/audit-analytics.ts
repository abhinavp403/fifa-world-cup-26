// Audit script: cross-references finished WC Sofascore lineups against the
// Supabase player roster to surface data integrity issues.
// Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/audit-analytics.ts

import { createClient } from "@supabase/supabase-js";
import {
  getS7WorldCupEvents,
  getS7Lineups,
} from "../src/lib/sportApi7";
import { findLocalTeam } from "../src/lib/resolver";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RosterRow = { id: number; team_code: string; name: string; photo: string | null; stats: { appearances?: number } | null };

function sofaIdFromPhoto(photo: string | null | undefined): number | null {
  if (!photo) return null;
  const m = photo.match(/player-photo\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function strip(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const roster: RosterRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select("id, team_code, name, photo, stats")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error("DB error:", error.message); process.exit(1); }
    const rows = (data ?? []) as RosterRow[];
    roster.push(...rows);
    if (rows.length < PAGE) break;
  }

  const bySofaId = new Map<number, RosterRow>();
  const byTeam = new Map<string, RosterRow[]>();
  for (const r of roster) {
    const sid = sofaIdFromPhoto(r.photo);
    if (sid != null) bySofaId.set(sid, r);
    const list = byTeam.get(r.team_code) ?? [];
    list.push(r);
    byTeam.set(r.team_code, list);
  }

  const events = await getS7WorldCupEvents();
  const finished = events.filter(e => e.statusType === "finished");
  console.log(`\nAudit: ${finished.length} finished event(s), ${roster.length} DB roster rows\n`);

  type Issue =
    | { type: "unmatched"; sofaId: number; sofaName: string; teamCode: string; minutes: number }
    | { type: "zero_stats"; dbId: number; dbName: string; teamCode: string; sofaId: number; minutes: number }
    | { type: "photo_mismatch"; dbId: number; dbName: string; teamCode: string; dbSofaId: number | null; lineupSofaId: number };

  const issuesByMatch: { label: string; issues: Issue[] }[] = [];
  const unmatchedByTeam = new Map<string, number>();
  const matchedByTeam = new Map<string, number>();

  for (const ev of finished) {
    const lineups = await getS7Lineups(ev.id);
    const issues: Issue[] = [];

    for (const side of (["home", "away"] as const)) {
      const lineup = lineups?.[side];
      if (!lineup) continue;

      const teamName = side === "home" ? ev.home : ev.away;
      const local = findLocalTeam({ id: 0, name: teamName });
      const teamCode = local?.code ?? teamName;

      for (const lp of lineup.players) {
        const minutes = lp.statistics?.minutesPlayed ?? 0;
        if (minutes === 0) continue;

        const sofaId = lp.player.id;
        const sofaName = lp.player.name;

        const byId = bySofaId.get(sofaId) ?? null;
        if (byId) {
          matchedByTeam.set(teamCode, (matchedByTeam.get(teamCode) ?? 0) + 1);
          if ((byId.stats?.appearances ?? 0) === 0) {
            issues.push({ type: "zero_stats", dbId: byId.id, dbName: byId.name, teamCode, sofaId, minutes });
          }
          continue;
        }

        const candidates = byTeam.get(teamCode) ?? [];
        const target = strip(sofaName);
        const tTokens = new Set(target.split(" ").filter(t => t.length > 2));
        const nameMatch = candidates.find(c => strip(c.name) === target) ??
          candidates.find(c => {
            const cs = strip(c.name);
            const cTokens = new Set(cs.split(" ").filter(t => t.length > 2));
            const overlap = [...tTokens].filter(t => cTokens.has(t));
            return overlap.length >= 1 && (cs.includes(target) || target.includes(cs) || overlap.length >= 2);
          }) ?? null;

        if (nameMatch) {
          matchedByTeam.set(teamCode, (matchedByTeam.get(teamCode) ?? 0) + 1);
          const dbSofaId = sofaIdFromPhoto(nameMatch.photo);
          if (dbSofaId !== sofaId) {
            issues.push({ type: "photo_mismatch", dbId: nameMatch.id, dbName: nameMatch.name, teamCode, dbSofaId, lineupSofaId: sofaId });
          }
          if ((nameMatch.stats?.appearances ?? 0) === 0) {
            issues.push({ type: "zero_stats", dbId: nameMatch.id, dbName: nameMatch.name, teamCode, sofaId, minutes });
          }
        } else {
          unmatchedByTeam.set(teamCode, (unmatchedByTeam.get(teamCode) ?? 0) + 1);
          issues.push({ type: "unmatched", sofaId, sofaName, teamCode, minutes });
        }
      }
    }

    issuesByMatch.push({ label: `${ev.home} vs ${ev.away} (id ${ev.id})`, issues });
  }

  let totalIssues = 0;
  for (const { label, issues } of issuesByMatch) {
    if (issues.length === 0) {
      console.log(`✅  ${label} — no issues`);
      continue;
    }
    console.log(`\n⚠️  ${label}`);
    for (const iss of issues) {
      totalIssues++;
      if (iss.type === "unmatched") {
        console.log(`  ❌ UNMATCHED   [${iss.teamCode}] "${iss.sofaName}" sofa_id=${iss.sofaId} (${iss.minutes}min) — not in DB roster`);
      } else if (iss.type === "zero_stats") {
        console.log(`  ⚪ ZERO STATS  [${iss.teamCode}] "${iss.dbName}" sofa_id=${iss.sofaId} (${iss.minutes}min) — played but stats.appearances=0`);
      } else if (iss.type === "photo_mismatch") {
        console.log(`  🔄 PHOTO MISMATCH [${iss.teamCode}] "${iss.dbName}" db_sofa_id=${iss.dbSofaId} but lineup_sofa_id=${iss.lineupSofaId}`);
      }
    }
  }

  console.log("\n── Team summary ──────────────────────────────────────────────────────────");
  const allTeams = new Set([...unmatchedByTeam.keys(), ...matchedByTeam.keys()]);
  for (const code of [...allTeams].sort()) {
    const matched = matchedByTeam.get(code) ?? 0;
    const unmatched = unmatchedByTeam.get(code) ?? 0;
    const flag = unmatched > 0 ? "⚠️ " : "✅ ";
    console.log(`${flag} ${code.padEnd(4)} matched=${matched} unmatched=${unmatched}`);
  }

  console.log(`\n── Total issues: ${totalIssues} ─────────────────────────────────────────────────\n`);
  if (totalIssues > 0) {
    console.log("Action items:");
    console.log("  • Fix name/photo mismatches in src/lib/squads.ts");
    console.log("  • Run: npm run migrate:squads");
    console.log("  • Run: npm run sync:stats");
  } else {
    console.log("All players matched and stats populated. ✓");
  }
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * Shirt-number correction job.
 *
 * Pulls the authoritative WC 2026 squad numbers from the Wikipedia article
 * "2026 FIFA World Cup squads" (a single, consistently-structured source that
 * lists all 48 teams' 26-man squads with assigned shirt numbers) and reconciles
 * them against the static SQUADS in src/lib/squads.ts.
 *
 * Why Wikipedia and not the sportapi7 squad endpoint?
 *   The API's /team/{id}/players returns each player's *club* jersey number,
 *   which produces duplicates within a national squad (e.g. three France #10s) —
 *   not valid tournament numbering. Wikipedia's squad tables carry the actual
 *   assigned tournament numbers (1–26, unique per squad).
 *
 * Usage:
 *   npm run fix:shirt-numbers          # dry run — report only, no writes
 *   npm run fix:shirt-numbers -- --write   # patch src/lib/squads.ts in place
 *
 * After a --write run, push the corrections to Supabase with:
 *   npm run migrate:squads
 *
 * The write is alignment-preserving (keeps the column padding in squads.ts) and
 * scoped per team block, so re-running is safe and idempotent.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SQUADS } from "../src/lib/squads";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQUADS_FILE = path.join(__dirname, "..", "src", "lib", "squads.ts");
const WRITE = process.argv.includes("--write");

// Wikipedia heading (country name) → our 3-letter team code.
const NAME_TO_CODE: Record<string, string> = {
  "Czech Republic": "CZE", "Mexico": "MEX", "South Africa": "RSA",
  "South Korea": "KOR", "Bosnia and Herzegovina": "BIH", "Canada": "CAN",
  "Qatar": "QAT", "Switzerland": "SUI", "Brazil": "BRA", "Haiti": "HAI",
  "Morocco": "MAR", "Scotland": "SCO", "Australia": "AUS", "Paraguay": "PAR",
  "Turkey": "TUR", "United States": "USA", "Curaçao": "CUW", "Ecuador": "ECU",
  "Germany": "GER", "Ivory Coast": "CIV", "Japan": "JPN", "Netherlands": "NED",
  "Sweden": "SWE", "Tunisia": "TUN", "Belgium": "BEL", "Egypt": "EGY",
  "Iran": "IRN", "New Zealand": "NZL", "Cape Verde": "CPV",
  "Saudi Arabia": "KSA", "Spain": "ESP", "Uruguay": "URU", "France": "FRA",
  "Iraq": "IRQ", "Norway": "NOR", "Senegal": "SEN", "Algeria": "ALG",
  "Argentina": "ARG", "Austria": "AUT", "Jordan": "JOR", "Colombia": "COL",
  "DR Congo": "COD", "Portugal": "POR", "Uzbekistan": "UZB", "Croatia": "CRO",
  "England": "ENG", "Ghana": "GHA", "Panama": "PAN",
};

type WikiPlayer = { no: number; name: string; sortname: string; pos: string };

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Kovar, Matej" → "matej kovar" (normalized). */
function flipSortname(sortname: string): string {
  const [last, first] = sortname.split(",").map((s) => s.trim());
  return strip(`${first ?? ""} ${last ?? ""}`);
}

async function fetchWikitext(): Promise<string> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=parse" +
    "&page=2026_FIFA_World_Cup_squads&prop=wikitext&format=json&formatversion=2";
  const res = await fetch(url, { headers: { "User-Agent": "wc2026-shirtfix/1.0" } });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { parse?: { wikitext?: string } };
  const wt = json.parse?.wikitext;
  if (!wt) throw new Error("Wikipedia returned no wikitext");
  return wt;
}

/** Parse the wikitext into { country heading → WikiPlayer[] }. */
function parseSquads(wt: string): Map<string, WikiPlayer[]> {
  const out = new Map<string, WikiPlayer[]>();

  // Split into sections by level-3 headings (=== Country ===).
  const parts = wt.split(/^===\s*([^=]+?)\s*===\s*$/m);
  // parts = [preamble, heading1, body1, heading2, body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const code = NAME_TO_CODE[heading];
    if (!code) continue; // skip non-team sections (Age, representation, …)
    const body = parts[i + 1] ?? "";

    const players: WikiPlayer[] = [];
    // Split the section into per-player chunks, then pull each field with a
    // targeted regex. (A single positional regex breaks on piped wikilinks
    // like name=[[Alisson Becker|Alisson]], where the pipe is *inside* name.)
    const chunks = body.split(/\{\{nat fs g player/i).slice(1);
    for (const raw of chunks) {
      const chunk = raw.split(/\{\{nat fs (?:g )?end/i)[0]; // stop at section end
      const no = chunk.match(/\|\s*no=(\d+)/)?.[1];
      const pos = chunk.match(/\|\s*pos=([A-Z]{2})/i)?.[1];
      const sortname = chunk.match(/\|\s*sortname=([^|}\n]+)/)?.[1]?.trim() ?? "";
      const nameRaw = chunk.match(/\|\s*name=([^\n]+?)\s*(?:\||\}\})/)?.[1] ?? "";
      if (!no || !pos) continue;
      // name=[[Target|Display]] | [[Name]] | plain text; prefer display.
      let name = nameRaw;
      const link = name.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
      if (link) name = (link[2] ?? link[1]).trim();
      name = name.replace(/\s*\(c\)\s*$/i, "").trim();
      players.push({ no: parseInt(no, 10), name, sortname, pos: pos.toUpperCase() });
    }
    if (players.length > 0) out.set(code, players);
  }
  return out;
}

const tok = (s: string) => s.split(" ").filter((t) => t.length > 1);

/** Score how well a squads.ts name matches a wiki player. 0 = no match. */
function scorePair(localName: string, w: WikiPlayer): number {
  const target = strip(localName);
  const tTokens = new Set(tok(target));
  const cand = strip(w.name);
  const candFlip = flipSortname(w.sortname);
  // sortname is "Surname, First" in ASCII — the most stable matching key.
  const [sLast, sFirst] = w.sortname.split(",").map((x) => strip(x));
  const surname = sLast ?? "";
  const first = sFirst ?? "";
  const cTokens = new Set(tok(`${cand} ${candFlip} ${surname} ${first}`));

  if (cand === target || candFlip === target) return 100;

  const overlap = [...tTokens].filter((t) => cTokens.has(t)).length;
  const surnameHit =
    !!surname && (tTokens.has(surname) || target.endsWith(surname) || target.includes(` ${surname}`));
  const firstHit = !!first && tTokens.has(first);
  const contains =
    (cand.length > 3 && (cand.includes(target) || target.includes(cand))) ||
    (candFlip.length > 3 && (candFlip.includes(target) || target.includes(candFlip)));

  let score = overlap * 10;
  if (surnameHit) score += 8;
  if (firstHit) score += 5;
  if (contains) score += 6;
  // Require a real signal: surname+first, two tokens, or surname+contains.
  const strong =
    (surnameHit && firstHit) || overlap >= 2 || (surnameHit && contains) ||
    (overlap >= 1 && contains);
  return strong ? score : 0;
}

/**
 * One-to-one match of a team's squads.ts players to wiki players: score every
 * pair, then assign greedily from highest score down, using each wiki entry
 * at most once. Prevents two locals grabbing the same number.
 */
function matchTeam(
  locals: { name: string; number: number }[],
  wiki: WikiPlayer[],
): { byLocalName: Map<string, WikiPlayer>; unmatched: string[] } {
  type Pair = { li: number; wi: number; score: number };
  const pairs: Pair[] = [];
  locals.forEach((l, li) =>
    wiki.forEach((w, wi) => {
      const score = scorePair(l.name, w);
      if (score > 0) pairs.push({ li, wi, score });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);

  const usedLocal = new Set<number>();
  const usedWiki = new Set<number>();
  const byLocalName = new Map<string, WikiPlayer>();
  for (const p of pairs) {
    if (usedLocal.has(p.li) || usedWiki.has(p.wi)) continue;
    usedLocal.add(p.li);
    usedWiki.add(p.wi);
    byLocalName.set(locals[p.li].name, wiki[p.wi]);
  }

  // Post-pass: unique-surname rescue. For each still-unmatched local, if its
  // surname (last name token) matches exactly one still-unmatched wiki player's
  // surname, accept it — a unique surname within a 26-man squad is a confident
  // signal even when the first name is spelled/romanized differently
  // (e.g. "Alejandro Grimaldo" ↔ sortname "Grimaldo, Alex").
  const wikiSurname = (w: WikiPlayer) =>
    strip(w.sortname.split(",")[0] || w.name).split(" ").pop() ?? "";
  const localSurname = (name: string) => strip(name).split(" ").filter((t) => t.length > 2).pop() ?? "";
  for (let li = 0; li < locals.length; li++) {
    if (usedLocal.has(li)) continue;
    const sn = localSurname(locals[li].name);
    if (sn.length < 3) continue;
    const cands = wiki
      .map((w, wi) => ({ w, wi }))
      .filter(({ wi, w }) => !usedWiki.has(wi) && wikiSurname(w) === sn);
    if (cands.length === 1) {
      usedLocal.add(li);
      usedWiki.add(cands[0].wi);
      byLocalName.set(locals[li].name, cands[0].w);
    }
  }

  const unmatched = locals.filter((_, li) => !usedLocal.has(li)).map((l) => l.name);
  return { byLocalName, unmatched };
}

type Correction = { name: string; oldNo: number; newNo: number; kind: "match" | "reassign" };

function reconcile(wikiByCode: Map<string, WikiPlayer[]>) {
  const found: {
    code: string;
    corrections: Correction[];
    already: number;
    matched: number;
    unmatched: string[];
    reassigned: { name: string; from: number; to: number }[];
  }[] = [];
  const notFound: string[] = [];

  for (const [code, squad] of Object.entries(SQUADS)) {
    const wiki = wikiByCode.get(code);
    if (!wiki || wiki.length === 0) {
      notFound.push(code);
      continue;
    }
    const { byLocalName, unmatched } = matchTeam(squad.players, wiki);

    // ── Assign a final, collision-free number to every local player ──
    const used = new Set<number>();
    const finalNo = new Map<string, number>();
    let matched = 0;
    let already = 0;

    // (1) matched players take their confirmed wiki number (all unique).
    for (const p of squad.players) {
      const w = byLocalName.get(p.name);
      if (!w) continue;
      matched += 1;
      finalNo.set(p.name, w.no);
      used.add(w.no);
      if (w.no === p.number) already += 1;
    }

    // Free numbers (1–26) not taken by a matched player, tagged with the
    // position of the wiki player who owns them — so a best-effort reassign
    // can prefer a same-position slot.
    const takenByMatch = new Set(used);
    const freePool = wiki
      .filter((w) => !takenByMatch.has(w.no))
      .map((w) => ({ no: w.no, pos: w.pos }));

    // (2) unmatched players: keep their number if free, else reassign to a
    // free slot (same position preferred) so the squad has no duplicates.
    const reassigned: { name: string; from: number; to: number }[] = [];
    const posMap: Record<string, string> = { GK: "GK", DF: "DEF", MF: "MID", FW: "FWD" };
    for (const p of squad.players) {
      if (byLocalName.has(p.name)) continue;
      if (!used.has(p.number)) {
        finalNo.set(p.name, p.number); // no collision — leave as-is
        used.add(p.number);
        continue;
      }
      // collision → pick a free number, same position first
      let pick =
        freePool.find((f) => !used.has(f.no) && posMap[f.pos] === p.position)?.no ??
        freePool.find((f) => !used.has(f.no))?.no;
      if (pick == null) {
        // pool exhausted: smallest unused integer (rare)
        let n = 1;
        while (used.has(n)) n += 1;
        pick = n;
      }
      finalNo.set(p.name, pick);
      used.add(pick);
      reassigned.push({ name: p.name, from: p.number, to: pick });
    }

    // (3) corrections = any player whose final number differs from current.
    const corrections: Correction[] = [];
    for (const p of squad.players) {
      const nn = finalNo.get(p.name);
      if (nn == null || nn === p.number) continue;
      corrections.push({
        name: p.name,
        oldNo: p.number,
        newNo: nn,
        kind: byLocalName.has(p.name) ? "match" : "reassign",
      });
    }

    found.push({ code, corrections, already, matched, unmatched, reassigned });
  }
  return { found, notFound };
}

/** Alignment-preserving, team-scoped patch of squads.ts. */
function applyCorrections(
  found: ReturnType<typeof reconcile>["found"],
): { patched: number; failed: { code: string; name: string }[] } {
  let text = fs.readFileSync(SQUADS_FILE, "utf8");
  let patched = 0;
  const failed: { code: string; name: string }[] = [];

  for (const { code, corrections } of found) {
    if (corrections.length === 0) continue;

    // Locate this team's block: from "\n  CODE: {" to the next "\n  XXX: {".
    const blockStart = text.search(new RegExp(`\\n  ${code}: \\{`));
    if (blockStart === -1) {
      corrections.forEach((c) => failed.push({ code, name: c.name }));
      continue;
    }
    const after = text.slice(blockStart + 1);
    const nextTeam = after.search(/\n  [A-Z]{3}: \{/);
    const blockEnd = nextTeam === -1 ? text.length : blockStart + 1 + nextTeam;

    for (const c of corrections) {
      let block = text.slice(blockStart, blockEnd);
      const nameIdx = block.indexOf(`name: "${c.name}"`);
      if (nameIdx === -1) {
        failed.push({ code, name: c.name });
        continue;
      }
      // Replace the next `number: <d>,<spaces>position:` after the name,
      // keeping the chunk's total width constant so columns stay aligned.
      const rest = block.slice(nameIdx);
      const numRe = /number: (\d+),( +)(?=position:)/;
      const mm = rest.match(numRe);
      if (!mm || mm.index == null) {
        failed.push({ code, name: c.name });
        continue;
      }
      const oldDigits = mm[1];
      const spaces = mm[2];
      const newDigits = String(c.newNo);
      const delta = oldDigits.length - newDigits.length;
      const newSpaces = " ".repeat(Math.max(1, spaces.length + delta));
      const replacement = `number: ${newDigits},${newSpaces}`;
      const absIdx = blockStart + nameIdx + mm.index;
      text = text.slice(0, absIdx) + replacement + text.slice(absIdx + mm[0].length);
      patched += 1;
      // recompute blockEnd shift is unnecessary: same-length replacement.
    }
  }

  fs.writeFileSync(SQUADS_FILE, text, "utf8");
  return { patched, failed };
}

async function main() {
  console.log(`\nShirt-number correction job  (${WRITE ? "WRITE" : "DRY RUN"})\n`);
  const wt = await fetchWikitext();
  const wikiByCode = parseSquads(wt);
  console.log(`Parsed ${wikiByCode.size} team squads from Wikipedia.\n`);

  const { found, notFound } = reconcile(wikiByCode);

  // ── Per-team report ──
  let totalMatchFixes = 0;
  let totalReassign = 0;
  const reviewTeams: string[] = [];
  console.log("FOUND (matched against Wikipedia):");
  for (const f of found.sort((a, b) => a.code.localeCompare(b.code))) {
    const matchFixes = f.corrections.filter((c) => c.kind === "match").length;
    totalMatchFixes += matchFixes;
    totalReassign += f.reassigned.length;
    if (f.unmatched.length >= 4) reviewTeams.push(f.code);
    const reNote = f.reassigned.length ? `  ↻ ${f.reassigned.length} reassigned` : "";
    const unmNote = f.unmatched.length ? `  ⚠ ${f.unmatched.length} unmatched: ${f.unmatched.join(", ")}` : "";
    console.log(
      `  ${f.code}  ${String(f.matched).padStart(2)}/${f.matched + f.unmatched.length} matched · ` +
        `${String(matchFixes).padStart(2)} numbers fixed${reNote}${unmNote}`,
    );
  }

  console.log(`\nNOT FOUND (no Wikipedia squad matched):`);
  console.log(notFound.length ? `  ${notFound.join(", ")}` : "  (none — all 48 teams matched)");

  console.log(
    `\nSummary: ${found.length}/48 teams found, ${notFound.length} not found.\n` +
      `  ${totalMatchFixes} confirmed-number fixes, ` +
      `${totalReassign} collision reassignments (best-effort, flagged below).`,
  );
  console.log(
    `\nTeams with ≥4 unmatched players (rosters likely diverge from confirmed squad — review):\n` +
      `  ${reviewTeams.length ? reviewTeams.join(", ") : "(none)"}`,
  );

  // ── List the best-effort reassignments (these are the ones to eyeball) ──
  const allReassign = found.flatMap((f) =>
    f.reassigned.map((r) => `  ${f.code}  ${r.name}: ${r.from} → ${r.to} (best-effort)`),
  );
  if (allReassign.length) {
    console.log(`\nCollision reassignments (player not name-matched; number is best-effort):`);
    allReassign.forEach((l) => console.log(l));
  }

  if (WRITE) {
    const { patched, failed } = applyCorrections(found);
    console.log(`\n✓ Patched ${patched} numbers in src/lib/squads.ts.`);
    if (failed.length) {
      console.log(`⚠ Could not patch ${failed.length}:`);
      failed.forEach((f) => console.log(`    ${f.code} ${f.name}`));
    }
    console.log(`\nNext: push to Supabase with  npm run migrate:squads`);
  } else {
    console.log(`\n(dry run — no files changed. Re-run with --write to apply.)`);
  }
}

main().catch((err) => {
  console.error("Job failed:", err?.message ?? err);
  process.exit(1);
});

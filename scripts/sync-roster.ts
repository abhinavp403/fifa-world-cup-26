/**
 * Roster sync — rebuild a team's players array from the confirmed Wikipedia
 * squad ("2026 FIFA World Cup squads"), for teams whose squads.ts roster drifted
 * from the real squad (projected picks that never made the final 26).
 *
 * For each confirmed player it reuses the existing squads.ts photo when the
 * player is already present (matched by name), and otherwise fetches+verifies a
 * Sofascore photo id (club must match, else the photo is omitted rather than
 * risk a wrong face). Club names are lightly normalized to squads.ts style.
 *
 * Usage:
 *   npm run sync:roster -- --codes SEN,PAR,JOR,UZB,TUR,EGY        # dry run
 *   npm run sync:roster -- --codes SEN,PAR,JOR,UZB,TUR,EGY --write
 * Then: npm run migrate:squads
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SQUADS } from "../src/lib/squads";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "src", "lib", "squads.ts");
const WRITE = process.argv.includes("--write");
const codesArg = process.argv[process.argv.indexOf("--codes") + 1] ?? "";
const CODES = codesArg.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

const NAME2CODE: Record<string, string> = {
  "Czech Republic":"CZE","Mexico":"MEX","South Africa":"RSA","South Korea":"KOR","Bosnia and Herzegovina":"BIH","Canada":"CAN","Qatar":"QAT","Switzerland":"SUI","Brazil":"BRA","Haiti":"HAI","Morocco":"MAR","Scotland":"SCO","Australia":"AUS","Paraguay":"PAR","Turkey":"TUR","United States":"USA","Curaçao":"CUW","Ecuador":"ECU","Germany":"GER","Ivory Coast":"CIV","Japan":"JPN","Netherlands":"NED","Sweden":"SWE","Tunisia":"TUN","Belgium":"BEL","Egypt":"EGY","Iran":"IRN","New Zealand":"NZL","Cape Verde":"CPV","Saudi Arabia":"KSA","Spain":"ESP","Uruguay":"URU","France":"FRA","Iraq":"IRQ","Norway":"NOR","Senegal":"SEN","Algeria":"ALG","Argentina":"ARG","Austria":"AUT","Jordan":"JOR","Colombia":"COL","DR Congo":"COD","Portugal":"POR","Uzbekistan":"UZB","Croatia":"CRO","England":"ENG","Ghana":"GHA","Panama":"PAN",
};
const CODE2NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME2CODE).map(([k, v]) => [v, k]),
);
const POS: Record<string, "GK" | "DEF" | "MID" | "FWD"> = { GK:"GK", DF:"DEF", MF:"MID", FW:"FWD" };

const RAPID = (() => {
  try { return (fs.readFileSync(path.join(__dirname,"..",".env.local"),"utf8").match(/RAPID_API_KEY\s*=\s*(.+)/)||[])[1]?.trim(); }
  catch { return undefined; }
})();
const HOST = "sportapi7.p.rapidapi.com";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();

function normalizeClub(c: string): string {
  return c
    .replace(/\s*\([^)]*\)/g, "")                          // drop "(football)" etc.
    .replace(/\b([A-Z]\.){2,}/g, (m) => m.replace(/\./g, "")) // F.C.->FC, A.F.C.->AFC
    .replace(/\s+(FC|AFC|SK|BC|SC|CF|FK|AC)\b\.?/g, "")    // trailing club-type tokens
    .replace(/^(FC|AFC|SC)\s+/, "")                         // leading "FC ..."
    .replace(/\s+/g, " ")
    .trim();
}

type WP = { no: number; pos: "GK"|"DEF"|"MID"|"FWD"; name: string; club: string; age: number };

async function fetchWikitext(): Promise<string> {
  const url = "https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_squads&prop=wikitext&format=json&formatversion=2";
  const r = await fetch(url, { headers: { "User-Agent": "wc2026-rostersync/1.0" } });
  const j = (await r.json()) as { parse?: { wikitext?: string } };
  if (!j.parse?.wikitext) throw new Error("no wikitext");
  return j.parse.wikitext;
}

function parseTeam(wt: string, heading: string): WP[] {
  const parts = wt.split(/^===\s*([^=]+?)\s*===\s*$/m);
  const idx = parts.findIndex((p) => p.trim() === heading);
  if (idx < 0) return [];
  const body = parts[idx + 1] ?? "";
  const chunks = body.split(/\{\{nat fs g player/i).slice(1);
  const out: WP[] = [];
  for (const raw of chunks) {
    const c = raw.split(/\{\{nat fs (?:g )?end/i)[0];
    const no = c.match(/\|\s*no=(\d+)/)?.[1];
    const pos = c.match(/\|\s*pos=([A-Z]{2})/)?.[1];
    // name=[[Target|Display]] | [[Name]] | plain — handle the pipe INSIDE the link
    let nm: string;
    const linkM = c.match(/\|\s*name=\s*\[\[([^\]]*)\]\]/);
    if (linkM) { const inner = linkM[1]; nm = inner.includes("|") ? inner.split("|").pop()! : inner; }
    else nm = c.match(/\|\s*name=([^\n|}]+)/)?.[1] || "";
    nm = nm.replace(/\s*\(c\)\s*$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim();
    let club = (c.match(/\|\s*club=([^\n]+?)\s*(?:\||\}\})/)?.[1] || "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/, (_m,a,b)=> b||a).replace(/[\[\]]/g,"").trim();
    club = normalizeClub(club);
    const bd = c.match(/age2\|2026\|6\|11\|(\d+)\|(\d+)\|(\d+)/);
    let age = 0; if (bd) age = 2026 - (+bd[1]) - ((6 < +bd[2] || (6 === +bd[2] && 11 < +bd[3])) ? 1 : 0);
    if (no && pos && nm && POS[pos]) out.push({ no:+no, pos:POS[pos], name:nm, club, age });
  }
  out.sort((a,b)=>a.no-b.no);
  return out;
}

const photoCache = new Map<string, number | null>();
async function sofascorePhoto(name: string, club: string): Promise<number | null> {
  if (!RAPID) return null;
  const key = name + "|" + club;
  if (photoCache.has(key)) return photoCache.get(key)!;
  try {
    const r = await fetch(`https://${HOST}/api/v1/search/all?q=${encodeURIComponent(name)}`,
      { headers: { "x-rapidapi-key": RAPID, "x-rapidapi-host": HOST } });
    const j = await r.json() as { results?: { type:string; entity:{ id:number; name:string; team?:{name?:string} } }[] };
    const players = (j.results||[]).filter((x)=>x.type==="player");
    const clubTokens = new Set(strip(club).split(" ").filter((t)=>t.length>2));
    // prefer a result whose team overlaps the player's club
    const match = players.find((p)=>{
      const tt = strip(p.entity.team?.name||"").split(" ");
      return [...clubTokens].some((t)=>tt.includes(t));
    }) ?? (clubTokens.size===0 ? players[0] : undefined);
    const id = match?.entity.id ?? null;
    photoCache.set(key, id);
    return id;
  } catch { photoCache.set(key, null); return null; }
}

// existing squads.ts photo id by normalized name within a team (to reuse)
function existingPhotoId(code: string, name: string): number | null {
  const sq = SQUADS[code]; if (!sq) return null;
  const t = strip(name); const tSur = t.split(" ").filter(x=>x.length>2).pop();
  const hit = sq.players.find((p)=>{
    const pn = strip(p.name);
    return pn===t || (tSur && pn.split(" ").pop()===tSur && (pn.includes(t.split(" ")[0])||t.includes(pn.split(" ")[0])));
  });
  const m = hit?.photo?.match(/\/api\/player-photo\/(\d+)/);
  return m ? +m[1] : null;
}

function buildBlock(players: (WP & { photo: number | null })[]): string {
  // dynamic column alignment per team
  const nameW = Math.max(...players.map((p)=>`"${p.name}",`.length));
  const numW  = Math.max(...players.map((p)=>`number: ${p.no},`.length));
  const posW  = Math.max(...players.map((p)=>`position: "${p.pos}",`.length));
  const clubW = Math.max(...players.map((p)=>`club: "${p.club}",`.length));
  const pad = (s:string,w:number)=> s + " ".repeat(Math.max(1, w - s.length + 1));
  return players.map((p)=>{
    let s = "      { ";
    s += pad(`name: "${p.name}",`, 7 + nameW);
    s += pad(`number: ${p.no},`, numW);
    s += pad(`position: "${p.pos}",`, posW);
    s += pad(`club: "${p.club}",`, clubW);
    s += `age: ${p.age}`;
    s += p.photo != null ? `, photo: s(${p.photo}) },` : ` },`;
    return s;
  }).join("\n");
}

function replaceTeamPlayers(text: string, code: string, block: string): string {
  const start = text.search(new RegExp(`\\n  ${code}: \\{`));
  if (start === -1) throw new Error(`block ${code} not found`);
  const pIdx = text.indexOf("players: [", start);
  const open = text.indexOf("[", pIdx);
  const close = text.indexOf("\n    ],", open);
  if (pIdx === -1 || close === -1) throw new Error(`players array ${code} not found`);
  return text.slice(0, open + 1) + "\n" + block + text.slice(close);
}

async function main() {
  if (CODES.length === 0) { console.error("Pass --codes SEN,PAR,…"); process.exit(1); }
  console.log(`Roster sync (${WRITE ? "WRITE" : "DRY RUN"}) for: ${CODES.join(", ")}\n`);
  const wt = await fetchWikitext();
  let text = fs.readFileSync(FILE, "utf8");

  for (const code of CODES) {
    const heading = CODE2NAME[code];
    const confirmed = parseTeam(wt, heading);
    if (confirmed.length === 0) { console.log(`${code}: no confirmed squad parsed — SKIP`); continue; }

    const withPhotos: (WP & { photo: number | null })[] = [];
    let reused = 0, fetched = 0, missing = 0;
    for (const p of confirmed) {
      let photo = existingPhotoId(code, p.name);
      if (photo != null) reused++;
      else { photo = await sofascorePhoto(p.name, p.club); if (photo != null) fetched++; else missing++; }
      withPhotos.push({ ...p, photo });
    }

    // report changes vs current squads.ts
    const cur = new Set(SQUADS[code].players.map((p)=>strip(p.name)));
    const added = confirmed.filter((p)=>![...cur].some((c)=>c===strip(p.name)||c.split(" ").pop()===strip(p.name).split(" ").pop()));
    console.log(`### ${code} (${confirmed.length} players)  photos: ${reused} reused, ${fetched} fetched, ${missing} missing`);
    console.log(`  new/changed players: ${added.length ? added.map((p)=>`${p.name} #${p.no}`).join(", ") : "(spelling-only)"}`);

    const block = buildBlock(withPhotos);
    text = replaceTeamPlayers(text, code, block);
  }

  if (WRITE) { fs.writeFileSync(FILE, text); console.log(`\n✓ Wrote ${FILE}. Next: npm run migrate:squads`); }
  else { fs.writeFileSync("/tmp/squads.synced.preview.ts", text); console.log(`\n(dry run — preview written to /tmp/squads.synced.preview.ts)`); }
}
main().catch((e)=>{ console.error("FAILED:", e?.message ?? e); process.exit(1); });

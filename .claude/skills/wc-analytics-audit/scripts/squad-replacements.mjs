// Sweeps the authoritative Wikipedia "2026 FIFA World Cup squads" page for injury
// replacements and reports which our DB roster is still missing. Catches the
// non-playing replacements that the lineup-based audit (scripts/audit-analytics.ts)
// cannot see.
// Run from the project root:  node .claude/skills/wc-analytics-audit/scripts/squad-replacements.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Wikipedia team-section name -> our 3-letter code.
const NAME2CODE = {
  "Czech Republic": "CZE", "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR",
  "Bosnia and Herzegovina": "BIH", "Canada": "CAN", "Qatar": "QAT", "Switzerland": "SUI",
  "Brazil": "BRA", "Haiti": "HAI", "Morocco": "MAR", "Scotland": "SCO", "Australia": "AUS",
  "Paraguay": "PAR", "Turkey": "TUR", "United States": "USA", "Curaçao": "CUW", "Ecuador": "ECU",
  "Germany": "GER", "Ivory Coast": "CIV", "Japan": "JPN", "Netherlands": "NED", "Sweden": "SWE",
  "Tunisia": "TUN", "Belgium": "BEL", "Egypt": "EGY", "Iran": "IRN", "New Zealand": "NZL",
  "Cape Verde": "CPV", "Saudi Arabia": "KSA", "Spain": "ESP", "Uruguay": "URU", "France": "FRA",
  "Iraq": "IRQ", "Norway": "NOR", "Senegal": "SEN", "Algeria": "ALG", "Argentina": "ARG",
  "Austria": "AUT", "Jordan": "JOR", "Colombia": "COL", "DR Congo": "COD", "Portugal": "POR",
  "Uzbekistan": "UZB", "Croatia": "CRO", "England": "ENG", "Ghana": "GHA", "Panama": "PAN",
};

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const rosterHas = (names, name) => {
  const t = strip(name);
  const tk = t.split(" ").filter((x) => x.length > 2);
  return names.some((r) => {
    const c = strip(r);
    return c === t || c.includes(t) || t.includes(c) || tk.filter((x) => c.includes(x)).length >= 2;
  });
};

const res = await fetch("https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads?action=raw", {
  headers: { "User-Agent": "wc-analytics-audit/1.0" },
});
if (!res.ok) { console.error("Wikipedia fetch failed:", res.status); process.exit(1); }
let wiki = await res.text();
wiki = wiki.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "").replace(/<ref[^>]*\/>/g, "");

// Team sections are ===Team=== headers; stop at the statistics sections.
const STOP = new Set(["Age", "Player representation by club", "Player representation by league system",
  "Player representation by club confederation", "Average age of squads", "Coach representation by country",
  "Most common names", "Statistics", "Notes", "References"]);
const headers = [...wiki.matchAll(/^===([^=]+)===/gm)].map((m) => [m.index, m[1].trim()]).filter(([, n]) => !STOP.has(n));
const teamAt = (pos) => { let n = "?"; for (const [s, name] of headers) { if (s <= pos) n = name; else break; } return n; };

const notes = [];
const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\][^.\[]{0,40}?(?:withdrew|ruled out)[^.]*?replaced by \[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
let m;
while ((m = re.exec(wiki)) !== null) {
  const clean = (s) => s.replace(/\s*\(footballer[^)]*\)/, "").trim();
  notes.push({ team: teamAt(m.index), out: clean(m[1]), in: clean(m[2]) });
}

const rosterCache = {};
let missing = 0;
console.log(`Found ${notes.length} replacement note(s) on Wikipedia:\n`);
for (const { team, out, in: inc } of notes) {
  const code = NAME2CODE[team];
  if (!code) { console.log(`  ?? unknown team "${team}" (${out} -> ${inc})`); continue; }
  if (!rosterCache[code]) {
    const { data } = await sb.from("players").select("name").eq("team_code", code);
    rosterCache[code] = (data ?? []).map((p) => p.name);
  }
  const names = rosterCache[code];
  const inIn = rosterHas(names, inc);
  const flag = inIn ? "✅ ok     " : "⚠️ MISSING";
  if (!inIn) missing++;
  console.log(`  ${flag}  ${code}  ${out}  ->  ${inc}${inIn ? "" : "  (replacement not in our roster)"}`);
}

console.log(`\n${missing} replacement(s) missing from our roster.`);
if (missing) {
  console.log("Apply each missing one: targeted edit in src/lib/squads.ts (or sync:roster --codes <CODE>), then `npm run migrate:squads`.");
  process.exit(2);
}
console.log("✓ All documented injury replacements are in our roster.");

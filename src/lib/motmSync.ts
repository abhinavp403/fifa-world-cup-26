import "server-only";
import { createClient } from "@supabase/supabase-js";

const CXM_PAGES =
  "https://cxm-api.fifa.com/fifaplusweb/api/pages/en/tournaments/mens/worldcup/canadamexicousa2026/articles/michelob-ultra-superior-player-of-match-winner";
const CXM_SECTION = (id: string) =>
  `https://cxm-api.fifa.com/fifaplusweb/api/sections/article/${id}?locale=en`;

type RichtextNode = {
  nodeType: string;
  value?: string;
  content?: RichtextNode[];
};

function extractText(node: RichtextNode): string {
  if (node.nodeType === "text") return node.value ?? "";
  return (node.content ?? []).map(extractText).join("");
}

type MotmRow = {
  home_team: string;
  away_team: string;
  player_name: string;
  player_team: string;
};

async function fetchMotmRows(): Promise<MotmRow[]> {
  // Step 1: get the page metadata to find the article section entry ID.
  const pageRes = await fetch(CXM_PAGES, {
    headers: { Origin: "https://www.fifa.com" },
    next: { revalidate: 0 },
  });
  if (!pageRes.ok) throw new Error(`CXM pages ${pageRes.status}`);
  const page = (await pageRes.json()) as {
    sections?: { entryId?: string; entryType?: string }[];
  };
  const sectionId = page.sections?.find((s) => s.entryType === "article")?.entryId;
  if (!sectionId) throw new Error("No article section ID found in page response");

  // Step 2: get the article richtext content.
  const secRes = await fetch(CXM_SECTION(sectionId), {
    headers: { Origin: "https://www.fifa.com" },
    next: { revalidate: 0 },
  });
  if (!secRes.ok) throw new Error(`CXM section ${secRes.status}`);
  const section = (await secRes.json()) as { richtext?: RichtextNode };
  const text = section.richtext ? extractText(section.richtext) : "";

  // Parse "Team1 X-Y Team2 - Player Name (Team)" entries.
  // The unicode range covers accented chars like Türkiye, Côte d'Ivoire, etc.
  const pattern =
    /([A-Za-zÀ-ÖØ-öø-ÿ ]+\d[-–]\d[A-Za-zÀ-ÖØ-öø-ÿ ]+)\s[-–]\s([^(]+)\(([^)]+)\)/g;

  const rows: MotmRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const scoreStr = m[1].trim();
    const playerName = m[2].trim();
    const playerTeam = m[3].trim();
    const sides = scoreStr.match(/^(.+?)\s+\d[-–]\d\s+(.+)$/);
    if (!sides) continue;
    rows.push({
      home_team: sides[1].trim(),
      away_team: sides[2].trim(),
      player_name: playerName,
      player_team: playerTeam,
    });
  }
  return rows;
}

export async function syncMotm() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");

  const rows = await fetchMotmRows();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let upserted = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await supabase
      .from("match_motm")
      .upsert(row, { onConflict: "home_team,away_team" });
    if (error) errors.push(`${row.home_team} v ${row.away_team}: ${error.message}`);
    else upserted++;
  }

  return { total: rows.length, upserted, errors };
}

// GET /api/highlights?home=Mexico&away=South+Africa&date=2026-06-14
// Returns the best Fox Sports YouTube highlight video for a finished WC match.

import { NextRequest, NextResponse } from "next/server";

// Fox Sports US YouTube channel — confirmed from live WC 2026 uploads.
const FOX_CHANNEL_ID = "UCwNqHDsnBCKT-olwJwIFyfg";

export const revalidate = 3600; // cache for 1 hour; highlights don't change

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 503 });
  }

  // Search Fox Sports channel for "[Home] vs [Away] highlights 2026 FIFA World Cup"
  const q = encodeURIComponent(`${home} vs ${away} highlights 2026 FIFA World Cup`);
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=5` +
    `&channelId=${FOX_CHANNEL_ID}` +
    `&q=${q}&key=${key}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = await res.json() as {
      items?: { id: { videoId: string }; snippet: { title: string; thumbnails: { medium?: { url: string } } } }[];
      error?: { message: string };
    };

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 502 });
    }

    const items = json.items ?? [];

    // Prefer a result with "extended highlights" or "highlights" in the title
    // that actually names both teams, otherwise take the first result.
    const best =
      items.find((i) => {
        const t = i.snippet.title.toLowerCase();
        return (
          t.includes("extended highlight") &&
          t.includes(home.split(" ").at(-1)!.toLowerCase())
        );
      }) ??
      items.find((i) => {
        const t = i.snippet.title.toLowerCase();
        return (
          t.includes("highlight") &&
          t.includes(home.split(" ").at(-1)!.toLowerCase())
        );
      }) ??
      items[0] ??
      null;

    if (!best) {
      return NextResponse.json({ videoId: null, title: null, thumbnail: null });
    }

    return NextResponse.json({
      videoId: best.id.videoId,
      title: best.snippet.title,
      thumbnail: best.snippet.thumbnails.medium?.url ?? null,
      url: `https://www.youtube.com/watch?v=${best.id.videoId}`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

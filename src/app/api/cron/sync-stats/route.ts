// GET /api/cron/sync-stats
//
// Triggered by Vercel Cron on a schedule (see vercel.json). Aggregates
// tournament stats from api-football into Supabase.
//
// Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
// automatically. Manual runs must include the same header.

import { NextResponse } from "next/server";
import { syncStats } from "@/lib/statsSync";

// never cache; always run fresh
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds (the fan-out can take a while)

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // If a secret is configured, require it. (Vercel Cron sets this header.)
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncStats(2026);
    return NextResponse.json({ ...summary, ranAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

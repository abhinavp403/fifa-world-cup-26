import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const res = await fetch(
    `https://sportapi7.p.rapidapi.com/api/v1/player/${id}/image`,
    {
      headers: {
        "x-rapidapi-key": process.env.RAPID_API_KEY ?? "",
        "x-rapidapi-host": "sportapi7.p.rapidapi.com",
      },
      next: { revalidate: 86400 }, // cache for 24h
    }
  );

  if (!res.ok) return new NextResponse(null, { status: 404 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

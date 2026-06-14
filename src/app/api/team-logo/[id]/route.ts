import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const res = await fetch(`https://img.sofascore.com/api/v1/team/${id}/image`, {
    next: { revalidate: 86400 },
  });

  if (!res.ok) return new NextResponse(null, { status: 404 });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/png";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

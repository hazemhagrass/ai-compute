import { NextResponse } from "next/server";

import { analytics } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days"));
  const window = Number.isFinite(days) && days > 0 ? Math.min(365, days) : 30;
  return NextResponse.json({ analytics: analytics(window) });
}

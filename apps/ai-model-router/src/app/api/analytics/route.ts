import { NextResponse } from "next/server";

import { analytics } from "@/lib/usage";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const days = Number(new URL(request.url).searchParams.get("days"));
  const window = Number.isFinite(days) && days > 0 ? Math.min(365, days) : 30;
  return NextResponse.json({ analytics: analytics(window) });
}

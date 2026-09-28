import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { maybeApplyRetention } from "@/lib/retention";
import { analytics } from "@/lib/usage";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  // Retention before aggregation (#165): pruned rows cannot inflate a window
  // that no longer needs them. Guarded internally to one pass per hour.
  maybeApplyRetention(getDb());

  const days = Number(new URL(request.url).searchParams.get("days"));
  const window = Number.isFinite(days) && days > 0 ? Math.min(365, days) : 30;
  return NextResponse.json({ analytics: analytics(window) });
}

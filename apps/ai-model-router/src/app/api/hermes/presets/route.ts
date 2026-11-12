import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listRouterPresets } from "@/lib/hermes/router-presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ presets: listRouterPresets() });
}

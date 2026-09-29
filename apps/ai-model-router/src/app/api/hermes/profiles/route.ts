import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listHermesProfiles } from "@/lib/hermes/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ profiles: listHermesProfiles() });
}

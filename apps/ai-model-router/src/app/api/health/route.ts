import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { checkAllProviders } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const report = await checkAllProviders();
  return NextResponse.json(report);
}

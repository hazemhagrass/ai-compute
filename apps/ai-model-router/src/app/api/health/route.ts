import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { checkAllProviders } from "@/lib/health";
import { summarizePricingFreshness } from "@/lib/pricing-freshness";
import { getPricingFreshnessRecords } from "@/lib/pricing-freshness-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const report = await checkAllProviders();
  const pricing = summarizePricingFreshness(
    getPricingFreshnessRecords(),
    Date.now(),
  );
  return NextResponse.json({ ...report, pricing });
}

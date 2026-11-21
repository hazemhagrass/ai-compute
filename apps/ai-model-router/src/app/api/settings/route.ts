import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import {
  clampPricingStaleDays,
  PRICING_STALE_DAYS_DEFAULT,
  PRICING_STALE_DAYS_MAX,
  PRICING_STALE_DAYS_MIN,
} from "@/lib/pricing-freshness";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const PRICING_STALE_DAYS_KEY = "pricing_stale_days";

const settingsSchema = z.object({
  pricingStaleDays: z
    .number()
    .int()
    .min(PRICING_STALE_DAYS_MIN)
    .max(PRICING_STALE_DAYS_MAX),
});

function readPricingStaleDays(): number {
  return clampPricingStaleDays(
    getSetting(PRICING_STALE_DAYS_KEY, String(PRICING_STALE_DAYS_DEFAULT)),
  );
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({
    settings: { pricingStaleDays: readPricingStaleDays() },
  });
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, settingsSchema);
  if (!parsed.ok) return parsed.response;

  setSetting(PRICING_STALE_DAYS_KEY, String(parsed.data.pricingStaleDays));

  return NextResponse.json({
    settings: { pricingStaleDays: parsed.data.pricingStaleDays },
  });
}

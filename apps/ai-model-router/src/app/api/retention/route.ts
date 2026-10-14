import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  AUTO_RETENTION_INTERVAL_MS,
  RECOMMENDATION_RETENTION_DEFAULTS,
  RETENTION_DEFAULTS,
  applyRetention,
  pruneRecommendations,
  retentionPolicy,
  setRetentionPolicy,
} from "@/lib/retention";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const retentionSchema = z.object({
  maxAgeDays: z.number().int().positive().optional(),
  maxRows: z.number().int().positive().optional(),
});

const policySchema = z.object({
  usageMaxAgeDays: z.number().int().positive().optional(),
  usageMaxRows: z.number().int().positive().optional(),
  recommendationMaxAgeDays: z.number().int().positive().optional(),
  recommendationMaxRows: z.number().int().positive().optional(),
});

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({
    policy: retentionPolicy(),
    defaults: { usage: RETENTION_DEFAULTS, recommendations: RECOMMENDATION_RETENTION_DEFAULTS },
    autoRunIntervalMs: AUTO_RETENTION_INTERVAL_MS,
  });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, retentionSchema);
  if (!parsed.ok) return parsed.response;

  const policy = retentionPolicy();
  const result = applyRetention(getDb(), {
    maxAgeDays: parsed.data.maxAgeDays ?? policy.usage.maxAgeDays,
    maxRows: parsed.data.maxRows ?? policy.usage.maxRows,
  });
  const recommendations = pruneRecommendations(getDb(), policy.recommendations);

  return NextResponse.json({ ...result, recommendations });
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, policySchema);
  if (!parsed.ok) return parsed.response;

  setRetentionPolicy(parsed.data);
  return NextResponse.json({ policy: retentionPolicy() });
}

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
} from "@/lib/retention";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const retentionSchema = z.object({
  maxAgeDays: z.number().int().positive().optional(),
  maxRows: z.number().int().positive().optional(),
});

/** Current policy, so the UI can show what will be pruned and when. */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({
    policy: retentionPolicy(),
    defaults: { usage: RETENTION_DEFAULTS, recommendations: RECOMMENDATION_RETENTION_DEFAULTS },
    autoRunIntervalMs: AUTO_RETENTION_INTERVAL_MS,
  });
}

/**
 * Prune old usage rows.
 *
 * Exposed as an endpoint rather than a background timer so it can be driven by
 * whatever scheduler the deployment already has (cron, a platform job, a
 * manual click) instead of this process needing to stay alive to be correct.
 */
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
  // The same pass prunes recommendations (#171): both are retention on data
  // this process owns, and reporting them together keeps one entry point.
  const recommendations = pruneRecommendations(getDb(), policy.recommendations);

  return NextResponse.json({ ...result, recommendations });
}

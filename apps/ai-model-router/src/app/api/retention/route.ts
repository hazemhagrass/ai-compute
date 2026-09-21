import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { RETENTION_DEFAULTS, applyRetention } from "@/lib/retention";
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

  return NextResponse.json({ policy: RETENTION_DEFAULTS });
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

  const result = applyRetention(getDb(), {
    maxAgeDays: parsed.data.maxAgeDays ?? RETENTION_DEFAULTS.maxAgeDays,
    maxRows: parsed.data.maxRows ?? RETENTION_DEFAULTS.maxRows,
  });

  return NextResponse.json(result);
}

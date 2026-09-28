import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { verifyAndRecordKey } from "@/lib/provider-keys";

export const dynamic = "force-dynamic";

/**
 * Probe one stored key against its provider and record the outcome (#162).
 *
 * The response deliberately mirrors KeyVerificationOutcome plus the audit
 * timestamp; the key itself never leaves the server, and error text has
 * already passed through redaction inside the verifier.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; keyId: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { keyId } = await ctx.params;
  const id = Number(keyId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid key id" }, { status: 400 });
  }

  try {
    const outcome = await verifyAndRecordKey(id);
    return NextResponse.json(outcome);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

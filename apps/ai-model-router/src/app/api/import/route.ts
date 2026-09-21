import { NextResponse } from "next/server";

import { ImportValidationError, importConfig } from "@/lib/import";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Restore a config produced by `GET /api/export`.
 *
 * Body: { version: 1, providers, models, tasks, conflict?: "skip" | "upsert" }.
 * Usage history is never imported. Plaintext keys are accepted only through
 * each provider's `plaintextApiKey` field and are encrypted before storage.
 */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "expected a JSON object" }, { status: 400 });
  }

  const { conflict, ...payload } = body as Record<string, unknown>;
  if (conflict !== undefined && conflict !== "skip" && conflict !== "upsert") {
    return NextResponse.json(
      { error: 'conflict must be "skip" or "upsert"' },
      { status: 400 },
    );
  }

  try {
    const summary = importConfig(payload, { conflict });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { reconcile } from "@/lib/reconcile";

export const dynamic = "force-dynamic";

const schema = z.object({
  providerSlug: z.string().min(1, "providerSlug is required"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start must be YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end must be YYYY-MM-DD"),
  lines: z
    .array(
      z.object({
        modelId: z.string().min(1),
        billedUsd: z.number(),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  return NextResponse.json({ reconciliation: reconcile(parsed.data) });
}

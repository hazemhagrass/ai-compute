import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import {
  listRecommendations,
  pickRecommendation,
} from "@/lib/recommendations";

export const dynamic = "force-dynamic";

/** List saved recommendations, newest first. */
export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  return NextResponse.json({
    recommendations: listRecommendations(Number.isFinite(limit) ? limit : 50),
  });
}

const pickSchema = z.object({
  id: z.number().int().positive(),
  modelRowId: z.number().int().positive(),
});

/** Record which model was picked for a saved recommendation. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = pickSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const updated = pickRecommendation(parsed.data.id, parsed.data.modelRowId);
  if (!updated) {
    return NextResponse.json({ error: "recommendation not found" }, { status: 404 });
  }
  return NextResponse.json({ recommendation: updated });
}

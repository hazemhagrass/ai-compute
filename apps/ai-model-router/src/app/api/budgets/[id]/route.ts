import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { deleteBudget, getBudget } from "@/lib/budget";

export const dynamic = "force-dynamic";

/** Delete one budget definition (#164 UI needs it; lib already had it). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = getBudget(id);
  if (!existing) return NextResponse.json({ error: "budget not found" }, { status: 404 });

  deleteBudget(id);
  return new NextResponse(null, { status: 204 });
}

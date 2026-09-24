import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import {
  deleteSubscription,
  getSubscription,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const sub = getSubscription(Number(id));
  if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ subscription: sub });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const ok = deleteSubscription(Number(id));
  return NextResponse.json({ ok });
}

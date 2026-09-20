import { NextResponse } from "next/server";

import { deleteUsageEvent, getUsageEvent } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/logs/[id]">) {
  const { id } = await ctx.params;
  const event = getUsageEvent(Number(id));
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/logs/[id]">) {
  const { id } = await ctx.params;
  const ok = deleteUsageEvent(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

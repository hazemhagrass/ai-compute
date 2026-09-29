import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { readProfileUsage } from "@/lib/hermes/usage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/usage">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ usage: readProfileUsage(id) });
}

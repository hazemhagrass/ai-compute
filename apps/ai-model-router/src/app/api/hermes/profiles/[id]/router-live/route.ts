import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { readRouterLive } from "@/lib/hermes/router-live";
import { routerLiveSchema } from "@/lib/hermes/router-live-schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/router-live">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const live = routerLiveSchema.parse(readRouterLive(id));
    return NextResponse.json({ routerLive: live });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read tier-router state" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { profileRouteGuard } from "@/lib/hermes/profile-route";
import { readRouterLive } from "@/lib/hermes/router-live";
import { routerLiveSchema } from "@/lib/hermes/router-live-schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/router-live">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;

  // Shared guard: 400 before the id can become a path segment, 404 when the named profile
  // directory is absent (the default profile maps to HERMES_HOME itself and always exists).
  const guard = profileRouteGuard(id);
  if (guard) return guard;

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

import fs from "node:fs";

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { isValidProfileId, profilePaths } from "@/lib/hermes/paths";
import { readRouterLive } from "@/lib/hermes/router-live";
import { routerLiveSchema } from "@/lib/hermes/router-live-schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/router-live">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;

  // Validate before the id can become a path segment.
  if (!isValidProfileId(id)) {
    return NextResponse.json({ error: `invalid profile id: ${JSON.stringify(id)}` }, { status: 400 });
  }

  // The default profile maps to HERMES_HOME itself and therefore always exists; a named
  // profile exists only when its directory is present under profiles/.
  if (id !== "default" && !fs.existsSync(profilePaths(id).root)) {
    return NextResponse.json({ error: `profile "${id}" does not exist` }, { status: 404 });
  }

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

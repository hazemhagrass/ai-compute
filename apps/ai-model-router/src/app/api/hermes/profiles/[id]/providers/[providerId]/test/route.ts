import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { getCatalogIdForProvider } from "@/lib/hermes/providers";
import { probeHermesProvider } from "@/lib/hermes/probe";

export const dynamic = "force-dynamic";

/** Verify a Hermes-managed provider is reachable + credentialed, without
 * ever returning the key itself. Not every auth type is probeable this way
 * (oauth/aws_sdk/vertex/...) — those come back with `notTestable: true`
 * rather than a false failure. */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/providers/[providerId]/test">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, providerId } = await ctx.params;

  const entry = readHermesConfig(id).providers?.[providerId];
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  const catalogId = getCatalogIdForProvider(providerId, entry);
  const result = await probeHermesProvider(id, providerId, entry, catalogId);
  return NextResponse.json(result);
}

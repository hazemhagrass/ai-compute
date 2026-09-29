import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { removeTier, renameTier } from "@/lib/hermes/tiers";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const renameSchema = z.object({
  newName: z
    .string()
    .trim()
    .min(1, "newName is required")
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "tier name must look like an identifier"),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/[tierName]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, tierName } = await ctx.params;
  const parsed = await parseBody(request, renameSchema);
  if (!parsed.ok) return parsed.response;

  renameTier(id, tierName, parsed.data.newName);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/[tierName]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, tierName } = await ctx.params;

  removeTier(id, tierName);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

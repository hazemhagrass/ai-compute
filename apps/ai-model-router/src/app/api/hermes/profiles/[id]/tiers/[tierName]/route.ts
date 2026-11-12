import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import {
  commitConfigChange,
  planConfigChange,
  planPayload,
  type ConfigChangePlan,
} from "@/lib/hermes/config-plan";
import { applyRemoveTier, applyRenameTier } from "@/lib/hermes/tiers";
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

function isDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get("dry_run") === "1";
}

function finish(
  profileId: string,
  plan: ConfigChangePlan,
  dryRun: boolean,
): NextResponse {
  const payload = planPayload(plan, dryRun);
  if (dryRun) return NextResponse.json(payload);
  if (!plan.valid) return NextResponse.json(payload, { status: 400 });
  commitConfigChange(profileId, plan);
  return NextResponse.json({ ...payload, tierRouter: plan.next.tier_router ?? null });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/[tierName]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, tierName } = await ctx.params;
  const dryRun = isDryRun(request);
  const parsed = await parseBody(request, renameSchema);
  if (!parsed.ok) return parsed.response;

  const plan = planConfigChange(id, null, (cfg) =>
    applyRenameTier(cfg, tierName, parsed.data.newName),
  );
  return finish(id, plan, dryRun);
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/[tierName]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, tierName } = await ctx.params;
  const dryRun = isDryRun(request);

  const plan = planConfigChange(id, null, (cfg) => applyRemoveTier(cfg, tierName));
  return finish(id, plan, dryRun);
}

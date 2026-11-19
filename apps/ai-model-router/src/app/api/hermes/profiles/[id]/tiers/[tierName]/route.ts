import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { ConfigChangeError } from "@/lib/hermes/config-errors";
import {
  commitConfigChange,
  expectedBaseHash,
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

// Real writes accept an optional If-Match header carrying the baseHash returned
// by the dry-run preview of the same change. When it does not match the hash of
// the config text the plan was computed from, the write is refused with 409 and
// nothing is written.
function finish(
  request: Request,
  profileId: string,
  plan: ConfigChangePlan,
  dryRun: boolean,
): NextResponse {
  const payload = planPayload(plan, dryRun);
  if (dryRun) return NextResponse.json(payload);
  if (!plan.valid) {
    return NextResponse.json(
      {
        ...payload,
        error: `config validation failed: fix ${plan.errors.length} highlighted row problem(s)`,
      },
      { status: 400 },
    );
  }
  const expected = expectedBaseHash(request);
  if (expected && expected !== plan.baseHash) {
    return NextResponse.json(
      { error: "config.yaml changed since the preview was generated; re-run the preview" },
      { status: 409 },
    );
  }
  commitConfigChange(profileId, plan);
  return NextResponse.json({ ...payload, tierRouter: plan.next.tier_router ?? null });
}

function changeErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ConfigChangeError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
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

  // Renaming to an existing tier name returns 409, renaming a missing tier
  // returns 404; neither writes anything.
  try {
    const plan = planConfigChange(id, null, (cfg) =>
      applyRenameTier(cfg, tierName, parsed.data.newName),
    );
    return finish(request, id, plan, dryRun);
  } catch (err) {
    const res = changeErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/[tierName]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, tierName } = await ctx.params;
  const dryRun = isDryRun(request);

  // Deleting a missing tier returns 404 and writes nothing.
  try {
    const plan = planConfigChange(id, null, (cfg) => applyRemoveTier(cfg, tierName));
    return finish(request, id, plan, dryRun);
  } catch (err) {
    const res = changeErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

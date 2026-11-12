import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import {
  commitConfigChange,
  planConfigChange,
  planPayload,
  type ConfigChangePlan,
} from "@/lib/hermes/config-plan";
import type { ValidationTarget } from "@/lib/hermes/config-validate";
import {
  applySetClassifierPool,
  applySetDefaultTier,
  applySetRouterBehavior,
  applyTierRouterEnabled,
  applyUpsertTier,
} from "@/lib/hermes/tiers";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const modelRefSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  base_url: z.string().optional(),
  timeout: z.number().optional(),
});

const upsertTierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "tier name is required")
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "tier name must look like an identifier"),
  mode: z.enum(["round_robin", "priority"]).optional(),
  escalate_to: z.string().nullable().optional(),
  pool: z.array(modelRefSchema).optional(),
  fallback: z.array(modelRefSchema).optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_tier: z.string().trim().min(1).optional(),
  classifier_pool: z.array(modelRefSchema).optional(),
  cooldown_s: z.number().positive().optional(),
  restore_primary: z.boolean().optional(),
});

function isDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get("dry_run") === "1";
}

function finish(
  profileId: string,
  plan: ConfigChangePlan,
  dryRun: boolean,
  okStatus: number,
): NextResponse {
  const payload = planPayload(plan, dryRun);
  if (dryRun) return NextResponse.json(payload);
  if (!plan.valid) return NextResponse.json(payload, { status: 400 });
  commitConfigChange(profileId, plan);
  return NextResponse.json(
    { ...payload, tierRouter: plan.next.tier_router ?? null },
    { status: okStatus },
  );
}

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const dryRun = isDryRun(request);
  const parsed = await parseBody(request, settingsSchema);
  if (!parsed.ok) return parsed.response;

  const target: ValidationTarget =
    parsed.data.classifier_pool !== undefined ? { kind: "classifier" } : null;
  const plan = planConfigChange(id, target, (cfg) => {
    let next = cfg;
    if (parsed.data.enabled !== undefined) next = applyTierRouterEnabled(next, parsed.data.enabled);
    if (parsed.data.default_tier !== undefined) next = applySetDefaultTier(next, parsed.data.default_tier);
    if (parsed.data.classifier_pool !== undefined) next = applySetClassifierPool(next, parsed.data.classifier_pool);
    if (parsed.data.cooldown_s !== undefined || parsed.data.restore_primary !== undefined) {
      next = applySetRouterBehavior(next, {
        cooldown_s: parsed.data.cooldown_s,
        restore_primary: parsed.data.restore_primary,
      });
    }
    return next;
  });
  return finish(id, plan, dryRun, 200);
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const dryRun = isDryRun(request);
  const parsed = await parseBody(request, upsertTierSchema);
  if (!parsed.ok) return parsed.response;

  const { name, ...patch } = parsed.data;
  const plan = planConfigChange(id, { kind: "tier", name }, (cfg) => applyUpsertTier(cfg, name, patch));
  return finish(id, plan, dryRun, 201);
}

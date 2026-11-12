import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { ConfigChangeError } from "@/lib/hermes/config-errors";
import { readHermesConfig } from "@/lib/hermes/config-io";
import {
  commitConfigChange,
  expectedBaseHash,
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

// Real writes accept an optional If-Match header carrying the baseHash returned
// by the dry-run preview of the same change. When it does not match the hash of
// the config text the plan was computed from, the write is refused with 409 and
// nothing is written.
function finish(
  request: Request,
  profileId: string,
  plan: ConfigChangePlan,
  dryRun: boolean,
  okStatus: number,
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
  return NextResponse.json(
    { ...payload, tierRouter: plan.next.tier_router ?? null },
    { status: okStatus },
  );
}

function changeErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ConfigChangeError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
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
  try {
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
    return finish(request, id, plan, dryRun, 200);
  } catch (err) {
    const res = changeErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const dryRun = isDryRun(request);
  const parsed = await parseBody(request, upsertTierSchema);
  if (!parsed.ok) return parsed.response;

  const { name, ...patch } = parsed.data;
  try {
    let existed = false;
    const plan = planConfigChange(id, { kind: "tier", name }, (cfg) => {
      existed = Object.hasOwn(cfg.tier_router?.tiers ?? {}, name);
      return applyUpsertTier(cfg, name, patch);
    });
    // 201 when the tier is created, 200 when an existing tier is updated.
    return finish(request, id, plan, dryRun, existed ? 200 : 201);
  } catch (err) {
    const res = changeErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

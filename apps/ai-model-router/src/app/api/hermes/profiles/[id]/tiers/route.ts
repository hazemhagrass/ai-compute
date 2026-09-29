import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { setClassifierPool, setDefaultTier, setTierRouterEnabled, upsertTier } from "@/lib/hermes/tiers";
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
});

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

/** Whole-router settings (enabled flag, default tier, classifier pool) — a
 * separate verb from per-tier upsert below so toggling "enabled" doesn't
 * require resending every tier. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, settingsSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.enabled !== undefined) setTierRouterEnabled(id, parsed.data.enabled);
  if (parsed.data.default_tier !== undefined) setDefaultTier(id, parsed.data.default_tier);
  if (parsed.data.classifier_pool !== undefined) setClassifierPool(id, parsed.data.classifier_pool);

  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

/** Create or fully replace one named tier. */
export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, upsertTierSchema);
  if (!parsed.ok) return parsed.response;

  const { name, ...patch } = parsed.data;
  upsertTier(id, name, patch);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null }, { status: 201 });
}

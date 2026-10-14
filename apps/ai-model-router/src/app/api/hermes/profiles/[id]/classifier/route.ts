import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { setClassifierSettings, removeRoute, setRoute, setSystemOne } from "@/lib/hermes/tiers";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const classifierSettingsSchema = z.object({
  timeout_s: z.number().positive().optional(),
  history_turns: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  systemone: z
    .object({
      enabled: z.boolean().optional(),
      endpoints: z.array(z.string().trim().min(1)).optional(),
      timeout_s: z.number().optional(),
      attempt_timeout_s: z.number().optional(),
      min_confidence: z.number().optional(),
    })
    .optional(),
});

const setRouteSchema = z.object({
  task: z.string().trim().min(1),
  subtype: z.string().trim().min(1),
  tier: z.string().trim().min(1),
});

const removeRouteSchema = z.object({
  task: z.string().trim().min(1),
  subtype: z.string().trim().min(1),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/classifier">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, classifierSettingsSchema);
  if (!parsed.ok) return parsed.response;

  const { systemone, ...settings } = parsed.data;
  if (systemone !== undefined) {
    try {
      setSystemOne(id, systemone);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
  }
  setClassifierSettings(id, settings);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/classifier">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, setRouteSchema);
  if (!parsed.ok) return parsed.response;

  setRoute(id, parsed.data.task, parsed.data.subtype, parsed.data.tier);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null }, { status: 201 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/classifier">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, removeRouteSchema);
  if (!parsed.ok) return parsed.response;

  removeRoute(id, parsed.data.task, parsed.data.subtype);
  return NextResponse.json({ tierRouter: readHermesConfig(id).tier_router ?? null });
}

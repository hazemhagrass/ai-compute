import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { setDefaultModel } from "@/lib/hermes/providers";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/config">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ config: readHermesConfig(id) });
}

/** Sets model.default + model.provider — the profile-wide "when nothing else
 * routes, use this" model, same as `hermes model` in the CLI. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/config">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  setDefaultModel(id, parsed.data.provider, parsed.data.model);
  return NextResponse.json({ config: readHermesConfig(id) });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { listProviderViews, removeProvider, updateProvider } from "@/lib/hermes/providers";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().optional(),
  baseUrl: z.string().trim().optional(),
  defaultModel: z.string().trim().optional(),
  requestTimeoutSeconds: z.coerce.number().int().min(1).optional(),
  // Tri-state, matching the rest of the app: absent keeps the key, "" clears
  // it, a value replaces it.
  apiKey: z.string().optional(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/providers/[providerId]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, providerId } = await ctx.params;
  const parsed = await parseBody(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const existing = readHermesConfig(id).providers?.[providerId];
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  updateProvider(id, providerId, parsed.data);
  const config = readHermesConfig(id);
  return NextResponse.json({ providers: listProviderViews(id, config) });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/hermes/profiles/[id]/providers/[providerId]">,
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id, providerId } = await ctx.params;

  const existing = readHermesConfig(id).providers?.[providerId];
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  removeProvider(id, providerId);
  const config = readHermesConfig(id);
  return NextResponse.json({ providers: listProviderViews(id, config) });
}

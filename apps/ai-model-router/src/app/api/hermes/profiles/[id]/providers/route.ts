import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { readHermesConfig } from "@/lib/hermes/config-io";
import { addProvider, listProviderViews } from "@/lib/hermes/providers";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const addProviderSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "id is required")
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, "id must look like a config key (letters, digits, ._- )"),
  catalogId: z.string().trim().min(1, "catalogId is required"),
  name: z.string().trim().optional(),
  baseUrl: z.string().trim().optional(),
  defaultModel: z.string().trim().optional(),
  requestTimeoutSeconds: z.coerce.number().int().min(1).optional(),
  apiKey: z.string().optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/providers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const config = readHermesConfig(id);
  return NextResponse.json({ providers: listProviderViews(id, config) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/providers">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, addProviderSchema);
  if (!parsed.ok) return parsed.response;

  const existing = readHermesConfig(id).providers?.[parsed.data.id];
  if (existing) {
    return NextResponse.json({ error: `provider "${parsed.data.id}" already exists` }, { status: 409 });
  }
  if (parsed.data.catalogId === "custom" && !parsed.data.baseUrl) {
    return NextResponse.json({ error: "baseUrl is required for a custom provider" }, { status: 400 });
  }

  addProvider(id, parsed.data);
  const config = readHermesConfig(id);
  return NextResponse.json({ providers: listProviderViews(id, config) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getFallbackChain, setFallbackChain } from "@/lib/hermes/fallback";
import { modelRefSchema } from "@/lib/hermes/config-schema";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const chainSchema = z.object({ chain: z.array(modelRefSchema) });

export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/fallback">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ chain: getFallbackChain(id) });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/fallback">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, chainSchema);
  if (!parsed.ok) return parsed.response;

  const chain = setFallbackChain(id, parsed.data.chain);
  return NextResponse.json({ chain });
}

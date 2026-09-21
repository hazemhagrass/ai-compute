import { NextResponse } from "next/server";

import { testConnection } from "@/lib/client";
import { getProvider } from "@/lib/repo";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/providers/[id]/test">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const provider = getProvider(Number(id));
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await testConnection(provider);
  return NextResponse.json({ result });
}

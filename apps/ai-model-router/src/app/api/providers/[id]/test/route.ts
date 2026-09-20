import { NextResponse } from "next/server";

import { testConnection } from "@/lib/client";
import { getProvider } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/providers/[id]/test">) {
  const { id } = await ctx.params;
  const provider = getProvider(Number(id));
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await testConnection(provider);
  return NextResponse.json({ result });
}

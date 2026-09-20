import { NextResponse } from "next/server";

import { deleteProvider, getProvider, updateProvider } from "@/lib/repo";
import type { ProviderInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const provider = getProvider(Number(id));
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ provider });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = (await request.json()) as Partial<ProviderInput>;
    const provider = updateProvider(Number(id), body);
    if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const ok = deleteProvider(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

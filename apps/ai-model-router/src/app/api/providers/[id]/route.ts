import { NextResponse } from "next/server";

import { deleteProvider, getProvider, updateProvider } from "@/lib/repo";
import { parseBody, updateProviderSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const provider = getProvider(Number(id));
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ provider });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = await parseBody(request, updateProviderSchema);
  if (!parsed.ok) return parsed.response;

  // apiKey stays tri-state through the schema: absent keeps the stored key,
  // "" clears it, a value replaces it. Do not default it anywhere.
  const provider = updateProvider(Number(id), parsed.data);
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ provider });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const ok = deleteProvider(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

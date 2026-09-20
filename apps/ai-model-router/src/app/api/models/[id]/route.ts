import { NextResponse } from "next/server";

import { deleteModel, getModel, updateModel } from "@/lib/repo";
import type { ModelInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  const model = getModel(Number(id));
  if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = (await request.json()) as Partial<ModelInput>;
    const model = updateModel(Number(id), body);
    if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ model });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  const ok = deleteModel(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

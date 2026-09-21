import { NextResponse } from "next/server";

import { deleteModel, getModel, updateModel } from "@/lib/repo";
import { parseBody, updateModelSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  const model = getModel(Number(id));
  if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, updateModelSchema);
  if (!parsed.ok) return parsed.response;

  const model = updateModel(Number(id), parsed.data);
  if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const { id } = await ctx.params;
  const ok = deleteModel(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

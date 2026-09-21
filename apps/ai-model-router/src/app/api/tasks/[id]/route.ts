import { NextResponse } from "next/server";

import { deleteTask, getTask, updateTask } from "@/lib/repo";
import { parseBody, updateTaskSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const task = getTask(Number(id));
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, updateTaskSchema);
  if (!parsed.ok) return parsed.response;

  const task = updateTask(Number(id), parsed.data);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const task = getTask(Number(id));
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (task.builtin) {
    return NextResponse.json(
      { error: "built-in tasks cannot be deleted — edit its weights instead" },
      { status: 400 },
    );
  }
  deleteTask(Number(id));
  return NextResponse.json({ ok: true });
}

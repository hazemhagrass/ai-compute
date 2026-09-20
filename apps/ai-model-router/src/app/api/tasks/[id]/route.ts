import { NextResponse } from "next/server";

import { deleteTask, getTask, updateTask } from "@/lib/repo";
import type { TaskInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const task = getTask(Number(id));
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = (await request.json()) as Partial<TaskInput>;
    const task = updateTask(Number(id), body);
    if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
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

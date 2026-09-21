import { NextResponse } from "next/server";

import { createTask, listTasks } from "@/lib/repo";
import { createTaskSchema, parseBody } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, createTaskSchema);
  if (!parsed.ok) return parsed.response;

  return NextResponse.json({ task: createTask(parsed.data) }, { status: 201 });
}

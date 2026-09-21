import { NextResponse } from "next/server";

import { createTask, listTasks } from "@/lib/repo";
import { createTaskSchema, parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createTaskSchema);
  if (!parsed.ok) return parsed.response;

  return NextResponse.json({ task: createTask(parsed.data) }, { status: 201 });
}

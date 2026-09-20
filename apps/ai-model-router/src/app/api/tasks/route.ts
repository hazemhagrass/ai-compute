import { NextResponse } from "next/server";

import { createTask, listTasks } from "@/lib/repo";
import type { TaskInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TaskInput;
    if (!body?.label?.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }
    return NextResponse.json({ task: createTask(body) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
}

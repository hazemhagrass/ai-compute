import { NextResponse } from "next/server";

import { createModel, listModels } from "@/lib/repo";
import type { ModelInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const enabledOnly = new URL(request.url).searchParams.get("enabled") === "1";
  return NextResponse.json({ models: listModels({ enabledOnly }) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelInput;
    if (!body?.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 400 });
    }
    if (!body?.modelId?.trim()) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }
    return NextResponse.json({ model: createModel(body) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
}

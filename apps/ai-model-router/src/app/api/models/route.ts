import { NextResponse } from "next/server";

import { createModel, listModels, queryModels } from "@/lib/repo";
import type { ModelInput } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Paginated by default. `all=1` returns every row and exists for the router,
 * which has to score every candidate; a table UI must never use it, because
 * importing the OpenRouter catalogue alone adds 446 rows.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const enabledOnly = sp.get("enabled") === "1";

  if (sp.get("all") === "1") {
    const models = listModels({ enabledOnly });
    return NextResponse.json({ models, total: models.length });
  }

  const num = (k: string) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  const { models, total } = queryModels({
    enabledOnly,
    providerId: num("providerId"),
    search: sp.get("q") ?? undefined,
    limit: num("limit") ?? 100,
    offset: Number(sp.get("offset")) || 0,
  });

  return NextResponse.json({ models, total });
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

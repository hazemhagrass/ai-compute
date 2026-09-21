import { NextResponse } from "next/server";

import { createModel, listModels, queryModels, getProvider } from "@/lib/repo";
import { createModelSchema, parseBody } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth";
import { validateModelIdAgainstProvider } from "@/lib/model-validation";

export const dynamic = "force-dynamic";

/**
 * Paginated by default. `all=1` returns every row and exists for the router,
 * which has to score every candidate; a table UI must never use it, because
 * importing the OpenRouter catalogue alone adds 446 rows.
 */
export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

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
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, createModelSchema);
  if (!parsed.ok) return parsed.response;

  const provider = getProvider(parsed.data.providerId);
  if (!provider) {
    return NextResponse.json({ error: "provider not found" }, { status: 404 });
  }
  const check = await validateModelIdAgainstProvider(provider, parsed.data.modelId);
  if (check.status === "mismatch") {
    return NextResponse.json(
      {
        error: `model id "${check.modelId}" was not found in ${provider.name}'s model catalogue`,
        code: "model_id_not_found",
        modelId: check.modelId,
        didYouMean: check.suggestions,
        catalogueSize: check.catalogueSize,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ model: createModel(parsed.data) }, { status: 201 });
}

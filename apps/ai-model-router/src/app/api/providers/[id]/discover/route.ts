import { NextResponse } from "next/server";

import { testConnection } from "@/lib/client";
import { cheapnessFromPrice, fetchCatalog, type CatalogEntry } from "@/lib/pricing";
import { createModel, getProvider, listModels } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .split("/")
    .pop()!
    .split(":")[0]
    .replace(/[._]/g, "-")
    .replace(/-latest$|-preview$|-\d{8}$/g, "")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Pull the provider's live model list and import any we don't have yet.
 * Each new model is enriched from the OpenRouter catalogue where a match
 * exists, so context window, price, and capability flags are real numbers
 * instead of zeros the user has to fill in by hand.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/providers/[id]/discover">,
) {
  const { id } = await ctx.params;
  const providerId = Number(id);
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await testConnection(provider);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "connection failed", result },
      { status: 502 },
    );
  }

  // Best-effort enrichment: discovery must still work fully offline.
  const catalog = new Map<string, CatalogEntry>();
  try {
    const { entries } = await fetchCatalog();
    for (const e of entries) {
      const key = normalizeId(e.id);
      // Canonical listings (no `:variant` suffix) win over batch/free variants.
      if (!catalog.has(key) || !e.id.includes(":")) catalog.set(key, e);
    }
  } catch {
    /* offline or rate-limited: fall back to plain defaults */
  }

  const isLocal = provider.kind === "local";
  const existing = new Set(
    listModels()
      .filter((m) => m.providerId === providerId)
      .map((m) => m.modelId),
  );

  const imported: string[] = [];
  let enriched = 0;

  for (const modelId of result.models ?? []) {
    if (existing.has(modelId)) continue;
    const hit = catalog.get(normalizeId(modelId));
    if (hit) enriched++;

    // Local models cost nothing to run, whatever the hosted listing says.
    const inputCost = isLocal ? 0 : (hit?.inputCost ?? 0);
    const outputCost = isLocal ? 0 : (hit?.outputCost ?? 0);

    createModel({
      providerId,
      modelId,
      label: hit?.name ?? modelId,
      quality: 60,
      speed: 60,
      cheapness: isLocal ? 100 : cheapnessFromPrice(outputCost),
      contextWindow: hit?.contextLength ?? 0,
      maxOutput: hit?.maxOutput ?? 0,
      inputCost,
      outputCost,
      features: {
        tools: hit?.supportsTools ?? true,
        json: hit?.supportsJson ?? true,
        streaming: true,
        vision: hit?.vision ?? false,
        reasoning: hit?.supportsReasoning ?? false,
        embedding: /embed/i.test(modelId),
      },
      tags: ["discovered", ...(isLocal ? ["local", "free"] : [])],
      notes: hit
        ? `Imported from ${provider.name}; specs matched to ${hit.id}. Tune the skill scores to taste.`
        : `Imported from ${provider.name}. No catalogue match — set context window and scores manually.`,
    });
    imported.push(modelId);
  }

  return NextResponse.json({
    imported,
    enriched,
    skipped: (result.models ?? []).length - imported.length,
    total: (result.models ?? []).length,
  });
}

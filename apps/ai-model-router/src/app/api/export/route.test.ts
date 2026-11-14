import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => null,
}));

vi.mock("@/lib/budget", () => ({
  listBudgets: () => [],
}));

vi.mock("@/lib/provider-keys", () => ({
  listProviderKeys: () => [],
}));

vi.mock("@/lib/repo", () => ({
  listModels: () => [],
  listProviders: () => [{ id: 1, slug: "openrouter", name: "OpenRouter" }],
  listTasks: () => [],
}));

vi.mock("@/lib/routing-policy", () => ({
  getRoutingPolicy: () => ({ preferLocal: false, fallbackToLocal: true }),
}));

vi.mock("@/lib/subscriptions", () => ({
  listSubscriptions: () => [],
}));

vi.mock("@/lib/pricing-freshness-store", () => ({
  getPricingFreshnessRecords: () => [
    { source: "openrouter", fetchedAt: 1_700_000_000_000 },
    { source: "hand-tuned", fetchedAt: null },
  ],
}));

const route = await import("@/app/api/export/route");

interface ExportPayload {
  version: number;
  exportedAt: string;
  routingPolicy: unknown;
  pricing: {
    sources: {
      source: string;
      fetchedAt: number | null;
      fetchedAtIso: string | null;
    }[];
  };
  providers: unknown[];
  models: unknown[];
}

describe("GET /api/export pricing timestamps", () => {
  it("includes a fetchedAt timestamp per pricing source", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as ExportPayload;

    expect(body.pricing.sources).toEqual([
      {
        source: "openrouter",
        fetchedAt: 1_700_000_000_000,
        fetchedAtIso: "2023-11-14T22:13:20.000Z",
      },
      { source: "hand-tuned", fetchedAt: null, fetchedAtIso: null },
    ]);
  });

  it("keeps the rest of the export payload unchanged", async () => {
    const res = await route.GET();
    const body = (await res.json()) as ExportPayload;

    expect(body.version).toBe(2);
    expect(typeof body.exportedAt).toBe("string");
    expect(body.routingPolicy).toEqual({ preferLocal: false, fallbackToLocal: true });
    expect(body.providers).toEqual([
      { id: 1, slug: "openrouter", name: "OpenRouter", keyPreview: undefined },
    ]);
    expect(body.models).toEqual([]);
  });
});

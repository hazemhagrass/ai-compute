import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => null),
}));

const getModelMock = vi.fn();
const updateModelMock = vi.fn();
vi.mock("@/lib/repo", () => ({
  getModel: (...args: unknown[]) => getModelMock(...args),
  updateModel: (...args: unknown[]) => updateModelMock(...args),
  getProvider: vi.fn(),
  deleteModel: vi.fn(),
}));

vi.mock("@/lib/model-validation", () => ({
  validateModelIdAgainstProvider: vi.fn(async () => ({ status: "ok" })),
}));

const store = new Map<string, string>();
vi.mock("@/lib/db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => { store.set(key, value); },
}));

const { getPricingAudit } = await import("@/lib/pricing-audit");

import { PATCH } from "./route";

beforeEach(() => {
  store.clear();
  getModelMock.mockReset();
  updateModelMock.mockReset();
});

describe("PATCH /api/models/[id] pricing audit", () => {
  it("changing inputCost appends manual_price_edit with modelId", async () => {
    getModelMock.mockReturnValue({ id: 1, modelId: "m1", providerId: 1, inputCost: 1, outputCost: 2, label: "M" });
    updateModelMock.mockReturnValue({ id: 1, modelId: "m1", providerId: 1, inputCost: 3, outputCost: 2, label: "M" });

    const req = new Request("http://localhost/api/models/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputCost: 3 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) } as never);
    expect(res.status).toBe(200);
    const audit = getPricingAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("manual_price_edit");
    expect((audit[0].details as { modelId: string }).modelId).toBe("m1");
  });

  it("name-only edit appends nothing", async () => {
    getModelMock.mockReturnValue({ id: 1, modelId: "m1", providerId: 1, inputCost: 1, outputCost: 2, label: "M" });
    updateModelMock.mockReturnValue({ id: 1, modelId: "m1", providerId: 1, inputCost: 1, outputCost: 2, label: "New" });

    const req = new Request("http://localhost/api/models/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "New" }),
    });
    await PATCH(req, { params: Promise.resolve({ id: "1" }) } as never);
    expect(getPricingAudit()).toHaveLength(0);
  });
});

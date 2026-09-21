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

const fetchModelsFromProviderMock = vi.fn();
vi.mock("@/lib/client", () => ({
  fetchModelsFromProvider: (...args: unknown[]) => fetchModelsFromProviderMock(...args),
}));

const getProviderMock = vi.fn();
const createModelMock = vi.fn();
vi.mock("@/lib/repo", () => ({
  getProvider: (...args: unknown[]) => getProviderMock(...args),
  createModel: (...args: unknown[]) => createModelMock(...args),
  listModels: vi.fn(() => []),
  queryModels: vi.fn(() => ({ models: [], total: 0 })),
}));

import { POST } from "./route";
import type { Provider } from "@/lib/types";

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 1,
    slug: "acme",
    name: "Acme",
    kind: "cloud",
    baseUrl: "https://api.acme.example/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    authHeaderName: "Authorization",
    authQueryName: "",
    headers: {},
    meta: {},
    enabled: true,
    hasKey: true,
    keyPreview: "sk-…1234",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = {
  providerId: 1,
  modelId: "acme-turbo-2",
  label: "Turbo 2",
};

describe("POST /api/models: provider catalogue validation", () => {
  beforeEach(() => {
    fetchModelsFromProviderMock.mockReset();
    getProviderMock.mockReset();
    createModelMock.mockReset();
    getProviderMock.mockReturnValue(makeProvider());
    createModelMock.mockImplementation((input) => ({ id: 42, ...input }));
  });

  it("saves silently on an exact match", async () => {
    fetchModelsFromProviderMock.mockResolvedValue([
      { id: "acme-turbo-1", label: "acme-turbo-1" },
      { id: "acme-turbo-2", label: "acme-turbo-2" },
    ]);

    const res = await post(validBody);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(createModelMock).toHaveBeenCalledOnce();
    expect(body.model.modelId).toBe("acme-turbo-2");
  });

  it("rejects an unknown id with a 409 and did-you-mean suggestions", async () => {
    fetchModelsFromProviderMock.mockResolvedValue([
      { id: "acme-turbo-2", label: "acme-turbo-2" },
      { id: "acme-turbo-2-mini", label: "acme-turbo-2-mini" },
      { id: "acme-embed-1", label: "acme-embed-1" },
    ]);

    const res = await post({ ...validBody, modelId: "acme-turbo2" });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("model_id_not_found");
    expect(body.modelId).toBe("acme-turbo2");
    expect(body.didYouMean.length).toBeGreaterThan(0);
    expect(body.didYouMean[0]).toBe("acme-turbo-2");
    expect(body.didYouMean[0]).not.toBe("acme-embed-1");
    expect(createModelMock).not.toHaveBeenCalled();
  });

  it("skips validation entirely for providers without a modelsPath", async () => {
    getProviderMock.mockReturnValue(makeProvider({ kind: "custom", modelsPath: "" }));

    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(fetchModelsFromProviderMock).not.toHaveBeenCalled();
    expect(createModelMock).toHaveBeenCalledOnce();
  });

  it("saves anyway when the discovery fetch fails (unverifiable, not a hard error)", async () => {
    fetchModelsFromProviderMock.mockRejectedValue(
      new Error("model discovery failed (HTTP 502): bad gateway"),
    );

    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(createModelMock).toHaveBeenCalledOnce();
  });

  it("returns 404 when the provider id does not exist", async () => {
    getProviderMock.mockReturnValue(null);

    const res = await post(validBody);

    expect(res.status).toBe(404);
    expect(createModelMock).not.toHaveBeenCalled();
  });
});

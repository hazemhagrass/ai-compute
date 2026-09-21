import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// A scratch data dir per run, set before the repo module resolves its paths,
// so tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-compare-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

// No password is configured in the scratch DB, so requireAuth passes through.

const client = await import("@/lib/client");
const repo = await import("@/lib/repo");
const usage = await import("@/lib/usage");

const chatSpy = vi.spyOn(client, "chat");
const recordSpy = vi.spyOn(usage, "recordUsage");

const route = await import("@/app/api/compare/route");

type ChatResult = Awaited<ReturnType<typeof client.chat>>;

function makeResponse(text: string, input: number, output: number): ChatResult {
  return {
    ok: true,
    text,
    usage: {
      inputTokens: input,
      outputTokens: output,
      totalTokens: input + output,
      cachedTokens: 0,
      reasoningTokens: 0,
      estimated: false,
    },
    latencyMs: 42,
  };
}

function makeFailure(error: string): ChatResult {
  return {
    ok: false,
    error,
    text: "",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      estimated: true,
    },
    latencyMs: 7,
  };
}

function post(body: unknown) {
  return route.POST(
    new Request("http://localhost/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

let modelAId: number;
let modelBId: number;

beforeAll(() => {
  const provider = repo.createProvider({
    name: "Compare Provider",
    baseUrl: "http://localhost:9999/v1",
    kind: "local",
    authType: "none",
  });
  const a = repo.createModel({
    providerId: provider.id,
    modelId: "compare-a",
    label: "Model A",
    inputCost: 3,
    outputCost: 15,
  });
  const b = repo.createModel({
    providerId: provider.id,
    modelId: "compare-b",
    label: "Model B",
    inputCost: 0.25,
    outputCost: 2,
  });
  modelAId = a.id;
  modelBId = b.id;
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("POST /api/compare", () => {
  it("runs both legs concurrently and reports latency, tokens, and cost for each", async () => {
    let resolveB!: (v: ReturnType<typeof makeResponse>) => void;
    const gateB = new Promise<ReturnType<typeof makeResponse>>((r) => {
      resolveB = r;
    });
    chatSpy.mockImplementation(async (_provider, modelId) => {
      if (modelId === "compare-a") return makeResponse("answer from A", 1000, 500);
      // B stays pending until the test opens the gate: if the route awaited A
      // before starting B, this implementation would never be reached.
      if (modelId === "compare-b") {
        gateB.then(resolveB); // keep the binding referenced
        return gateB;
      }
      throw new Error(`unexpected model ${modelId}`);
    });
    chatSpy.mockClear();
    recordSpy.mockClear();

    const pending = post({ modelRowIdA: modelAId, modelRowIdB: modelBId, prompt: "hello" });
    // Let the route start both legs, then release B.
    await new Promise((r) => setTimeout(r, 20));
    resolveB(makeResponse("answer from B", 2000, 100));
    const res = await pending;

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      a: { ok: boolean; text: string; costUsd: number; latencyMs: number; modelId: string };
      b: { ok: boolean; text: string; costUsd: number; latencyMs: number; modelId: string };
    };

    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(json.a.ok).toBe(true);
    expect(json.a.text).toBe("answer from A");
    expect(json.a.modelId).toBe("compare-a");
    expect(json.a.latencyMs).toBe(42);
    // 1000 in @ $3/1M + 500 out @ $15/1M = $0.0105
    expect(json.a.costUsd).toBeCloseTo(0.0105, 10);
    expect(json.b.ok).toBe(true);
    expect(json.b.text).toBe("answer from B");
    expect(json.b.modelId).toBe("compare-b");
    // 2000 in @ $0.25/1M + 100 out @ $2/1M = $0.0007
    expect(json.b.costUsd).toBeCloseTo(0.0007, 10);

    // Both legs are logged so comparison spend shows up in analytics.
    expect(recordSpy).toHaveBeenCalledTimes(2);
    expect(recordSpy.mock.calls.every(([input]) => input.source === "compare")).toBe(true);
    expect(recordSpy.mock.calls.every(([input]) => input.ok === true)).toBe(true);
  });

  it("returns the successful leg when the other provider fails", async () => {
    chatSpy.mockImplementation(async (_provider, modelId) => {
      if (modelId === "compare-a") return makeResponse("still here", 100, 50);
      return makeFailure("upstream exploded");
    });
    chatSpy.mockClear();
    recordSpy.mockClear();

    const res = await post({ modelRowIdA: modelAId, modelRowIdB: modelBId, prompt: "hi" });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      a: { ok: boolean; text: string; error: string };
      b: { ok: boolean; text: string; error: string };
    };

    expect(json.a.ok).toBe(true);
    expect(json.a.text).toBe("still here");
    expect(json.b.ok).toBe(false);
    expect(json.b.error).toBe("upstream exploded");
    expect(json.b.text).toBe("");

    expect(recordSpy).toHaveBeenCalledTimes(2);
    const byModel = new Map(recordSpy.mock.calls.map(([input]) => [input.modelId, input]));
    expect(byModel.get("compare-a")?.ok).toBe(true);
    expect(byModel.get("compare-b")?.ok).toBe(false);
    expect(byModel.get("compare-b")?.error).toBe("upstream exploded");
  });

  it("rejects a comparison of a model against itself", async () => {
    const res = await post({ modelRowIdA: modelAId, modelRowIdB: modelAId, prompt: "hi" });
    expect(res.status).toBe(422);
  });

  it("returns 404 for an unknown model without calling the provider", async () => {
    chatSpy.mockClear();
    const res = await post({ modelRowIdA: modelAId, modelRowIdB: 999999, prompt: "hi" });
    expect(res.status).toBe(404);
    expect(chatSpy).not.toHaveBeenCalled();
  });

  it("returns 422 when the prompt is missing", async () => {
    const res = await post({ modelRowIdA: modelAId, modelRowIdB: modelBId });
    expect(res.status).toBe(422);
  });
});

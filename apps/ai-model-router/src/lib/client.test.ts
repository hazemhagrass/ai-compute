import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  chatMessages,
  chatStreamMessages,
  estimateTokens,
  extractModelIds,
  normalizeShapeUsage,
  readUsage,
  redactSecrets,
  resolveShapeAdapter,
} from "./client";
import type { Provider } from "./types";

// A real database is required for rotation (#166): the key pool lives in it.
const DIR = mkdtempSync(join(tmpdir(), "amr-rotate-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "rotate.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const keysMod = await import("./provider-keys");
const repo = await import("./repo");

let rotateProviderId: number;
let keyIds: number[] = [];

beforeAll(() => {
  const p = repo.createProvider({
    name: "Rotate Target",
    baseUrl: "https://rotate.example/v1",
    authType: "bearer",
  });
  rotateProviderId = p.id;
  keyIds = [
    keysMod.addProviderKey(p.id, "sk-rotate-key-aaaaaaaa", "first", true).id,
    keysMod.addProviderKey(p.id, "sk-rotate-key-bbbbbbbb", "second", false).id,
    keysMod.addProviderKey(p.id, "sk-rotate-key-cccccccc", "third", false).id,
  ];
});

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

function baseProvider(overrides: Partial<Provider>): Provider {
  return {
    id: 1,
    slug: "p",
    name: "P",
    kind: "cloud",
    baseUrl: "https://api.example.com",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    authHeaderName: "Authorization",
    authQueryName: "",
    headers: {},
    meta: {},
    enabled: true,
    hasKey: false,
    keyPreview: "",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("redactSecrets", () => {
  const KEY = "sk-proj-abcdefghijklmnop1234567890";

  it("removes a key echoed verbatim in an upstream error body", () => {
    // The real leak: several providers include the submitted Authorization
    // header in their 401 body, which then reaches an error toast.
    const body = `{"error":{"message":"Incorrect API key provided: ${KEY}"}}`;

    const safe = redactSecrets(body, KEY);

    expect(safe).not.toContain(KEY);
    expect(safe).toContain("[REDACTED]");
  });

  it("removes a key echoed as only a prefix", () => {
    const body = `Invalid key starting with ${KEY.slice(0, 12)}...`;

    expect(redactSecrets(body, KEY)).not.toContain(KEY.slice(0, 12));
  });

  it("removes a key echoed as only a suffix", () => {
    const body = `Key ending in ${KEY.slice(-8)} is revoked`;

    expect(redactSecrets(body, KEY)).not.toContain(KEY.slice(-8));
  });

  it("removes a Bearer header echoed back", () => {
    const body = `Request had header: Authorization: Bearer ${KEY}`;

    const safe = redactSecrets(body, KEY);

    expect(safe).not.toContain(KEY);
  });

  it("removes a key belonging to a different provider than the one on file", () => {
    // Generic shape matching covers the case where the echoed key is not the
    // one currently stored, so the literal-string pass cannot catch it.
    for (const other of [
      "sk-ant-api03-zzzzzzzzzzzzzzzzzzzz",
      "gsk_aaaaaaaaaaaaaaaaaaaaaaaa",
      "xai-bbbbbbbbbbbbbbbbbbbbbbbb",
      "AIzaSyAbcdefghijklmnopqrstuvwxyz0123456",
    ]) {
      expect(redactSecrets(`upstream said: ${other}`, KEY)).not.toContain(other);
    }
  });

  it("leaves a harmless error message readable", () => {
    // Over-redaction makes errors useless, which is its own failure.
    const msg = "Model gpt-5.2 not found for this account";

    expect(redactSecrets(msg, KEY)).toBe(msg);
  });

  it("works with no stored key", () => {
    expect(redactSecrets("plain text")).toBe("plain text");
    expect(redactSecrets(`leaked ${KEY}`)).not.toContain(KEY);
  });

  it("handles empty input", () => {
    expect(redactSecrets("")).toBe("");
  });
});

describe("readUsage", () => {
  it("reads the OpenAI shape", () => {
    const u = readUsage(
      { usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 } },
      false,
      "prompt",
      "answer",
    );

    expect(u).toMatchObject({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
      estimated: false,
    });
  });

  it("reads the Anthropic shape", () => {
    const u = readUsage(
      { usage: { input_tokens: 200, output_tokens: 55 } },
      true,
      "prompt",
      "answer",
    );

    expect(u).toMatchObject({ inputTokens: 200, outputTokens: 55, estimated: false });
  });

  it("derives a total when the provider omits one", () => {
    const u = readUsage(
      { usage: { prompt_tokens: 10, completion_tokens: 5 } },
      false,
      "p",
      "a",
    );

    expect(u.totalTokens).toBe(15);
  });

  it("falls back to estimation and flags it when there is no usage block", () => {
    // The critical case: if a provider renames a field, cost silently becomes
    // a guess. The flag is the only thing that surfaces it.
    const u = readUsage({}, false, "x".repeat(400), "y".repeat(200));

    expect(u.estimated).toBe(true);
    expect(u.inputTokens).toBe(100); // 400 chars / 4
    expect(u.outputTokens).toBe(50); // 200 chars / 4
  });

  it("sums Anthropic cache reads and writes into cachedTokens", () => {
    const u = readUsage(
      {
        usage: {
          input_tokens: 50,
          output_tokens: 10,
          cache_read_input_tokens: 900,
          cache_creation_input_tokens: 100,
        },
      },
      true,
      "p",
      "a",
    );

    expect(u.cachedTokens).toBe(1000);
  });

  it("reads OpenAI cached tokens from the nested details object", () => {
    const u = readUsage(
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 10,
          prompt_tokens_details: { cached_tokens: 768 },
        },
      },
      false,
      "p",
      "a",
    );

    expect(u.cachedTokens).toBe(768);
  });

  it("reads reasoning tokens when present", () => {
    const u = readUsage(
      {
        usage: {
          prompt_tokens: 10,
          completion_tokens: 900,
          completion_tokens_details: { reasoning_tokens: 850 },
        },
      },
      false,
      "p",
      "a",
    );

    expect(u.reasoningTokens).toBe(850);
  });

  it("treats a malformed usage block as absent rather than throwing", () => {
    const u = readUsage(
      { usage: { prompt_tokens: "lots", completion_tokens: null } },
      false,
      "abcd",
      "efgh",
    );

    expect(u.estimated).toBe(true);
    expect(Number.isFinite(u.inputTokens)).toBe(true);
  });
});

describe("resolveShapeAdapter", () => {
  it("returns null for the default OpenAI-compatible path", () => {
    expect(resolveShapeAdapter(baseProvider({}), "")).toBeNull();
  });

  it("honors an explicit shape field over heuristics", () => {
    expect(resolveShapeAdapter(baseProvider({ shape: "gemini" }), "k")).not.toBeNull();
    expect(resolveShapeAdapter(baseProvider({ shape: "bedrock" }), "")).not.toBeNull();
  });

  it("lets shape openai short-circuit heuristic detection", () => {
    const p = baseProvider({
      shape: "openai",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      chatPath: "/chat/completions",
    });
    expect(resolveShapeAdapter(p, "")).toBeNull();
  });

  it("detects gemini natively when the openai shim is not used", () => {
    const p = baseProvider({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      chatPath: "/chat/completions",
    });
    expect(resolveShapeAdapter(p, "")).not.toBeNull();
  });

  it("keeps the gemini openai-compat shim on the default path", () => {
    const p = baseProvider({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      chatPath: "/openai/chat/completions",
    });
    expect(resolveShapeAdapter(p, "")).toBeNull();
  });

  it("detects bedrock from a converse chat path or the runtime host", () => {
    expect(
      resolveShapeAdapter(baseProvider({ chatPath: "/model/x/converse" }), ""),
    ).not.toBeNull();
    expect(
      resolveShapeAdapter(
        baseProvider({ baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com" }),
        "",
      ),
    ).not.toBeNull();
  });
});

describe("normalizeShapeUsage", () => {
  it("merges adapter usage into the shared usage shape", () => {
    const u = normalizeShapeUsage(
      { inputTokens: 120, outputTokens: 40, totalTokens: 160, cachedTokens: 30, reasoningTokens: 12 },
      "prompt text that should be ignored here",
      "answer text that should be ignored here",
    );
    expect(u).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
      cachedTokens: 30,
      reasoningTokens: 12,
      estimated: false,
    });
  });

  it("derives totals when the adapter omitted totalTokens", () => {
    const u = normalizeShapeUsage({ inputTokens: 7, outputTokens: 3, totalTokens: 0 }, "p", "a");
    expect(u.totalTokens).toBe(10);
    expect(u.cachedTokens).toBe(0);
    expect(u.reasoningTokens).toBe(0);
    expect(u.estimated).toBe(false);
  });

  it("falls back to text-length estimation when no usage arrived", () => {
    const prompt = "a".repeat(40); // 10 tokens at 4 chars/token
    const answer = "b".repeat(8); // 2 tokens
    const u = normalizeShapeUsage(null, prompt, answer);
    expect(u).toEqual({
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
      cachedTokens: 0,
      reasoningTokens: 0,
      estimated: true,
    });
  });

  it("treats an all-zero usage block as absent", () => {
    const u = normalizeShapeUsage(
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      "abcd", // 1 token
      "efgh", // 1 token
    );
    expect(u.estimated).toBe(true);
    expect(u.inputTokens).toBe(1);
    expect(u.outputTokens).toBe(1);
  });
});

describe("estimateTokens", () => {
  it("approximates at ~4 characters per token", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("returns 0 for empty input but never 0 for non-empty", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
  });
});

describe("extractModelIds", () => {
  it("reads the OpenAI data[] shape", () => {
    const ids = extractModelIds(
      JSON.stringify({ data: [{ id: "gpt-5.2" }, { id: "o4-mini" }] }),
    );

    expect(ids).toEqual(["gpt-5.2", "o4-mini"]);
  });

  it("reads the Ollama models[] shape", () => {
    const ids = extractModelIds(
      JSON.stringify({ models: [{ name: "qwen3:14b" }, { name: "llama3.1" }] }),
    );

    expect(ids).toEqual(["llama3.1", "qwen3:14b"]);
  });

  it("reads a bare array of strings", () => {
    expect(extractModelIds(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("deduplicates and sorts", () => {
    const ids = extractModelIds(
      JSON.stringify({ data: [{ id: "b" }, { id: "a" }, { id: "b" }] }),
    );

    expect(ids).toEqual(["a", "b"]);
  });

  it("returns empty rather than throwing on non-JSON", () => {
    // A provider returning an HTML error page must not crash discovery.
    expect(extractModelIds("<html>502 Bad Gateway</html>")).toEqual([]);
  });

  it("skips entries with no usable id", () => {
    const ids = extractModelIds(
      JSON.stringify({ data: [{ id: "ok" }, { foo: "bar" }, null] }),
    );

    expect(ids).toEqual(["ok"]);
  });
});


describe("rotation on auth failure (#166)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // Reset the pool to its seeded state between tests.
    keysMod.activateProviderKey(keyIds[0]);
  });

  function fetchReturning(status: number, body = "unauthorized"): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status, headers: { "content-type": "text/plain" } })),
    );
  }

  it("rotates to a spare key and succeeds on the retry", async () => {
    const p = repo.getProvider(rotateProviderId)!;
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return new Response("revoked", { status: 401 });
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok after rotate" } }] }), { status: 200 });
      }),
    );

    const result = await chatMessages(p, "g-x", "sys", [{ role: "user", content: "hi" }]);

    expect(result.ok).toBe(true);
    expect(result.text).toBe("ok after rotate");
    expect(call).toBe(2);
    // The second key became active.
    const active = keysMod.listProviderKeys(rotateProviderId).find((k) => k.active)!;
    expect(active.id).toBe(keyIds[1]);
  });

  it("records the failed verification for the revoked key", async () => {
    const p = repo.getProvider(rotateProviderId)!;
    fetchReturning(401, "token expired");

    await chatMessages(p, "g-x", "sys", [{ role: "user", content: "hi" }]);

    const revoked = keysMod.getProviderKey(keyIds[0])!;
    expect(revoked.lastVerifyOk).toBe(false);
    expect(revoked.lastVerifiedAt).not.toBe("");
    expect(revoked.lastVerifyError).toContain("token expired");
  });

  it("a retried call that also 401s reports exhaustion naming the count", async () => {
    const p = repo.getProvider(rotateProviderId)!;
    fetchReturning(401, "still bad");

    const result = await chatMessages(p, "g-x", "sys", [{ role: "user", content: "hi" }]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("all keys exhausted (2 tried: ");
    // The revoked key preview is named (#175): actionable from a screenshot.
    expect(result.error).toContain("rejected (401)");
    // Only one retry: fetch was called twice, not three times.
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    // The third key was never activated (one rotation per request).
    const active = keysMod.listProviderKeys(rotateProviderId).find((k) => k.active)!;
    expect(active.id).toBe(keyIds[1]);
  });

  it("a single-key provider reports exhaustion without rotating", async () => {
    const p2 = repo.createProvider({
      name: "Single Key",
      baseUrl: "https://single.example/v1",
      authType: "bearer",
    });
    keysMod.addProviderKey(p2.id, "sk-single-only-key-x", "only", true);
    const got = repo.getProvider(p2.id)!;
    fetchReturning(403, "forbidden");

    const result = await chatMessages(got, "g-x", "sys", [{ role: "user", content: "hi" }]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("all keys exhausted (1 tried");
  });

  it("streaming rotates before any byte is forwarded", async () => {
    const p = repo.getProvider(rotateProviderId)!;
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return new Response("revoked", { status: 401 });
        return new Response(
          "data: {\"choices\":[{\"delta\":{\"content\":\"stream-ok\"}}]}\n\ndata: [DONE]\n\n",
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }),
    );

    const tokens: string[] = [];
    const result = await chatStreamMessages(
      p,
      "g-x",
      "sys",
      [{ role: "user", content: "hi" }],
      120000,
      2000,
      { onToken: (t) => tokens.push(t) },
    );

    expect(result.ok).toBe(true);
    expect(result.text).toBe("stream-ok");
    expect(tokens).toEqual(["stream-ok"]);
    expect(call).toBe(2);
  });

  it("non-auth failures (500) never rotate", async () => {
    const p = repo.getProvider(rotateProviderId)!;
    fetchReturning(500, "boom");

    const result = await chatMessages(p, "g-x", "sys", [{ role: "user", content: "hi" }]);

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("exhausted");
    // Still the first key.
    const active = keysMod.listProviderKeys(rotateProviderId).find((k) => k.active)!;
    expect(active.id).toBe(keyIds[0]);
  });
});

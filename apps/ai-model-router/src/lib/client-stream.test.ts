import { afterEach, describe, expect, it, vi } from "vitest";

import type { Provider } from "./types";

/**
 * client.ts opens the SQLite database through repo.ts to resolve provider
 * secrets. Mocking that seam keeps these tests about the stream handling,
 * not about disk state.
 */
vi.mock("./repo", () => ({
  getProviderSecret: () => "",
}));

const { chatStream } = await import("./client");

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 1,
    slug: "test",
    name: "Test",
    kind: "cloud",
    baseUrl: "https://api.test/v1",
    chatPath: "/chat/completions",
    modelsPath: "",
    authType: "none",
    authHeaderName: "Authorization",
    authQueryName: "key",
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

/** Encode SSE frames the way an OpenAI-compatible provider sends them. */
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = chunks
    .map((c) => `data: ${c}\n\n`)
    .join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function sseChunk(delta: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    choices: [{ delta: { content: delta } }],
    ...extra,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chatStream streaming path", () => {
  it("requests stream:true and forwards each delta to onToken", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          sseBody([
            sseChunk("Hello"),
            sseChunk(", "),
            sseChunk("world"),
            JSON.stringify({ usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 } }),
            "[DONE]",
          ]),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }),
    );

    const tokens: string[] = [];
    const res = await chatStream(makeProvider(), "m", "", "hi", 5000, 100, {
      onToken: (t) => tokens.push(t),
    });

    expect(captured.body?.stream).toBe(true);
    // stream_options asks OpenAI-compatible servers for the final usage chunk.
    expect(captured.body?.stream_options).toEqual({ include_usage: true });
    expect(tokens).toEqual(["Hello", ", ", "world"]);
    expect(res.text).toBe("Hello, world");
    expect(res.streamed).toBe(true);
    expect(res.ok).toBe(true);
    // Usage comes from the provider's final usage chunk, not an estimate.
    expect(res.usage).toMatchObject({
      inputTokens: 12,
      outputTokens: 3,
      totalTokens: 15,
      estimated: false,
    });
  });

  it("parses Anthropic SSE events and forwards text deltas", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    const body = [
      JSON.stringify({ type: "content_block_delta", delta: { text: "Part" } }),
      JSON.stringify({ type: "content_block_delta", delta: { text: " two" } }),
      JSON.stringify({
        type: "message_delta",
        usage: { output_tokens: 4 },
      }),
      "[DONE]",
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(sseBody(body), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );

    const tokens: string[] = [];
    const res = await chatStream(
      makeProvider({ slug: "anthropic", chatPath: "/messages" }),
      "claude-x",
      "sys",
      "hi",
      5000,
      100,
      { onToken: (t) => tokens.push(t) },
    );

    expect(captured.body?.stream).toBe(true);
    expect(tokens).toEqual(["Part", " two"]);
    expect(res.text).toBe("Part two");
    expect(res.streamed).toBe(true);
    // Anthropic message_delta carries output tokens; input is estimated from
    // the transcript when message_start is absent.
    expect(res.usage.outputTokens).toBe(4);
    expect(res.usage.inputTokens).toBeGreaterThan(0);
  });
});

describe("chatStream fallback path", () => {
  it("parses a plain JSON body and reports streamed:false", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "full answer" } }],
            usage: { prompt_tokens: 20, completion_tokens: 6, total_tokens: 26 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const tokens: string[] = [];
    const res = await chatStream(makeProvider(), "m", "", "hi", 5000, 100, {
      onToken: (t) => tokens.push(t),
    });

    // The request still asks for streaming; the fallback is on the response.
    expect(captured.body?.stream).toBe(true);
    expect(res.streamed).toBe(false);
    expect(res.ok).toBe(true);
    expect(res.text).toBe("full answer");
    // The whole answer lands as a single token so the UI still paints it.
    expect(tokens).toEqual(["full answer"]);
    expect(res.usage).toMatchObject({
      inputTokens: 20,
      outputTokens: 6,
      totalTokens: 26,
      estimated: false,
    });
  });

  it("surfaces upstream errors without breaking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("model not found", { status: 404 })),
    );

    const res = await chatStream(makeProvider(), "m", "", "hi", 5000, 100, {
      onToken: () => {},
    });

    expect(res.ok).toBe(false);
    expect(res.streamed).toBe(false);
    expect(res.error).toContain("model not found");
  });
});

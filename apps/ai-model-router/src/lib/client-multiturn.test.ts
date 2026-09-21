import { afterEach, describe, expect, it, vi } from "vitest";

import type { Provider } from "./types";

/**
 * client.ts opens the SQLite database through repo.ts to resolve provider
 * secrets. Mocking that seam keeps these tests about the request shape,
 * not about disk state.
 */
vi.mock("./repo", () => ({
  getProviderSecret: () => "",
}));

const { chat, chatMessages } = await import("./client");

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

function okFetch(captured: { body?: Record<string, unknown> }) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "answer" } }],
        usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chatMessages", () => {
  it("sends prior turns ahead of the latest user message", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", okFetch(captured));

    const res = await chatMessages(
      makeProvider(),
      "m-1",
      "be brief",
      [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
        { role: "user", content: "follow up" },
      ],
      5000,
      100,
    );

    expect(res.ok).toBe(true);
    const messages = captured.body?.messages as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[3].content).toBe("follow up");
  });

  it("omits the system message when no system prompt is given", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", okFetch(captured));

    await chatMessages(
      makeProvider(),
      "m-1",
      "",
      [{ role: "user", content: "hello" }],
      5000,
      100,
    );

    const messages = captured.body?.messages as { role: string }[];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("estimates usage from the whole transcript when the provider reports none", async () => {
    // A multi-turn transcript must not be estimated as if it were one short
    // prompt, or the cumulative cost of a long chat is silently underbilled.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })),
    );

    const history = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `turn ${i} ${"lorem ipsum dolor sit amet ".repeat(20)}`,
    }));

    const single = await chat(makeProvider(), "m-1", "", "hi", 5000, 100);
    const multi = await chatMessages(makeProvider(), "m-1", "", history, 5000, 100);

    expect(single.usage.estimated).toBe(true);
    expect(multi.usage.estimated).toBe(true);
    expect(multi.usage.inputTokens).toBeGreaterThan(single.usage.inputTokens * 10);
  });

  it("keeps the Anthropic shape: system as a field, turns in messages", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "answer" }],
            usage: { input_tokens: 12, output_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const anthropic = makeProvider({ chatPath: "/messages", slug: "anthropic" });
    const res = await chatMessages(
      anthropic,
      "claude-x",
      "sys",
      [
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "q2" },
      ],
      5000,
      100,
    );

    expect(res.ok).toBe(true);
    expect(res.text).toBe("answer");
    expect(captured.body?.system).toBe("sys");
    const messages = captured.body?.messages as { role: string; content: string }[];
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({ role: "user", content: "q2" });
  });
});

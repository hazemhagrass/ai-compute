import { describe, expect, it } from "vitest";

import { estimateTokens, extractModelIds, readUsage } from "./client";

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

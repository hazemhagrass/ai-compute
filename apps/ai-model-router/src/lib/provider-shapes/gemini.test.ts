import { describe, expect, it } from "vitest";

import type { Provider } from "../types";
import {
  buildGeminiBody,
  createGeminiAdapter,
  extractGeminiText,
  readGeminiUsage,
} from "./gemini";

function geminiProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "prov_gem",
    slug: "google",
    name: "Google AI Studio (Gemini)",
    kind: "cloud",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    chatPath: "/models/gemini-3-pro:generateContent",
    modelsPath: "/models",
    authType: "query",
    authQueryName: "key",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Provider;
}

describe("gemini adapter request construction", () => {
  it("builds the generateContent URL with model id and API key query param", () => {
    const adapter = createGeminiAdapter(geminiProvider(), "test-key-123");
    expect(adapter.url("gemini-3-pro")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent?key=test-key-123",
    );
  });

  it("strips a trailing slash from the base URL", () => {
    const adapter = createGeminiAdapter(
      geminiProvider({ baseUrl: "https://generativelanguage.googleapis.com/v1beta/" }),
      "k",
    );
    expect(adapter.url("gemini-3-flash")).toContain("/v1beta/models/gemini-3-flash:generateContent");
  });

  it("maps user/assistant messages into contents with model role for assistant", () => {
    const body = JSON.parse(
      buildGeminiBody(
        "You are terse.",
        [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
          { role: "user", content: "2+2?" },
        ],
        512,
      ),
    );
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
      { role: "user", parts: [{ text: "2+2?" }] },
    ]);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 512 });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "You are terse." }] });
  });

  it("omits systemInstruction when the system prompt is blank", () => {
    const body = JSON.parse(
      buildGeminiBody("  ", [{ role: "user", content: "hi" }], 100),
    );
    expect(body.systemInstruction).toBeUndefined();
  });

  it("sends a JSON content type and no Authorization header", () => {
    const headers = createGeminiAdapter(geminiProvider(), "k").headers();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("gemini adapter response normalization", () => {
  it("extracts joined text from the first candidate parts", () => {
    const text = extractGeminiText({
      candidates: [{ content: { parts: [{ text: "The answer is " }, { text: "4." }] } }],
    });
    expect(text).toBe("The answer is 4.");
  });

  it("returns empty string for a malformed response", () => {
    expect(extractGeminiText({})).toBe("");
    expect(extractGeminiText(null)).toBe("");
  });

  it("normalizes usageMetadata into the shared usage shape", () => {
    const u = readGeminiUsage({
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 40,
        totalTokenCount: 160,
        cachedContentTokenCount: 30,
        thoughtsTokenCount: 12,
      },
    });
    expect(u).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
      cachedTokens: 30,
      reasoningTokens: 12,
    });
  });

  it("derives totals when totalTokenCount is missing", () => {
    const u = readGeminiUsage({
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    expect(u).toMatchObject({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it("returns null when no usage metadata is present", () => {
    expect(readGeminiUsage({ candidates: [] })).toBeNull();
  });
});

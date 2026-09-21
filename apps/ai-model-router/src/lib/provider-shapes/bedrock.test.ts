import { describe, expect, it } from "vitest";

import type { Provider } from "../types";
import {
  buildBedrockBody,
  createBedrockAdapter,
  extractBedrockText,
  readBedrockUsage,
} from "./bedrock";

function bedrockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "prov_bed",
    slug: "bedrock",
    name: "AWS Bedrock",
    kind: "cloud",
    baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    chatPath: "/model/anthropic.claude-sonnet-4-5/converse",
    modelsPath: "/foundation-models",
    authType: "none",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Provider;
}

describe("bedrock adapter request construction", () => {
  it("builds the converse URL with the model id", () => {
    const adapter = createBedrockAdapter(bedrockProvider());
    expect(adapter.url("anthropic.claude-sonnet-4-5")).toBe(
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-sonnet-4-5/converse",
    );
  });

  it("encodes model ids containing slashes", () => {
    const adapter = createBedrockAdapter(bedrockProvider());
    expect(adapter.url("us.anthropic.claude-sonnet-4-5-v2:0/variant")).toContain(
      "/model/us.anthropic.claude-sonnet-4-5-v2%3A0%2Fvariant/converse",
    );
  });

  it("maps messages into content blocks and keeps roles", () => {
    const body = JSON.parse(
      buildBedrockBody(
        "Be brief.",
        [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
          { role: "user", content: "what is 2+2?" },
        ],
        256,
      ),
    );
    expect(body.messages).toEqual([
      { role: "user", content: [{ text: "hi" }] },
      { role: "assistant", content: [{ text: "hello" }] },
      { role: "user", content: [{ text: "what is 2+2?" }] },
    ]);
    expect(body.inferenceConfig).toEqual({ maxTokens: 256 });
    expect(body.system).toEqual([{ text: "Be brief." }]);
  });

  it("omits the system block when the system prompt is blank", () => {
    const body = JSON.parse(
      buildBedrockBody("", [{ role: "user", content: "hi" }], 100),
    );
    expect(body.system).toBeUndefined();
  });

  it("sends JSON headers; SigV4 auth headers come from the isolated auth step", () => {
    const headers = createBedrockAdapter(bedrockProvider()).headers();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("application/json");
    // No fake signing: without AWS credentials no Authorization header is set.
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("bedrock adapter response normalization", () => {
  it("extracts joined text from output message content blocks", () => {
    const text = extractBedrockText({
      output: { message: { content: [{ text: "4" }, { text: " exactly" }] } },
    });
    expect(text).toBe("4 exactly");
  });

  it("returns empty string for a malformed response", () => {
    expect(extractBedrockText({})).toBe("");
    expect(extractBedrockText(null)).toBe("");
  });

  it("normalizes the converse usage block into the shared usage shape", () => {
    const u = readBedrockUsage({
      usage: {
        inputTokens: 210,
        outputTokens: 64,
        totalTokens: 274,
        cacheReadInputTokens: 100,
        cacheWriteInputTokens: 40,
      },
    });
    expect(u).toEqual({
      inputTokens: 210,
      outputTokens: 64,
      totalTokens: 274,
      cachedTokens: 140,
    });
  });

  it("derives totals when totalTokens is missing", () => {
    const u = readBedrockUsage({ usage: { inputTokens: 7, outputTokens: 3 } });
    expect(u).toMatchObject({ inputTokens: 7, outputTokens: 3, totalTokens: 10 });
  });

  it("returns null when no usage block is present", () => {
    expect(readBedrockUsage({ output: {} })).toBeNull();
  });
});

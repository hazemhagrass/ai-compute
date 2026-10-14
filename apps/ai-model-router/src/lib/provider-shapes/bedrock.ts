import type { Provider } from "../types";
import type { ProviderShapeAdapter, ShapeMessage, ShapeUsage } from "./types";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function bedrockAuthHeaders(): Record<string, string> {
  return {};
}

export function buildBedrockBody(
  system: string,
  messages: ShapeMessage[],
  maxTokens: number,
): string {
  const body: Record<string, unknown> = {
    messages: messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: { maxTokens },
  };
  if (system.trim()) {
    body.system = [{ text: system }];
  }
  return JSON.stringify(body);
}

export function bedrockUrl(baseUrl: string, modelId: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/model/${encodeURIComponent(modelId)}/converse`;
}

export function extractBedrockText(json: unknown): string {
  const root = asRecord(json);
  const message = asRecord(asRecord(root?.output)?.message);
  const content = Array.isArray(message?.content) ? (message.content as unknown[]) : [];
  return content
    .map((b) => asRecord(b)?.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
}

export function readBedrockUsage(json: unknown): ShapeUsage | null {
  const usage = asRecord(asRecord(json)?.usage);
  if (!usage) return null;
  const input = num(usage.inputTokens);
  const output = num(usage.outputTokens);
  if (input === null && output === null) return null;
  const result: ShapeUsage = {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    totalTokens: num(usage.totalTokens) ?? (input ?? 0) + (output ?? 0),
  };
  const cacheRead = num(usage.cacheReadInputTokens);
  const cacheWrite = num(usage.cacheWriteInputTokens);
  if (cacheRead !== null || cacheWrite !== null) {
    result.cachedTokens = (cacheRead ?? 0) + (cacheWrite ?? 0);
  }
  return result;
}

export function createBedrockAdapter(provider: Provider): ProviderShapeAdapter {
  return {
    url: (modelId) => bedrockUrl(provider.baseUrl, modelId),
    headers: () => ({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...bedrockAuthHeaders(),
    }),
    body: (system, messages, maxTokens) => buildBedrockBody(system, messages, maxTokens),
    extractText: extractBedrockText,
    readUsage: readBedrockUsage,
  };
}

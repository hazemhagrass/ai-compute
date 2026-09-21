// Google Gemini native shape: POST {base}/models/{model}:generateContent
// Auth: API key as ?key= query param (per provider.authQueryName).
// Ref: https://ai.google.dev/api/generate-content

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

export function buildGeminiBody(
  system: string,
  messages: ShapeMessage[],
  maxTokens: number,
): string {
  const body: Record<string, unknown> = {
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (system.trim()) {
    body.systemInstruction = { parts: [{ text: system }] };
  }
  return JSON.stringify(body);
}

export function geminiUrl(
  baseUrl: string,
  authQueryName: string,
  apiKey: string,
  modelId: string,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/models/${encodeURIComponent(modelId)}:generateContent`);
  if (apiKey) url.searchParams.set(authQueryName || "key", apiKey);
  return url.toString();
}

export function extractGeminiText(json: unknown): string {
  const root = asRecord(json);
  const candidates = Array.isArray(root?.candidates) ? (root.candidates as unknown[]) : [];
  for (const c of candidates) {
    const content = asRecord(asRecord(c)?.content);
    const parts = Array.isArray(content?.parts) ? (content.parts as unknown[]) : [];
    const text = parts
      .map((p) => asRecord(p)?.text)
      .filter((t): t is string => typeof t === "string")
      .join("");
    if (text) return text;
  }
  return "";
}

export function readGeminiUsage(json: unknown): ShapeUsage | null {
  const meta = asRecord(asRecord(json)?.usageMetadata);
  if (!meta) return null;
  const input = num(meta.promptTokenCount);
  const output = num(meta.candidatesTokenCount);
  if (input === null && output === null) return null;
  const usage: ShapeUsage = {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    totalTokens: num(meta.totalTokenCount) ?? (input ?? 0) + (output ?? 0),
  };
  const cached = num(meta.cachedContentTokenCount);
  if (cached !== null) usage.cachedTokens = cached;
  const thoughts = num(meta.thoughtsTokenCount);
  if (thoughts !== null) usage.reasoningTokens = thoughts;
  return usage;
}

export function createGeminiAdapter(provider: Provider, apiKey: string): ProviderShapeAdapter {
  return {
    url: (modelId) =>
      geminiUrl(provider.baseUrl, provider.authQueryName || "key", apiKey, modelId),
    headers: () => ({ "Content-Type": "application/json" }),
    body: (system, messages, maxTokens) => buildGeminiBody(system, messages, maxTokens),
    extractText: extractGeminiText,
    readUsage: readGeminiUsage,
  };
}

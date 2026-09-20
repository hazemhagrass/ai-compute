import { getProviderSecret } from "./repo";
import type { Provider } from "./types";

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Build URL + headers for a provider call, injecting the decrypted secret. */
export function buildRequest(
  provider: Provider,
  path: string,
): { url: string; headers: Record<string, string> } {
  const key = getProviderSecret(provider.id);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...provider.headers,
  };
  let url = joinUrl(provider.baseUrl, path);

  if (key) {
    switch (provider.authType) {
      case "bearer":
        headers[provider.authHeaderName || "Authorization"] = `Bearer ${key}`;
        break;
      case "header":
        headers[provider.authHeaderName || "Authorization"] = key;
        break;
      case "basic":
        headers["Authorization"] = `Basic ${Buffer.from(key).toString("base64")}`;
        break;
      case "query": {
        const u = new URL(url);
        u.searchParams.set(provider.authQueryName || "key", key);
        url = u.toString();
        break;
      }
      case "none":
      default:
        break;
    }
  }
  return { url, headers };
}

export interface ConnectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  modelCount?: number;
  models?: string[];
  error?: string;
}

/** Hit the provider's models endpoint to verify base URL + credentials. */
export async function testConnection(
  provider: Provider,
  timeoutMs = 12000,
): Promise<ConnectionResult> {
  const path = provider.modelsPath || "/models";
  const { url, headers } = buildRequest(provider, path);
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    const latencyMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        latencyMs,
        error: text.slice(0, 400) || res.statusText,
      };
    }

    const models = extractModelIds(text);
    return { ok: true, status: res.status, latencyMs, modelCount: models.length, models };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Handles OpenAI (`data[]`), Anthropic (`data[]`), Ollama (`models[]`) shapes. */
export function extractModelIds(body: string): string[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return [];
  }
  const root = json as Record<string, unknown>;
  const arr =
    (Array.isArray(root?.data) && root.data) ||
    (Array.isArray(root?.models) && root.models) ||
    (Array.isArray(json) && json) ||
    [];
  const out: string[] = [];
  for (const item of arr as unknown[]) {
    if (typeof item === "string") out.push(item);
    else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const id = o.id ?? o.name ?? o.model;
      if (typeof id === "string") out.push(id);
    }
  }
  return [...new Set(out)].sort();
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  /** true when the provider gave no usage block and we approximated from text length */
  estimated: boolean;
}

export interface ChatResult {
  ok: boolean;
  text: string;
  raw?: unknown;
  error?: string;
  usage: ChatUsage;
  latencyMs: number;
}

/** ~4 chars per token is the standard rough approximation across tokenizers. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Normalize a provider's usage block. Exported for tests: this is the path
 * most likely to break silently, because a renamed field downgrades cost
 * reporting to a ~4 chars/token guess with nothing but the `estimated`
 * flag to signal it.
 */
export function readUsage(
  json: Record<string, unknown>,
  isAnthropic: boolean,
  promptText: string,
  answerText: string,
): ChatUsage {
  const u = (json.usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  let inputTokens = isAnthropic
    ? num(u.input_tokens)
    : num(u.prompt_tokens) || num(u.input_tokens);
  let outputTokens = isAnthropic
    ? num(u.output_tokens)
    : num(u.completion_tokens) || num(u.output_tokens);

  const cachedTokens = isAnthropic
    ? num(u.cache_read_input_tokens) + num(u.cache_creation_input_tokens)
    : num((u.prompt_tokens_details as Record<string, unknown>)?.cached_tokens);
  const reasoningTokens = num(
    (u.completion_tokens_details as Record<string, unknown>)?.reasoning_tokens,
  );

  let estimated = false;
  if (!inputTokens && !outputTokens) {
    estimated = true;
    inputTokens = estimateTokens(promptText);
    outputTokens = estimateTokens(answerText);
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: num(u.total_tokens) || inputTokens + outputTokens,
    cachedTokens,
    reasoningTokens,
    estimated,
  };
}

/**
 * Minimal chat call used by the AI-assisted recommender and the playground.
 * Supports OpenAI-compatible and Anthropic Messages shapes, and always
 * reports token usage (measured when the provider returns it, estimated otherwise).
 */
export async function chat(
  provider: Provider,
  modelId: string,
  system: string,
  user: string,
  timeoutMs = 120000,
  maxTokens = 2000,
): Promise<ChatResult> {
  const isAnthropic =
    provider.chatPath.includes("/messages") || provider.slug === "anthropic";
  const { url, headers } = buildRequest(provider, provider.chatPath || "/chat/completions");

  const body = isAnthropic
    ? {
        model: modelId,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }
    : {
        model: modelId,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user },
        ],
        temperature: 0.2,
      };

  const emptyUsage: ChatUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    estimated: true,
  };

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        text: "",
        error: text.slice(0, 600) || res.statusText,
        usage: { ...emptyUsage, inputTokens: estimateTokens(`${system}${user}`) },
        latencyMs,
      };
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    let content = "";
    if (isAnthropic) {
      const blocks = json.content as { type?: string; text?: string }[] | undefined;
      content = (blocks ?? []).map((b) => b?.text ?? "").join("").trim();
    } else {
      const choices = json.choices as
        | { message?: { content?: string }; text?: string }[]
        | undefined;
      content = (choices?.[0]?.message?.content ?? choices?.[0]?.text ?? "").trim();
    }

    return {
      ok: true,
      text: content,
      raw: json,
      usage: readUsage(json, isAnthropic, `${system}\n${user}`, content),
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      text: "",
      error: err instanceof Error ? err.message : String(err),
      usage: { ...emptyUsage, inputTokens: estimateTokens(`${system}${user}`) },
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

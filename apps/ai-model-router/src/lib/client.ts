import { getProviderSecret } from "./repo";
import { createBedrockAdapter } from "./provider-shapes/bedrock";
import { createGeminiAdapter } from "./provider-shapes/gemini";
import type { ProviderShapeAdapter, ShapeUsage } from "./provider-shapes/types";
import type { Provider } from "./types";

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

const KEY_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bxai-[A-Za-z0-9]{20,}/g,
  /\bAIza[A-Za-z0-9_-]{30,}/g,
  /\bfw_[A-Za-z0-9]{20,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
];

export function redactSecrets(text: string, secret?: string): string {
  if (!text) return text;
  let out = text;

  if (secret && secret.length >= 8) {
    out = out.split(secret).join("[REDACTED]");
    const head = secret.slice(0, 12);
    const tail = secret.slice(-8);
    if (head.length >= 8) out = out.split(head).join("[REDACTED]");
    if (tail.length >= 8) out = out.split(tail).join("[REDACTED]");
  }

  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out;
}

export function buildRequest(
  provider: Provider,
  path: string,
  explicitKey?: string,
): { url: string; headers: Record<string, string> } {
  const key = explicitKey !== undefined ? explicitKey : getProviderSecret(provider.id);
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

export async function fetchModelsFromProvider(
  provider: Provider,
  timeoutMs = 12000,
): Promise<{ id: string; label: string }[]> {
  const { url, headers } = buildRequest(provider, provider.modelsPath);
  const secret = getProviderSecret(provider.id);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `model discovery failed (HTTP ${res.status}): ${redactSecrets(body.slice(0, 400), secret)}`,
    );
  }
  return extractModelIds(body).map((id) => ({ id, label: id }));
}

export interface ConnectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  modelCount?: number;
  models?: string[];
  error?: string;
}

export async function testConnection(
  provider: Provider,
  timeoutMs = 12000,
): Promise<ConnectionResult> {
  const path = provider.modelsPath || "/models";
  const { url, headers } = buildRequest(provider, path);
  const secret = getProviderSecret(provider.id);
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
        error: redactSecrets(text.slice(0, 400) || res.statusText, secret),
      };
    }

    const models = extractModelIds(text);
    return { ok: true, status: res.status, latencyMs, modelCount: models.length, models };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: redactSecrets(err instanceof Error ? err.message : String(err), secret),
    };
  } finally {
    clearTimeout(timer);
  }
}

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
  estimated: boolean;
}

export interface ChatResult {
  ok: boolean;
  text: string;
  raw?: unknown;
  error?: string;
  usage: ChatUsage;
  latencyMs: number;
  status?: number;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function normalizeShapeUsage(
  partial: ShapeUsage | null,
  promptText: string,
  answerText: string,
): ChatUsage {
  if (!partial || (!partial.inputTokens && !partial.outputTokens)) {
    return {
      inputTokens: estimateTokens(promptText),
      outputTokens: estimateTokens(answerText),
      totalTokens: estimateTokens(promptText) + estimateTokens(answerText),
      cachedTokens: 0,
      reasoningTokens: 0,
      estimated: true,
    };
  }
  return {
    inputTokens: partial.inputTokens,
    outputTokens: partial.outputTokens,
    totalTokens: partial.totalTokens || partial.inputTokens + partial.outputTokens,
    cachedTokens: partial.cachedTokens ?? 0,
    reasoningTokens: partial.reasoningTokens ?? 0,
    estimated: false,
  };
}

export function resolveShapeAdapter(
  provider: Provider,
  secret: string,
): ProviderShapeAdapter | null {
  const declared = (provider.shape ?? provider.meta?.shape ?? "").toLowerCase();
  if (declared === "openai") return null;
  if (declared === "bedrock") return createBedrockAdapter(provider);
  if (declared === "gemini") return createGeminiAdapter(provider, secret);
  const path = (provider.chatPath ?? "").toLowerCase();
  if (path.includes("/converse") || provider.baseUrl.includes("bedrock-runtime")) {
    return createBedrockAdapter(provider);
  }
  if (provider.baseUrl.includes("generativelanguage.googleapis.com")) {
    if (path.startsWith("/openai")) return null;
    return createGeminiAdapter(provider, secret);
  }
  return null;
}

async function chatViaShape(
  adapter: ProviderShapeAdapter,
  modelId: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs: number,
  maxTokens: number,
  secret: string,
  transcript: string,
  emptyUsage: ChatUsage,
): Promise<ChatResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(adapter.url(modelId), {
      method: "POST",
      headers: adapter.headers(),
      body: adapter.body(system, messages, maxTokens),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        text: "",
        error: redactSecrets(text.slice(0, 600) || res.statusText, secret),
        usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
        latencyMs,
      };
    }

    const json = JSON.parse(text) as unknown;
    const content = adapter.extractText(json).trim();
    return {
      ok: true,
      text: content,
      raw: json,
      usage: normalizeShapeUsage(adapter.readUsage(json), transcript, content),
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      text: "",
      error: redactSecrets(err instanceof Error ? err.message : String(err), secret),
      usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(
  provider: Provider,
  modelId: string,
  system: string,
  user: string,
  timeoutMs = 120000,
  maxTokens = 2000,
): Promise<ChatResult> {
  return chatMessages(
    provider,
    modelId,
    system,
    [{ role: "user", content: user }],
    timeoutMs,
    maxTokens,
  );
}

async function maybeRotateAndRetry<T extends ChatResult>(
  result: T,
  provider: Provider,
  allowRotation: boolean,
  retry: () => Promise<T>,
  trail: string[] = [],
): Promise<T> {
  if (result.ok) return result;
  if (result.status !== 401 && result.status !== 403) return result;

  const pk = await import("./provider-keys");

  if (!allowRotation) {
    const revoked = pk.identityOfActiveKey(provider.id);
    pk.recordAuthFailure(provider.id, result.error ?? "");
    trail.push(
      `${revoked?.keyPreview ?? "active key"} rejected (${result.status})`,
    );
    return {
      ...result,
      error: `all keys exhausted (2 tried: ${trail.join(", ")}): ${result.error ?? ""}`.trim(),
    };
  }

  const outcome = pk.handleAuthFailure(provider.id, result.error ?? "");
  if (outcome.revokedPreview) {
    trail.push(`${outcome.revokedPreview} rejected (${result.status})`);
  }

  if (!outcome.retry) {
    return {
      ...result,
      error: `all keys exhausted (${outcome.keysTried} tried${trail.length ? `: ${trail.join(", ")}` : ""}): ${result.error ?? ""}`.trim(),
    };
  }

  return retry();
}

export async function chatMessages(
  provider: Provider,
  modelId: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs = 120000,
  maxTokens = 2000,
  _allowRotation = true,
  trail: string[] = [],
): Promise<ChatResult> {
  const isAnthropic =
    provider.chatPath.includes("/messages") || provider.slug === "anthropic";

  const transcript = `${system}\n${messages.map((m) => m.content).join("\n")}`;

  const emptyUsage: ChatUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    estimated: true,
  };

  if (!isAnthropic) {
    const secret = provider.authType === "none" ? "" : (getProviderSecret(provider.id) ?? "");
    const adapter = resolveShapeAdapter(provider, secret);
    if (adapter) {
      const result = await chatViaShape(
        adapter,
        modelId,
        system,
        messages,
        timeoutMs,
        maxTokens,
        secret,
        transcript,
        emptyUsage,
      );
      return maybeRotateAndRetry(result, provider, _allowRotation, () =>
        chatMessages(provider, modelId, system, messages, timeoutMs, maxTokens, false, trail),
      );
    }
  }

  const { url, headers } = buildRequest(provider, provider.chatPath || "/chat/completions");
  const secret = getProviderSecret(provider.id);

  const body = isAnthropic
    ? {
        model: modelId,
        max_tokens: maxTokens,
        system,
        messages,
      }
    : {
        model: modelId,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          ...messages,
        ],
        temperature: 0.2,
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
      const failed: ChatResult = {
        ok: false,
        status: res.status,
        text: "",
        error: redactSecrets(text.slice(0, 600) || res.statusText, secret),
        usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
        latencyMs,
      };
      return maybeRotateAndRetry(failed, provider, _allowRotation, () =>
        chatMessages(provider, modelId, system, messages, timeoutMs, maxTokens, false, trail),
      );
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
      usage: readUsage(json, isAnthropic, transcript, content),
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      text: "",
      error: redactSecrets(err instanceof Error ? err.message : String(err), secret),
      usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatStreamResult extends ChatResult {
  streamed: boolean;
}

export interface ChatStreamCallbacks {
  onToken?: (text: string) => void;
}

function extractTextFromJson(json: Record<string, unknown>, isAnthropic: boolean): string {
  if (isAnthropic) {
    const blocks = json.content as { type?: string; text?: string }[] | undefined;
    return (blocks ?? []).map((b) => b?.text ?? "").join("").trim();
  }
  const choices = json.choices as
    | { message?: { content?: string }; text?: string }[]
    | undefined;
  return (choices?.[0]?.message?.content ?? choices?.[0]?.text ?? "").trim();
}

export async function chatStream(
  provider: Provider,
  modelId: string,
  system: string,
  user: string,
  timeoutMs = 120000,
  maxTokens = 2000,
  cb: ChatStreamCallbacks = {},
): Promise<ChatStreamResult> {
  return chatStreamMessages(
    provider,
    modelId,
    system,
    [{ role: "user", content: user }],
    timeoutMs,
    maxTokens,
    cb,
  );
}

export async function chatStreamMessages(
  provider: Provider,
  modelId: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs = 120000,
  maxTokens = 2000,
  cb: ChatStreamCallbacks = {},
  _allowRotation = true,
  trail: string[] = [],
): Promise<ChatStreamResult> {
  const isAnthropic =
    provider.chatPath.includes("/messages") || provider.slug === "anthropic";
  const { url, headers } = buildRequest(provider, provider.chatPath || "/chat/completions");
  const secret = getProviderSecret(provider.id);

  const body = isAnthropic
    ? {
        model: modelId,
        max_tokens: maxTokens,
        system,
        messages,
        stream: true,
      }
    : {
        model: modelId,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          ...messages,
        ],
        temperature: 0.2,
        stream: true,
        stream_options: { include_usage: true },
      };

  const transcript = `${system}\n${messages.map((m) => m.content).join("\n")}`;

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

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const failed: ChatStreamResult = {
        ok: false,
        streamed: false,
        text: "",
        status: res.status,
        error: redactSecrets(text.slice(0, 600) || res.statusText, secret),
        usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
        latencyMs: Date.now() - started,
      };
      return maybeRotateAndRetry(failed, provider, _allowRotation, () =>
        chatStreamMessages(provider, modelId, system, messages, timeoutMs, maxTokens, cb, false, trail),
      );
    }

    const ctype = res.headers.get("content-type") ?? "";

    if (!res.body || !ctype.includes("text/event-stream")) {
      const text = await res.text();
      let content = "";
      let usage: ChatUsage;
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        content = extractTextFromJson(json, isAnthropic);
        usage = readUsage(json, isAnthropic, transcript, content);
      } catch {
        usage = { ...emptyUsage, inputTokens: estimateTokens(transcript) };
      }
      if (content) cb.onToken?.(content);
      return {
        ok: Boolean(content),
        streamed: false,
        text: content,
        error: content ? undefined : "no text in response",
        usage,
        latencyMs: Date.now() - started,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let streamError = "";
    const usageRaw: Record<string, unknown> = {};
    let sawUsage = false;

    const mergeUsage = (u: unknown) => {
      if (!u || typeof u !== "object") return;
      sawUsage = true;
      Object.assign(usageRaw, u as Record<string, unknown>);
    };

    const handleData = (payload: string) => {
      if (!payload || payload === "[DONE]") return;
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return;
      }

      if (isAnthropic) {
        const type = chunk.type as string | undefined;
        if (type === "content_block_delta") {
          const delta = (chunk.delta as { type?: string; text?: unknown } | undefined)?.text;
          if (typeof delta === "string" && delta) {
            full += delta;
            cb.onToken?.(delta);
          }
        } else if (type === "message_start") {
          mergeUsage((chunk.message as Record<string, unknown> | undefined)?.usage);
        } else if (type === "message_delta") {
          mergeUsage(chunk.usage);
        }
        return;
      }

      mergeUsage(chunk.usage);
      const delta = (chunk.choices as { delta?: { content?: unknown } }[] | undefined)?.[0]
        ?.delta?.content;
      if (typeof delta === "string" && delta) {
        full += delta;
        cb.onToken?.(delta);
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const rawEvent of events) {
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("data:")) handleData(line.slice(5).trim());
          }
        }
      }
      buffer += decoder.decode();
      for (const line of buffer.split("\n")) {
        if (line.startsWith("data:")) handleData(line.slice(5).trim());
      }
    } catch (err) {
      streamError = ctrl.signal.aborted
        ? "request timed out"
        : err instanceof Error
          ? err.message
          : String(err);
    } finally {
      reader.releaseLock();
    }

    let usage: ChatUsage;
    if (sawUsage) {
      usage = readUsage({ usage: usageRaw }, isAnthropic, transcript, full);
      if (usage.inputTokens === 0) {
        usage.inputTokens = estimateTokens(transcript);
        usage.totalTokens = usage.inputTokens + usage.outputTokens;
      }
    } else {
      usage = {
        inputTokens: estimateTokens(transcript),
        outputTokens: estimateTokens(full),
        totalTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        estimated: true,
      };
      usage.totalTokens = usage.inputTokens + usage.outputTokens;
    }

    return {
      ok: Boolean(full) && !streamError,
      streamed: true,
      text: full,
      error: streamError || (full ? undefined : "no text in response"),
      usage,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      streamed: false,
      text: "",
      error: redactSecrets(err instanceof Error ? err.message : String(err), secret),
      usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

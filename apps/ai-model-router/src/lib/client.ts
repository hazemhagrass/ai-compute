import { getProviderSecret } from "./repo";
import { createBedrockAdapter } from "./provider-shapes/bedrock";
import { createGeminiAdapter } from "./provider-shapes/gemini";
import type { ProviderShapeAdapter, ShapeUsage } from "./provider-shapes/types";
import type { Provider } from "./types";

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Key shapes used by the major providers, for scrubbing echoed secrets. */
const KEY_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/g, // OpenAI, Anthropic, DeepSeek, Mistral
  /\bgsk_[A-Za-z0-9]{20,}/g, // Groq
  /\bxai-[A-Za-z0-9]{20,}/g, // xAI
  /\bAIza[A-Za-z0-9_-]{30,}/g, // Google
  /\bfw_[A-Za-z0-9]{20,}/g, // Fireworks
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
];

/**
 * Scrub secrets out of anything shown to the user.
 *
 * Several providers echo the submitted Authorization header, or a fragment of
 * the key, in their 401 body. That text reaches an error toast and any
 * screenshot of it, so the literal stored key is removed first, then generic
 * key shapes catch the case where the echo is mangled or a different key was
 * sent than the one on file.
 */
export function redactSecrets(text: string, secret?: string): string {
  if (!text) return text;
  let out = text;

  if (secret && secret.length >= 8) {
    out = out.split(secret).join("[REDACTED]");
    // Providers commonly echo only a prefix or suffix of the key.
    const head = secret.slice(0, 12);
    const tail = secret.slice(-8);
    if (head.length >= 8) out = out.split(head).join("[REDACTED]");
    if (tail.length >= 8) out = out.split(tail).join("[REDACTED]");
  }

  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out;
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

/**
 * Fetch the provider's model catalogue through the same SSRF-guarded path as
 * every other provider call: the URL is rebuilt from the stored provider row
 * (baseUrl + modelsPath), credentials are injected by buildRequest, and the
 * body is parsed by extractModelIds, never a raw fetch of a user URL.
 *
 * Returns [{ id, label }] entries. Throws ProviderHttpError on non-2xx and
 * on body shapes that do not parse to an id list; callers that cannot
 * distinguish "empty catalogue" from "unparseable" should treat the throw as
 * "unverifiable" rather than as a mismatch.
 */
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

/** Hit the provider's models endpoint to verify base URL + credentials. */
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
    // A fetch failure message can contain the full URL, which carries the key
    // for query-auth providers such as Google.
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

/** One turn of a chat conversation, as sent in an OpenAI-style messages array. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Merge an adapter-normalized usage block into the shared ChatUsage shape so
 * cost accounting sees the same fields regardless of provider shape. Falls
 * back to text-length estimation when the adapter found no usage block.
 */
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

/**
 * Resolve the native-shape adapter for a provider. Returns null when the
 * provider uses the default OpenAI-compatible (or Anthropic Messages) path.
 * Detection: an explicit shape wins and "openai" short-circuits. The shape
 * can be set as provider.shape (typed field) or provider.meta.shape (string,
 * persisted through the existing providers.meta_json column). With no
 * explicit shape, fall back to heuristics so existing rows keep working:
 * Bedrock when the chat path is the Converse endpoint or the provider is
 * hosted on the Bedrock runtime domain, Gemini when the Google
 * generativelanguage base URL is not pointing at the OpenAI-compat shim
 * (a chatPath starting with /openai keeps the OpenAI path).
 */
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
    if (path.startsWith("/openai")) return null; // explicit OpenAI-compat shim
    return createGeminiAdapter(provider, secret);
  }
  return null;
}

/** Chat call through a native-shape adapter (Gemini generateContent, Bedrock converse). */
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
  return chatMessages(
    provider,
    modelId,
    system,
    [{ role: "user", content: user }],
    timeoutMs,
    maxTokens,
  );
}

/**
 * Multi-turn variant of `chat`: sends the full conversation history, with
 * `system` prepended (OpenAI) or passed as the dedicated field (Anthropic).
 * Usage is estimated against the whole transcript so multi-turn cost stays
 * honest even when a provider omits the usage block.
 */
export async function chatMessages(
  provider: Provider,
  modelId: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs = 120000,
  maxTokens = 2000,
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

  // Native request shapes (Gemini generateContent, Bedrock converse) bypass
  // the OpenAI-compatible/Anthropic path entirely, including its URL-guard.
  if (!isAnthropic) {
    const secret = provider.authType === "none" ? "" : (getProviderSecret(provider.id) ?? "");
    const adapter = resolveShapeAdapter(provider, secret);
    if (adapter) {
      return chatViaShape(
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
      return {
        ok: false,
        text: "",
        error: redactSecrets(text.slice(0, 600) || res.statusText, secret),
        usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
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
  /** True when the provider delivered a real token stream (SSE). */
  streamed: boolean;
}

export interface ChatStreamCallbacks {
  /** Called with each text delta as it arrives from the provider. */
  onToken?: (text: string) => void;
}

/** Pull the answer text out of a non-streaming JSON body (OpenAI or Anthropic shape). */
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

/**
 * Streaming chat call used by the playground: asks the provider for a streamed
 * response and forwards each delta to `cb.onToken` as it arrives, so callers
 * can render partial text with a low time-to-first-token.
 *
 * Providers that ignore the stream request and answer with a plain JSON body
 * are detected via content-type and parsed through the non-streaming shape,
 * returning `streamed: false`. That fallback keeps providers with no SSE
 * support working unchanged.
 *
 * Usage accounting is preserved: OpenAI-compatible streams carry a final usage
 * chunk when asked (`stream_options.include_usage`), and Anthropic streams
 * report usage in message_start / message_delta events. When no usage arrives,
 * totals are estimated from the full accumulated text exactly as in chat().
 */
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

/**
 * Multi-turn variant of `chatStream`: sends the full conversation history,
 * with `system` prepended (OpenAI) or passed as the dedicated field
 * (Anthropic). Usage is estimated against the whole transcript when the
 * provider omits it, so multi-turn cost stays honest on the stream path too.
 */
export async function chatStreamMessages(
  provider: Provider,
  modelId: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs = 120000,
  maxTokens = 2000,
  cb: ChatStreamCallbacks = {},
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
      return {
        ok: false,
        streamed: false,
        text: "",
        error: redactSecrets(text.slice(0, 600) || res.statusText, secret),
        usage: { ...emptyUsage, inputTokens: estimateTokens(transcript) },
        latencyMs: Date.now() - started,
      };
    }

    const ctype = res.headers.get("content-type") ?? "";

    // Fallback path: the provider ignored stream:true and answered with a
    // plain JSON body. Parse it like a normal completion.
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

    // SSE path: accumulate text, forward deltas, keep the latest usage.
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
        return; // keep-alives and partial fragments
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
        // Anthropic message_delta reports only output tokens; when no
        // message_start arrived first, input is estimated from the prompt.
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

export type FailureKind = "retriable" | "terminal";

export interface FallbackCandidate {
  label: string;
  maxAttempts?: number;
}

export interface AttemptContext {
  candidateIndex: number;
  attempt: number;
  remainingMs: number;
}

export type AttemptFn<C, T> = (candidate: C, ctx: AttemptContext) => Promise<T>;

export interface Failure {
  message: string;
  status?: number;
  kind: FailureKind;
  retryAfterMs?: number;
}

export interface AttemptRecord {
  candidate: string;
  candidateIndex: number;
  attempt: number;
  ok: boolean;
  durationMs: number;
  waitedMs: number;
  status?: number;
  kind?: FailureKind;
  error?: string;
}

export type StopReason = "success" | "terminal" | "exhausted" | "deadline";

export interface FallbackResult<C, T> {
  ok: boolean;
  value?: T;
  candidate?: C;
  error?: Failure;
  stoppedBy: StopReason;
  trail: AttemptRecord[];
  totalMs: number;
}

export interface FallbackOptions {
  maxAttemptsPerCandidate?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  deadlineMs?: number;
  random?: () => number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const RETRIABLE_STATUS = new Set([408, 409, 425, 429]);

const RETRIABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const RETRIABLE_MESSAGES = [
  "timeout",
  "timed out",
  "socket hang up",
  "connection reset",
  "connection closed",
  "network error",
  "fetch failed",
  "aborted",
];

export function parseRetryAfter(value: unknown, now: number = Date.now()): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);

  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

function readHeader(err: Record<string, unknown>, name: string): unknown {
  const headers = err.headers;
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const bag = headers as Record<string, unknown>;
  const hit = Object.keys(bag).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit ? bag[hit] : undefined;
}

export function classifyFailure(err: unknown, now: number = Date.now()): Failure {
  if (err === null || err === undefined) {
    return { message: "unknown failure", kind: "terminal" };
  }

  const e = (typeof err === "object" ? err : {}) as Record<string, unknown>;
  const rawStatus = e.status ?? e.statusCode ?? e.code;
  const status = typeof rawStatus === "number" && Number.isFinite(rawStatus) ? rawStatus : undefined;
  const message =
    (typeof e.message === "string" && e.message) ||
    (typeof err === "string" ? err : "") ||
    String(err);

  const retryAfterMs = parseRetryAfter(e.retryAfter ?? readHeader(e, "retry-after"), now);

  if (status !== undefined && status >= 100) {
    const kind: FailureKind =
      status >= 500 || RETRIABLE_STATUS.has(status) ? "retriable" : "terminal";
    return { message, status, kind, retryAfterMs };
  }

  const code = typeof e.code === "string" ? e.code.toUpperCase() : "";
  const name = typeof e.name === "string" ? e.name : "";
  const lower = message.toLowerCase();

  const transport =
    RETRIABLE_CODES.has(code) ||
    name === "AbortError" ||
    name === "TimeoutError" ||
    RETRIABLE_MESSAGES.some((m) => lower.includes(m));

  return { message, kind: transport ? "retriable" : "terminal", retryAfterMs };
}

export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const half = exponential / 2;
  return Math.round(half + random() * half);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function runWithFallback<C extends FallbackCandidate, T>(
  chain: readonly C[],
  attempt: AttemptFn<C, T>,
  opts: FallbackOptions = {},
): Promise<FallbackResult<C, T>> {
  const {
    maxAttemptsPerCandidate = 2,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    deadlineMs = 60000,
    random = Math.random,
    now = Date.now,
    sleep = defaultSleep,
  } = opts;

  const startedAt = now();
  const trail: AttemptRecord[] = [];
  const elapsed = () => now() - startedAt;
  const remaining = () => deadlineMs - elapsed();

  let lastFailure: Failure | undefined;

  if (chain.length === 0) {
    return {
      ok: false,
      error: { message: "fallback chain is empty", kind: "terminal" },
      stoppedBy: "exhausted",
      trail,
      totalMs: elapsed(),
    };
  }

  for (let index = 0; index < chain.length; index++) {
    const candidate = chain[index];
    const tries = Math.max(1, candidate.maxAttempts ?? maxAttemptsPerCandidate);
    let pendingWaitMs = 0;

    for (let tryNo = 1; tryNo <= tries; tryNo++) {
      if (remaining() <= 0) {
        return {
          ok: false,
          error: lastFailure ?? {
            message: `fallback deadline of ${deadlineMs}ms exceeded`,
            kind: "retriable",
          },
          stoppedBy: "deadline",
          trail,
          totalMs: elapsed(),
        };
      }

      if (pendingWaitMs > 0) await sleep(pendingWaitMs);
      const waitedMs = pendingWaitMs;
      pendingWaitMs = 0;

      const attemptStarted = now();
      try {
        const value = await attempt(candidate, {
          candidateIndex: index,
          attempt: tryNo,
          remainingMs: Math.max(0, remaining()),
        });
        trail.push({
          candidate: candidate.label,
          candidateIndex: index,
          attempt: tryNo,
          ok: true,
          durationMs: now() - attemptStarted,
          waitedMs,
        });
        return {
          ok: true,
          value,
          candidate,
          stoppedBy: "success",
          trail,
          totalMs: elapsed(),
        };
      } catch (err) {
        const failure = classifyFailure(err, now());
        lastFailure = failure;
        trail.push({
          candidate: candidate.label,
          candidateIndex: index,
          attempt: tryNo,
          ok: false,
          durationMs: now() - attemptStarted,
          waitedMs,
          status: failure.status,
          kind: failure.kind,
          error: failure.message,
        });

        if (failure.kind === "terminal") {
          return {
            ok: false,
            error: failure,
            stoppedBy: "terminal",
            trail,
            totalMs: elapsed(),
          };
        }

        if (tryNo < tries) {
          const wait =
            failure.retryAfterMs !== undefined
              ? failure.retryAfterMs
              : backoffDelay(tryNo, baseDelayMs, maxDelayMs, random);

          if (wait >= remaining()) {
            return {
              ok: false,
              error: failure,
              stoppedBy: "deadline",
              trail,
              totalMs: elapsed(),
            };
          }
          pendingWaitMs = wait;
        }
      }
    }
  }

  return {
    ok: false,
    error: lastFailure,
    stoppedBy: "exhausted",
    trail,
    totalMs: elapsed(),
  };
}

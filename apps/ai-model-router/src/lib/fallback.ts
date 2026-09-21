/**
 * Model fallback chain.
 *
 * A single upstream failure should not fail the whole request: providers
 * rate-limit and go down routinely, so one attempt against one model is not
 * enough. This module walks an ordered chain of candidates and returns the
 * first success, together with a trail of everything that was tried.
 *
 * The important rule is that not every failure deserves a fallback. A bad API
 * key or a malformed request body fails identically on every candidate, so
 * advancing the chain after one only burns latency and quota before returning
 * the same error. Those stop the chain immediately.
 */

export type FailureKind = "retriable" | "terminal";

/** Anything the chain can be built from; `label` is what shows in the trail. */
export interface FallbackCandidate {
  /** Stable, human-readable id so a cost or a failure is attributable. */
  label: string;
  /** Per-candidate override of the retry budget. */
  maxAttempts?: number;
}

export interface AttemptContext {
  /** Position in the chain, 0-based. */
  candidateIndex: number;
  /** Try number against THIS candidate, 1-based. */
  attempt: number;
  /** Milliseconds left before the overall deadline; useful as a call timeout. */
  remainingMs: number;
}

/** The injected upstream call. Resolves on success, throws on failure. */
export type AttemptFn<C, T> = (candidate: C, ctx: AttemptContext) => Promise<T>;

export interface Failure {
  message: string;
  status?: number;
  kind: FailureKind;
  /** Milliseconds the upstream asked us to wait, from Retry-After. */
  retryAfterMs?: number;
}

export interface AttemptRecord {
  candidate: string;
  candidateIndex: number;
  /** Try number against this candidate, 1-based. */
  attempt: number;
  ok: boolean;
  /** Wall time spent inside the attempt itself, backoff excluded. */
  durationMs: number;
  /** Backoff actually slept BEFORE this attempt, so the cost of waiting is visible. */
  waitedMs: number;
  status?: number;
  kind?: FailureKind;
  error?: string;
}

export type StopReason = "success" | "terminal" | "exhausted" | "deadline";

export interface FallbackResult<C, T> {
  ok: boolean;
  /** Present only when `ok`. */
  value?: T;
  /** The candidate that succeeded, when `ok`. */
  candidate?: C;
  /** The LAST failure seen, which is what the caller should surface. */
  error?: Failure;
  stoppedBy: StopReason;
  trail: AttemptRecord[];
  totalMs: number;
}

export interface FallbackOptions {
  /** Tries per candidate before moving on. Default 2. */
  maxAttemptsPerCandidate?: number;
  /** First backoff step. Default 500ms. */
  baseDelayMs?: number;
  /** Ceiling for a single computed backoff. Default 8000ms. */
  maxDelayMs?: number;
  /** Hard cap on total elapsed time so a long chain cannot hang a request. Default 60000ms. */
  deadlineMs?: number;
  /** Injected jitter source; tests pass a fixed value for determinism. */
  random?: () => number;
  /** Injected clock, for tests. */
  now?: () => number;
  /** Injected sleep, for tests. */
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

/**
 * Parse a Retry-After value into milliseconds. The header is either a count of
 * seconds or an HTTP date, and both are common in the wild.
 */
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
  // A date already in the past means "retry now", not "retry in the past".
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

/**
 * Decide whether a failure is worth another model.
 *
 * Unknown shapes are treated as terminal on purpose: an unrecognised error is
 * more often a bug in our own request than a transient upstream blip, and
 * retrying a bug across five models just multiplies the damage.
 */
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
    // 5xx and the explicit "come back later" family are transient by
    // definition. Every other 4xx is a statement about the request itself.
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

/**
 * Exponential backoff with equal jitter.
 *
 * Jitter is not cosmetic. When a provider rate-limits, it rate-limits every
 * client at once, so a pure exponential schedule makes all of them wake up on
 * the same millisecond and hit the recovering endpoint together. That
 * synchronised thundering herd re-triggers the limit and turns a short
 * throttle into a long outage. Spreading each client randomly across the
 * window smooths the load back in.
 *
 * Equal jitter (half fixed, half random) is used rather than full jitter so a
 * retry still respects a meaningful minimum wait instead of occasionally
 * firing again immediately.
 */
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

/**
 * Walk `chain` in order until one candidate succeeds.
 *
 * `attempt` is injected rather than imported so the chain logic is testable
 * without a network, and so the same policy can wrap a chat call, an embedding
 * call or anything else.
 */
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
          // A bad key or a malformed body fails the same way everywhere, so
          // the rest of the chain would only repeat this error more slowly.
          return {
            ok: false,
            error: failure,
            stoppedBy: "terminal",
            trail,
            totalMs: elapsed(),
          };
        }

        if (tryNo < tries) {
          // Retry-After is the provider telling us exactly when it will serve
          // us again; guessing shorter just earns another 429.
          const wait =
            failure.retryAfterMs !== undefined
              ? failure.retryAfterMs
              : backoffDelay(tryNo, baseDelayMs, maxDelayMs, random);

          // Never sleep past the deadline: waiting for a retry we could not
          // run anyway is pure added latency on an already-failing request.
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

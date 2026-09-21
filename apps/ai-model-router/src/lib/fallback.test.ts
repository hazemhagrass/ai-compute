import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  backoffDelay,
  classifyFailure,
  parseRetryAfter,
  runWithFallback,
  type AttemptContext,
  type FallbackCandidate,
} from "./fallback";

interface Candidate extends FallbackCandidate {
  label: string;
  maxAttempts?: number;
}

const chainOf = (...labels: string[]): Candidate[] => labels.map((label) => ({ label }));

/** An upstream error shaped the way a provider client would throw it. */
function httpError(status: number, message = `HTTP ${status}`, headers?: Record<string, string>) {
  return Object.assign(new Error(message), { status, headers });
}

/** Run a chain to completion while fake time is driven forward for the backoffs. */
async function runAndFlush<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
  return promise;
}

/** Jitter fixed at the midpoint so every backoff in a test is exact. */
const fixedRandom = () => 0.5;

describe("classifyFailure", () => {
  it("treats 429 as retriable so the chain can move on", () => {
    expect(classifyFailure(httpError(429)).kind).toBe("retriable");
  });

  it("treats every 5xx as retriable", () => {
    for (const status of [500, 502, 503, 504, 529]) {
      expect(classifyFailure(httpError(status)).kind).toBe("retriable");
    }
  });

  it("treats auth and malformed-request failures as terminal", () => {
    // These fail identically on every candidate, so a fallback is pure waste.
    for (const status of [400, 401, 403, 404, 422]) {
      expect(classifyFailure(httpError(status)).kind).toBe("terminal");
    }
  });

  it("treats connection resets and timeouts as retriable", () => {
    expect(classifyFailure(Object.assign(new Error("read"), { code: "ECONNRESET" })).kind).toBe(
      "retriable",
    );
    expect(classifyFailure(Object.assign(new Error("x"), { code: "ETIMEDOUT" })).kind).toBe(
      "retriable",
    );
    expect(classifyFailure(Object.assign(new Error("slow"), { name: "AbortError" })).kind).toBe(
      "retriable",
    );
    expect(classifyFailure(new Error("socket hang up")).kind).toBe("retriable");
    expect(classifyFailure(new Error("fetch failed")).kind).toBe("retriable");
  });

  it("treats an unrecognised error as terminal rather than retrying a bug everywhere", () => {
    expect(classifyFailure(new TypeError("x.map is not a function")).kind).toBe("terminal");
    expect(classifyFailure(null).kind).toBe("terminal");
  });

  it("carries the status and message through for reporting", () => {
    const f = classifyFailure(httpError(429, "rate limit reached for gpt-5.2"));

    expect(f).toMatchObject({ status: 429, message: "rate limit reached for gpt-5.2" });
  });

  it("reads Retry-After off the error headers", () => {
    const f = classifyFailure(httpError(429, "slow down", { "Retry-After": "3" }));

    expect(f.retryAfterMs).toBe(3000);
  });
});

describe("parseRetryAfter", () => {
  it("reads a seconds count", () => {
    expect(parseRetryAfter("7")).toBe(7000);
    expect(parseRetryAfter(1.5)).toBe(1500);
  });

  it("reads an HTTP date as a delay from now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");

    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:20 GMT", now)).toBe(20000);
  });

  it("clamps a past date to zero instead of going negative", () => {
    const now = Date.parse("2026-01-01T00:01:00Z");

    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:00 GMT", now)).toBe(0);
  });

  it("ignores absent or junk values", () => {
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter("")).toBeUndefined();
  });
});

describe("backoffDelay", () => {
  it("grows exponentially", () => {
    const zero = () => 0;

    expect(backoffDelay(1, 1000, 60000, zero)).toBe(500);
    expect(backoffDelay(2, 1000, 60000, zero)).toBe(1000);
    expect(backoffDelay(3, 1000, 60000, zero)).toBe(2000);
  });

  it("spreads clients across the window instead of synchronising them", () => {
    // Same attempt number, different random draws, different wake-up times:
    // this is what stops a thundering herd on a recovering provider.
    expect(backoffDelay(2, 1000, 60000, () => 0)).toBe(1000);
    expect(backoffDelay(2, 1000, 60000, () => 1)).toBe(2000);
  });

  it("caps a single delay at maxDelayMs", () => {
    expect(backoffDelay(20, 1000, 8000, () => 1)).toBe(8000);
  });
});

describe("runWithFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the first candidate and never touches the rest when it works", async () => {
    const attempt = vi.fn(async () => "answer");

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2", "claude-4.7", "llama-4"), attempt, {
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.value).toBe("answer");
    expect(res.candidate?.label).toBe("gpt-5.2");
    expect(res.stoppedBy).toBe("success");
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(res.trail).toHaveLength(1);
    expect(res.trail[0]).toMatchObject({ candidate: "gpt-5.2", ok: true, attempt: 1 });
  });

  it("falls back to the second model when the first is rate-limited", async () => {
    const attempt = vi.fn(async (c: Candidate) => {
      if (c.label === "gpt-5.2") throw httpError(429, "rate limit");
      return "from backup";
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2", "claude-4.7"), attempt, {
        maxAttemptsPerCandidate: 1,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(true);
    expect(res.value).toBe("from backup");
    expect(res.candidate?.label).toBe("claude-4.7");
    expect(res.trail).toHaveLength(2);
    expect(res.trail[0]).toMatchObject({
      candidate: "gpt-5.2",
      ok: false,
      status: 429,
      kind: "retriable",
    });
    expect(res.trail[1]).toMatchObject({ candidate: "claude-4.7", ok: true });
  });

  it("retries the same candidate with exponential backoff before moving on", async () => {
    const attempt = vi.fn(async (c: Candidate) => {
      if (c.label === "gpt-5.2") throw httpError(503, "upstream down");
      return "ok";
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2", "claude-4.7"), attempt, {
        maxAttemptsPerCandidate: 3,
        baseDelayMs: 1000,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(true);
    // Three tries against the first model, then the second succeeds.
    expect(res.trail.map((t) => `${t.candidate}#${t.attempt}`)).toEqual([
      "gpt-5.2#1",
      "gpt-5.2#2",
      "gpt-5.2#3",
      "claude-4.7#1",
    ]);
    // 750 = half of 1000 plus 0.5 jitter; 1500 = half of 2000 plus 0.5 jitter.
    expect(res.trail.map((t) => t.waitedMs)).toEqual([0, 750, 1500, 0]);
  });

  it("stops the chain immediately on a terminal 401", async () => {
    // A bad key fails the same way on every candidate, so trying the rest
    // would burn the whole chain to return this exact error.
    const attempt = vi.fn(async () => {
      throw httpError(401, "invalid api key");
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2", "claude-4.7", "llama-4"), attempt, {
        maxAttemptsPerCandidate: 3,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.stoppedBy).toBe("terminal");
    expect(res.error).toMatchObject({ status: 401, kind: "terminal" });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(res.trail).toHaveLength(1);
    expect(res.trail[0].candidateIndex).toBe(0);
  });

  it("does not retry the same candidate after a terminal failure either", async () => {
    const attempt = vi.fn(async () => {
      throw httpError(400, "malformed request");
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2"), attempt, {
        maxAttemptsPerCandidate: 5,
        random: fixedRandom,
      }),
    );

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(res.stoppedBy).toBe("terminal");
  });

  it("surfaces the last error plus the full trail when every candidate fails", async () => {
    const attempt = vi.fn(async (c: Candidate) => {
      if (c.label === "a") throw httpError(429, "a rate limited");
      if (c.label === "b") throw httpError(500, "b exploded");
      throw httpError(503, "c unavailable");
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("a", "b", "c"), attempt, {
        maxAttemptsPerCandidate: 1,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.stoppedBy).toBe("exhausted");
    expect(res.value).toBeUndefined();
    expect(res.error).toMatchObject({ status: 503, message: "c unavailable" });
    expect(res.trail).toHaveLength(3);
    expect(res.trail.map((t) => t.candidate)).toEqual(["a", "b", "c"]);
    expect(res.trail.map((t) => t.error)).toEqual([
      "a rate limited",
      "b exploded",
      "c unavailable",
    ]);
    expect(res.trail.every((t) => t.ok === false)).toBe(true);
  });

  it("honours Retry-After instead of its own backoff", async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls++;
      if (calls === 1) throw httpError(429, "slow down", { "retry-after": "2" });
      return "ok";
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2"), attempt, {
        maxAttemptsPerCandidate: 2,
        baseDelayMs: 100,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(true);
    // 2000 from the header, not the 50ms the local schedule would have picked.
    expect(res.trail[1].waitedMs).toBe(2000);
    expect(res.trail[0].kind).toBe("retriable");
  });

  it("gives up rather than sleeping past the overall deadline", async () => {
    const attempt = vi.fn(async () => {
      throw httpError(429, "come back much later", { "retry-after": "300" });
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("gpt-5.2"), attempt, {
        maxAttemptsPerCandidate: 2,
        deadlineMs: 5000,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.stoppedBy).toBe("deadline");
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(res.error).toMatchObject({ status: 429 });
  });

  it("stops walking the chain once the deadline has elapsed", async () => {
    // Each attempt burns 600ms, so a 1000ms budget cannot reach candidate 3.
    const attempt = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw httpError(503, "slow failure");
    });

    const res = await runAndFlush(
      runWithFallback(chainOf("a", "b", "c"), attempt, {
        maxAttemptsPerCandidate: 1,
        deadlineMs: 1000,
        random: fixedRandom,
      }),
    );

    expect(res.ok).toBe(false);
    expect(res.stoppedBy).toBe("deadline");
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(res.trail).toHaveLength(2);
    expect(res.trail.every((t) => t.durationMs === 600)).toBe(true);
    expect(res.totalMs).toBeGreaterThanOrEqual(1000);
  });

  it("passes the candidate, attempt number and remaining budget to the attempt fn", async () => {
    const seen: AttemptContext[] = [];
    const attempt = vi.fn(async (_c: Candidate, ctx: AttemptContext) => {
      seen.push(ctx);
      if (seen.length < 2) throw httpError(500, "retry me");
      return "ok";
    });

    await runAndFlush(
      runWithFallback(chainOf("a"), attempt, {
        maxAttemptsPerCandidate: 2,
        baseDelayMs: 1000,
        deadlineMs: 30000,
        random: fixedRandom,
      }),
    );

    expect(seen[0]).toMatchObject({ candidateIndex: 0, attempt: 1, remainingMs: 30000 });
    expect(seen[1]).toMatchObject({ candidateIndex: 0, attempt: 2 });
    // The second call sees the backoff already deducted from the budget.
    expect(seen[1].remainingMs).toBe(30000 - 750);
  });

  it("respects a per-candidate attempt override", async () => {
    const attempt = vi.fn(async () => {
      throw httpError(500, "down");
    });
    const chain: Candidate[] = [
      { label: "a", maxAttempts: 3 },
      { label: "b", maxAttempts: 1 },
    ];

    const res = await runAndFlush(
      runWithFallback(chain, attempt, { maxAttemptsPerCandidate: 2, random: fixedRandom }),
    );

    expect(res.trail.map((t) => t.candidate)).toEqual(["a", "a", "a", "b"]);
  });

  it("fails cleanly on an empty chain", async () => {
    const res = await runAndFlush(runWithFallback([], vi.fn(), {}));

    expect(res.ok).toBe(false);
    expect(res.trail).toEqual([]);
    expect(res.error?.kind).toBe("terminal");
  });
});

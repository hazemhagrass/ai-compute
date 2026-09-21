import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectionResult } from "./client";
import type { Provider } from "./types";

vi.mock("./client", () => ({
  redactSecrets: (text: string) => text,
  testConnection: vi.fn(),
}));
vi.mock("./repo", () => ({
  listProviders: vi.fn(),
}));

import { testConnection } from "./client";
import { listProviders } from "./repo";
import { checkAllProviders, HEALTH_PROBE_TIMEOUT_MS, runHealthChecks } from "./health";

const mockTest = vi.mocked(testConnection);
const mockList = vi.mocked(listProviders);

function provider(id: number, over: Partial<Provider> = {}): Provider {
  return {
    id,
    slug: `p${id}`,
    name: `Provider ${id}`,
    kind: "cloud",
    baseUrl: "https://api.example.com",
    chatPath: "/chat",
    modelsPath: "/models",
    authType: "bearer",
    authHeaderName: "Authorization",
    authQueryName: "",
    headers: {},
    meta: {},
    enabled: true,
    hasKey: true,
    keyPreview: "sk-…xxxx",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAllProviders", () => {
  it("aggregates a healthy provider", async () => {
    mockList.mockReturnValue([provider(1)]);
    mockTest.mockResolvedValue({
      ok: true,
      status: 200,
      latencyMs: 123,
      modelCount: 7,
    } satisfies ConnectionResult);

    const report = await checkAllProviders();

    expect(report.total).toBe(1);
    expect(report.okCount).toBe(1);
    expect(report.results[0]).toMatchObject({
      id: 1,
      name: "Provider 1",
      ok: true,
      latencyMs: 123,
      modelCount: 7,
      status: 200,
      error: null,
    });
    // The per-probe timeout must be passed down so a hung endpoint cannot
    // stall the dashboard.
    expect(mockTest).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), HEALTH_PROBE_TIMEOUT_MS);
  });

  it("reports a failed probe without leaking an oversized error body", async () => {
    mockList.mockReturnValue([provider(1)]);
    mockTest.mockResolvedValue({
      ok: false,
      status: 401,
      latencyMs: 40,
      error: "unauthorized: ".padEnd(600, "x"),
    });

    const report = await checkAllProviders();

    const row = report.results[0];
    expect(row.ok).toBe(false);
    expect(row.error).not.toBeNull();
    expect(row.error!.length).toBeLessThanOrEqual(203);
  });

  it("skips probing a provider with no key and marks it down", async () => {
    mockList.mockReturnValue([provider(1, { hasKey: false })]);

    const report = await checkAllProviders();

    expect(mockTest).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({ ok: false, error: "no API key configured" });
    expect(report.okCount).toBe(0);
  });

  it("ignores disabled providers", async () => {
    mockList.mockReturnValue([provider(1, { enabled: false }), provider(2)]);
    mockTest.mockResolvedValue({ ok: true, status: 200, latencyMs: 5, modelCount: 0 });

    const report = await checkAllProviders();

    expect(report.total).toBe(1);
    expect(report.results[0].id).toBe(2);
  });

  it("keeps the timeout deadline so one hung provider still yields a row", async () => {
    vi.useFakeTimers();
    try {
      mockList.mockReturnValue([provider(1, { name: "Hung" }), provider(2, { name: "Fast" })]);
      mockTest.mockImplementation((p, timeoutMs) => {
        const deadline = timeoutMs ?? HEALTH_PROBE_TIMEOUT_MS;
        if (p.id === 1) {
          // Simulates what the real testConnection does when its AbortController
          // fires: the fetch rejects and it returns an error result.
          return new Promise((resolve) =>
            setTimeout(
              () => resolve({ ok: false, status: 0, latencyMs: deadline, error: "aborted" }),
              deadline,
            ),
          );
        }
        return Promise.resolve({ ok: true, status: 200, latencyMs: 10, modelCount: 3 });
      });

      const promise = checkAllProviders();
      await vi.advanceTimersByTimeAsync(HEALTH_PROBE_TIMEOUT_MS + 100);
      const report = await promise;

      expect(report.total).toBe(2);
      const hung = report.results.find((r) => r.name === "Hung")!;
      const fast = report.results.find((r) => r.name === "Fast")!;
      expect(hung.ok).toBe(false);
      expect(hung.error).toContain("aborted");
      expect(fast.ok).toBe(true);
      expect(fast.modelCount).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("degrades a thrown probe error into a failed row", async () => {
    mockList.mockReturnValue([provider(1)]);
    mockTest.mockRejectedValue(new Error("unexpected boom"));

    const report = await checkAllProviders();

    expect(report.results[0]).toMatchObject({ ok: false, error: "unexpected boom" });
  });
});

describe("runHealthChecks", () => {
  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const providers = Array.from({ length: 12 }, (_, i) => provider(i + 1));

    await runHealthChecks(
      providers,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await sleep(5);
        active -= 1;
        return true;
      },
      5,
    );

    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("preserves provider order in the results", async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const providers = Array.from({ length: 8 }, (_, i) => provider(i + 1));

    const out = await runHealthChecks(providers, async (p) => {
      // Later providers resolve first, so order must come from the array.
      await sleep((8 - p.id) * 2);
      return p.id;
    });

    expect(out).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

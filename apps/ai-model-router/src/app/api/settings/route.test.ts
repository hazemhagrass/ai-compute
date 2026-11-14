import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth } from "@/lib/auth";

const store = new Map<string, string>();

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

const route = await import("./route");

const requireAuthMock = vi.mocked(requireAuth);
const PRICING_STALE_DAYS_KEY = "pricing_stale_days";

beforeEach(() => {
  store.clear();
  requireAuthMock.mockReset();
  requireAuthMock.mockResolvedValue(null);
});

type Res = { status: number; json(): Promise<unknown> };

async function getJson(res: Res): Promise<{
  settings?: { pricingStaleDays: number };
  error?: string;
}> {
  return (await res.json()) as {
    settings?: { pricingStaleDays: number };
    error?: string;
  };
}

describe("GET /api/settings", () => {
  it("returns the default 14 when nothing is stored", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect((await getJson(res)).settings).toEqual({ pricingStaleDays: 14 });
    expect(store.has(PRICING_STALE_DAYS_KEY)).toBe(false);
  });

  it("returns the stored value", async () => {
    store.set(PRICING_STALE_DAYS_KEY, "30");
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect((await getJson(res)).settings).toEqual({ pricingStaleDays: 30 });
  });

  it("clamps a corrupted stored value to a usable threshold on read", async () => {
    for (const [stored, expected] of [
      ["0", 1],
      ["-5", 1],
      ["366", 365],
      ["1000", 365],
      ["abc", 14],
      ["null", 14],
    ] as const) {
      store.clear();
      store.set(PRICING_STALE_DAYS_KEY, stored);
      const res = await route.GET();
      expect(res.status).toBe(200);
      expect((await getJson(res)).settings).toEqual({
        pricingStaleDays: expected,
      });
    }
  });

  it("returns 401 when auth is denied", async () => {
    requireAuthMock.mockResolvedValueOnce(
      new Response(null, { status: 401 }) as never,
    );
    const res = await route.GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/settings", () => {
  function patch(body: unknown): Promise<Res> {
    return route.PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("rejects out-of-range and non-integer thresholds with 422", async () => {
    for (const bad of [0, 366, 2.5, -1, 1000.5]) {
      const res = await patch({ pricingStaleDays: bad });
      expect(res.status).toBe(422);
    }
  });

  it("rejects a string threshold with 422 (coercion is not offered)", async () => {
    const res = await patch({ pricingStaleDays: "7" });
    expect(res.status).toBe(422);
  });

  it("round-trips: PATCH 30 stores the value and GET reads it back", async () => {
    const res = await patch({ pricingStaleDays: 30 });
    expect(res.status).toBe(200);
    expect((await getJson(res)).settings).toEqual({ pricingStaleDays: 30 });
    expect(store.get(PRICING_STALE_DAYS_KEY)).toBe("30");

    const got = await route.GET();
    expect(got.status).toBe(200);
    expect((await getJson(got)).settings).toEqual({ pricingStaleDays: 30 });
  });

  it("returns 401 when auth is denied", async () => {
    requireAuthMock.mockResolvedValueOnce(
      new Response(null, { status: 401 }) as never,
    );
    const res = await patch({ pricingStaleDays: 30 });
    expect(res.status).toBe(401);
    expect(store.has(PRICING_STALE_DAYS_KEY)).toBe(false);
  });
});

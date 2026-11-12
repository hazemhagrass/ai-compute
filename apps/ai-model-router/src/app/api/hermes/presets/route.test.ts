import { describe, expect, it, vi } from "vitest";

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

import { GET } from "./route";

describe("GET /api/hermes/presets", () => {
  it("lists the in-repo router presets with labels and tier counts", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.presets.map((p: { name: string }) => p.name).sort()).toEqual([
      "cloud-balanced",
      "local-first",
    ]);
    for (const preset of body.presets) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.tierCount).toBeGreaterThan(0);
    }
  });
});

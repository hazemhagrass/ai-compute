import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "amr-router-live-route-"));
process.env.HERMES_HOME = DIR;

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn<() => Promise<Response | null>>(async () => null),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

const route = await import("./route");

function get(id = "default") {
  return route.GET(new Request(`http://localhost/api/hermes/profiles/${id}/router-live`), {
    params: Promise.resolve({ id }),
  });
}

beforeAll(async () => {
  // Enable the router for the default profile with one classifier entry.
  const logsDir = join(DIR, "logs");
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(
    join(DIR, "config.yaml"),
    [
      "tier_router:",
      "  enabled: true",
      "  default_tier: normal",
      "  cooldown_s: 120",
      "  restore_primary: true",
      "  classifier:",
      "    pool:",
      "      - provider: opencode-go",
      "        model: glm-5.3-flash",
    ].join("\n"),
    "utf8",
  );
  const now = Date.now() - 30_000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const d = new Date(now);
  writeFileSync(
    join(logsDir, "agent.log"),
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMilliseconds(), 3)} INFO [session-a] agent.tier_router: tier_router: normal→normal (classifier:coding/medium) -> claude-sonnet-5 via anthropic\n`,
    "utf8",
  );
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

beforeEach(() => {
  mocks.requireAuth.mockReset();
  mocks.requireAuth.mockImplementation(async () => null);
});

describe("GET /api/hermes/profiles/[id]/router-live", () => {
  it("requires authentication", async () => {
    mocks.requireAuth.mockImplementationOnce(
      async () => new Response(JSON.stringify({ error: "authentication required" }), { status: 401 }),
    );
    const res = await get();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("authentication required");
  });

  it("returns a validated routerLive payload sourced from logs", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      routerLive: {
        profile: string;
        source: string;
        generated_at: string;
        cooldowns: { approx: boolean; model: string; scope: string }[];
        decisions: { tier_requested: string; source: string; model: string; provider: string }[];
        restore: { enabled: boolean };
        warnings: string[];
      };
    };

    expect(body.routerLive.profile).toBe("default");
    expect(body.routerLive.source).toBe("logs");
    expect(body.routerLive.generated_at).toBeTruthy();
    expect(body.routerLive.decisions).toHaveLength(1);
    expect(body.routerLive.decisions[0]).toMatchObject({
      tier_requested: "normal",
      source: "classifier:coding/medium",
      model: "claude-sonnet-5",
      provider: "anthropic",
    });
    expect(body.routerLive.restore.enabled).toBe(true);
    expect(body.routerLive.warnings.length).toBeGreaterThan(0);
  });

  it("returns source none and a warning for a disabled router", async () => {
    // Own profile dir so the shared default fixture stays enabled for the other tests.
    const offRoot = join(DIR, "profiles", "qa-off");
    mkdirSync(offRoot, { recursive: true });
    writeFileSync(join(offRoot, "config.yaml"), "tier_router:\n  enabled: false\n", "utf8");
    const res = await get("qa-off");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { routerLive: { source: string; warnings: string[]; decisions: unknown[] } };
    expect(body.routerLive.source).toBe("none");
    expect(body.routerLive.decisions).toEqual([]);
    expect(body.routerLive.warnings.join(" ")).toContain("disabled");
  });

  it("returns 404 for a profile that does not exist", async () => {
    const res = await get("qa-nonexistent-zz");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("does not exist");
    // The misleading "disabled in this profile's config" warning must not appear here.
    expect(body.error).not.toContain("disabled");
  });

  it("returns 400 for an invalid profile id", async () => {
    const res = await get("bad id");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("invalid profile id");
  });

  it("rejects traversal ids instead of escaping PROFILES_DIR", async () => {
    for (const id of ["..", "../etc", "a/../b"]) {
      const res = await get(id);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toContain("invalid profile id");
    }
  });
});

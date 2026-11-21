import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Table-driven contract test: every route under /api/hermes/profiles/[id]/ must answer 400
// for invalid or traversal profile ids (not 500), and must still answer 401 unauthenticated
// before any id handling. The shared profileRouteGuard owns the 400/404 prelude.

const DIR = mkdtempSync(join(tmpdir(), "amr-profile-routes-"));
process.env.HERMES_HOME = DIR;

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn<() => Promise<Response | null>>(async () => null),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

type Handler = (req: Request, ctx: unknown) => Promise<Response>;

type RouteCase = { label: string; handler: Handler; params: Record<string, string> };

const idRoute = await import("./route");
const aliasesRoute = await import("./aliases/route");
const classifierRoute = await import("./classifier/route");
const configRoute = await import("./config/route");
const fallbackRoute = await import("./fallback/route");
const providersRoute = await import("./providers/route");
const providerRoute = await import("./providers/[providerId]/route");
const providerTestRoute = await import("./providers/[providerId]/test/route");
const tiersRoute = await import("./tiers/route");
const tierRoute = await import("./tiers/[tierName]/route");
const usageRoute = await import("./usage/route");
const routerLiveRoute = await import("./router-live/route");

const CASES: RouteCase[] = [
  { label: "profiles/[id] DELETE", handler: idRoute.DELETE as unknown as Handler, params: {} },
  { label: "aliases GET", handler: aliasesRoute.GET as unknown as Handler, params: {} },
  { label: "aliases POST", handler: aliasesRoute.POST as unknown as Handler, params: {} },
  { label: "aliases DELETE", handler: aliasesRoute.DELETE as unknown as Handler, params: {} },
  { label: "classifier PATCH", handler: classifierRoute.PATCH as unknown as Handler, params: {} },
  { label: "classifier POST", handler: classifierRoute.POST as unknown as Handler, params: {} },
  { label: "classifier DELETE", handler: classifierRoute.DELETE as unknown as Handler, params: {} },
  { label: "config GET", handler: configRoute.GET as unknown as Handler, params: {} },
  { label: "config PATCH", handler: configRoute.PATCH as unknown as Handler, params: {} },
  { label: "fallback GET", handler: fallbackRoute.GET as unknown as Handler, params: {} },
  { label: "fallback PUT", handler: fallbackRoute.PUT as unknown as Handler, params: {} },
  { label: "providers GET", handler: providersRoute.GET as unknown as Handler, params: {} },
  { label: "providers POST", handler: providersRoute.POST as unknown as Handler, params: {} },
  {
    label: "providers/[providerId] PATCH",
    handler: providerRoute.PATCH as unknown as Handler,
    params: { providerId: "p" },
  },
  {
    label: "providers/[providerId] DELETE",
    handler: providerRoute.DELETE as unknown as Handler,
    params: { providerId: "p" },
  },
  {
    label: "providers/[providerId]/test POST",
    handler: providerTestRoute.POST as unknown as Handler,
    params: { providerId: "p" },
  },
  { label: "tiers GET", handler: tiersRoute.GET as unknown as Handler, params: {} },
  { label: "tiers PATCH", handler: tiersRoute.PATCH as unknown as Handler, params: {} },
  { label: "tiers POST", handler: tiersRoute.POST as unknown as Handler, params: {} },
  {
    label: "tiers/[tierName] PATCH",
    handler: tierRoute.PATCH as unknown as Handler,
    params: { tierName: "t" },
  },
  {
    label: "tiers/[tierName] DELETE",
    handler: tierRoute.DELETE as unknown as Handler,
    params: { tierName: "t" },
  },
  { label: "usage GET", handler: usageRoute.GET as unknown as Handler, params: {} },
  { label: "router-live GET", handler: routerLiveRoute.GET as unknown as Handler, params: {} },
];

const INVALID_IDS: Array<[string, string]> = [
  ["traversal", ".."],
  ["path segment", "a/b"],
  ["65 chars", "a" + "b".repeat(64)],
];

function call(c: RouteCase, id: string): Promise<Response> {
  return c.handler(new Request("http://localhost/api/hermes/profiles/irrelevant"), {
    params: Promise.resolve({ id, ...c.params }),
  });
}

beforeEach(() => {
  mocks.requireAuth.mockReset();
  mocks.requireAuth.mockImplementation(async () => null);
});

describe("profile id guard across every /api/hermes/profiles/[id] route", () => {
  it.each(CASES.map((c) => [c.label, c] as const))(
    "%s returns 400 for invalid and traversal ids",
    async (_label, c) => {
      for (const [kind, id] of INVALID_IDS) {
        const res = await call(c, id);
        expect(res.status, `${_label} with ${kind} id ${JSON.stringify(id)}`).toBe(400);
        const body = (await res.json()) as { error?: string };
        expect(body.error).toContain("invalid profile id");
      }
    },
  );

  it.each(CASES.map((c) => [c.label, c] as const))(
    "%s still returns 401 when unauthenticated",
    async (_label, c) => {
      mocks.requireAuth.mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: "authentication required" }), { status: 401 }),
      );
      const res = await call(c, "default");
      expect(res.status, `${_label} unauthenticated`).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("authentication required");
    },
  );

  it.each(CASES.map((c) => [c.label, c] as const))(
    "%s returns 404 for a named profile whose directory is absent",
    async (_label, c) => {
      const res = await call(c, "qa-missing-zz");
      expect(res.status, `${_label} missing profile`).toBe(404);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toContain("does not exist");
    },
  );

  it("returns 404 for a symlinked profile directory instead of following it", async () => {
    const outside = join(DIR, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "config.yaml"), "model:\n  default: x\n", "utf8");
    mkdirSync(join(DIR, "profiles"), { recursive: true });
    symlinkSync(outside, join(DIR, "profiles", "qa-link"));

    // listHermesProfiles skips symlinks (readdirSync withFileTypes), so the routes must not
    // follow one out of profiles/ either: lstatSync says "not a directory" -> 404.
    const res = await call(
      CASES.find((c) => c.label === "usage GET") as RouteCase,
      "qa-link",
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("does not exist");
  });
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import type { POST as ImportPost } from "./route";

type ImportCtx = Parameters<typeof ImportPost>[1];

let dir: string;
const origEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-import-route-"));
  for (const key of ["HERMES_HOME", "AMR_DATA_DIR", "AMR_DB_PATH", "AMR_SECRET"]) {
    origEnv[key] = process.env[key];
  }
  process.env.HERMES_HOME = dir;
  process.env.AMR_DATA_DIR = dir;
  process.env.AMR_DB_PATH = path.join(dir, "router.db");
  process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";
});

afterEach(() => {
  for (const [key, value] of Object.entries(origEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

async function fresh() {
  vi.resetModules();
  return {
    importRoute: await import("./route"),
    configIo: await import("@/lib/hermes/config-io"),
    configSchema: await import("@/lib/hermes/config-schema"),
    paths: await import("@/lib/hermes/paths"),
    repo: await import("@/lib/repo"),
  };
}

type Harness = Awaited<ReturnType<typeof fresh>>;

function ctx(id: string): ImportCtx {
  return { params: Promise.resolve({ id }) };
}

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function seedCatalog(h: Harness): Promise<void> {
  const provider = h.repo.createProvider({
    name: "Fixture Catalog Provider",
    baseUrl: "http://localhost:1/v1",
    kind: "local",
    authType: "none",
  });
  h.repo.createModel({ providerId: provider.id, modelId: "fixture-chat-model", label: "Fixture Chat Model" });
  h.repo.createModel({ providerId: provider.id, modelId: "fixture-chat-model-2", label: "Fixture Chat Model 2" });
}

function sourceTierRouter() {
  return {
    enabled: true,
    default_tier: "normal",
    cooldown_s: 300,
    restore_primary: true,
    classifier: { pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }] },
    tiers: {
      normal: {
        mode: "round_robin",
        escalate_to: "complex",
        pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }],
        fallback: [],
      },
      complex: {
        mode: "priority",
        escalate_to: null,
        pool: [{ provider: "fixture-provider", model: "fixture-chat-model-2" }],
        fallback: [],
      },
    },
    routes: { plan: { easy: "complex" } },
  };
}

function targetConfig(h: Harness) {
  return h.configSchema.parseHermesConfig({
    model: { default: "keep-me", provider: "keep-provider" },
    providers: { "keep-provider": { name: "Keep" } },
    tier_router: {
      enabled: false,
      default_tier: "trivial",
      cooldown_s: 120,
      classifier: { pool: [] },
      tiers: { trivial: { mode: "priority", escalate_to: null, pool: [], fallback: [] } },
    },
  });
}

async function seedSourceAndTarget(h: Harness): Promise<void> {
  await seedCatalog(h);
  h.configIo.writeHermesConfig(
    "src",
    h.configSchema.parseHermesConfig({
      model: { default: "m", provider: "fixture-provider" },
      providers: { "fixture-provider": { name: "Fixture", api_key: "sk-secret-provider" } },
      tier_router: sourceTierRouter(),
    }),
  );
  h.configIo.writeHermesConfig("default", targetConfig(h));
}

function snapshot(configPath: string) {
  return { text: fs.readFileSync(configPath, "utf8"), mtimeMs: fs.statSync(configPath).mtimeMs };
}

function expectUnchanged(configPath: string, before: { text: string; mtimeMs: number }): void {
  const after = snapshot(configPath);
  expect(after.text).toBe(before.text);
  expect(after.mtimeMs).toBe(before.mtimeMs);
  expect(fs.existsSync(`${configPath}.bak`)).toBe(false);
}

describe("POST /api/hermes/profiles/[id]/tiers/import input rules", () => {
  it("400 when both from and preset are given, and writes nothing", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "src", preset: "local-first" }),
      ctx("default"),
    );

    expect(res.status).toBe(400);
    expectUnchanged(configPath, before);
  });

  it("400 when neither from nor preset is given", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", {}),
      ctx("default"),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("exactly one");
  });

  it("400 when the source profile equals the target", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "default" }),
      ctx("default"),
    );

    expect(res.status).toBe(400);
    expectUnchanged(configPath, before);
  });

  it("404 when the source profile does not exist", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "ghost" }),
      ctx("default"),
    );

    expect(res.status).toBe(404);
  });

  it("404 when the source profile has no tier_router block", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    h.configIo.writeHermesConfig("bare", h.configSchema.parseHermesConfig({}));

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "bare" }),
      ctx("default"),
    );

    expect(res.status).toBe(404);
  });

  it("404 when the preset does not exist", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { preset: "no-such-preset" }),
      ctx("default"),
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/hermes/profiles/[id]/tiers/import dry-run", () => {
  it("returns a real diff plus validation and leaves config.yaml untouched", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { from: "src" }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.diff).toMatch(/^@@ /m);
    expect(body.yaml).toContain("complex:");
    expect(body.yaml).toContain("keep-provider:");
    expectUnchanged(configPath, before);
  });

  it("warns about providers the target profile does not configure but stays valid", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    h.configIo.writeHermesConfig(
      "default",
      h.configSchema.parseHermesConfig({ providers: {} }),
    );

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { preset: "local-first" }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings).toContainEqual(
      expect.objectContaining({ field: "provider" }),
    );
  });

  it("reports a copied row with no model name as an error and previews nothing valid", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    h.configIo.writeHermesConfig(
      "src",
      h.configSchema.parseHermesConfig({
        tier_router: {
          tiers: {
            broken: {
              mode: "round_robin",
              escalate_to: null,
              pool: [{ provider: "fixture-provider", model: "" }],
              fallback: [],
            },
          },
        },
      }),
    );

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { from: "src" }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toEqual([
      expect.objectContaining({ tier: "broken", index: 0, field: "model", list: "pool" }),
    ]);
  });
});

describe("POST /api/hermes/profiles/[id]/tiers/import real write", () => {
  it("writes exactly the previewed yaml and replaces only the tier_router block", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    const { configPath } = h.paths.profilePaths("default");

    const previewRes = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { from: "src" }),
      ctx("default"),
    );
    const preview = await previewRes.json();

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "src" }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(fs.readFileSync(configPath, "utf8")).toBe(preview.yaml);

    const written = h.configIo.readHermesConfig("default");
    expect(JSON.parse(JSON.stringify(written.tier_router))).toEqual(sourceTierRouter());
    expect(written.model?.default).toBe("keep-me");
    expect(written.providers).toEqual({ "keep-provider": { name: "Keep" } });
  });

  it("never copies api keys from the source profile or its model refs", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    h.configIo.writeHermesConfig(
      "src",
      h.configSchema.parseHermesConfig({
        providers: { "fixture-provider": { name: "Fixture", api_key: "sk-secret-provider" } },
        tier_router: {
          tiers: {
            normal: {
              mode: "round_robin",
              escalate_to: null,
              pool: [{ provider: "fixture-provider", model: "m", api_key: "sk-secret-ref" }],
              fallback: [],
            },
          },
        },
      }),
    );

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "src" }),
      ctx("default"),
    );

    expect(res.status).toBe(200);
    const raw = fs.readFileSync(h.paths.profilePaths("default").configPath, "utf8");
    expect(raw).not.toContain("sk-secret");
    expect(raw).not.toContain("api_key");
    const written = h.configIo.readHermesConfig("default");
    expect(written.providers).toEqual({ "keep-provider": { name: "Keep" } });
  });

  it("returns 409 and writes nothing when If-Match carries a stale baseHash", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    const { configPath } = h.paths.profilePaths("default");

    const previewRes = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { from: "src" }),
      ctx("default"),
    );
    const preview = await previewRes.json();

    // Someone else edits the config after the preview was generated.
    h.configIo.updateHermesConfig("default", (cfg) => {
      cfg.model = { ...cfg.model, default: "changed-elsewhere" };
      return cfg;
    });
    const before = snapshot(configPath);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "src" }, { "if-match": preview.baseHash }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("re-run the preview");
    const after = snapshot(configPath);
    expect(after.text).toBe(before.text);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("accepts a matching If-Match baseHash and writes", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);

    const previewRes = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import?dry_run=1", { preset: "cloud-balanced" }),
      ctx("default"),
    );
    const preview = await previewRes.json();

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { preset: "cloud-balanced" }, { "if-match": preview.baseHash }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    const written = h.configIo.readHermesConfig("default");
    expect(Object.keys(written.tier_router?.tiers ?? {})).toEqual(["trivial", "normal", "complex", "plan"]);
  });

  it("returns 400 and writes nothing when validation fails", async () => {
    const h = await fresh();
    await seedSourceAndTarget(h);
    h.configIo.writeHermesConfig(
      "src",
      h.configSchema.parseHermesConfig({
        tier_router: {
          tiers: {
            broken: {
              mode: "round_robin",
              escalate_to: null,
              pool: [{ provider: "fixture-provider", model: "" }],
              fallback: [],
            },
          },
        },
      }),
    );
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.importRoute.POST(
      post("/api/hermes/profiles/default/tiers/import", { from: "src" }),
      ctx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.error).toContain("validation failed");
    expectUnchanged(configPath, before);
  });
});

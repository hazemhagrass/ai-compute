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

import type { POST as TiersPost } from "./route";
import type { DELETE as TierNameDelete } from "./[tierName]/route";

type TiersCtx = Parameters<typeof TiersPost>[1];
type TierNameCtx = Parameters<typeof TierNameDelete>[1];

let dir: string;
const origEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-routes-"));
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
    tiersRoute: await import("./route"),
    tierNameRoute: await import("./[tierName]/route"),
    configIo: await import("@/lib/hermes/config-io"),
    configSchema: await import("@/lib/hermes/config-schema"),
    paths: await import("@/lib/hermes/paths"),
    repo: await import("@/lib/repo"),
  };
}

type Harness = Awaited<ReturnType<typeof fresh>>;

function tiersCtx(id: string): TiersCtx {
  return { params: Promise.resolve({ id }) };
}

function tierNameCtx(id: string, tierName: string): TierNameCtx {
  return { params: Promise.resolve({ id, tierName }) };
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
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

function baseConfig(h: Harness, tiers: Record<string, unknown>) {
  return h.configSchema.parseHermesConfig({
    model: { default: "fixture-chat-model", provider: "fixture-provider" },
    providers: { "fixture-provider": { name: "Fixture" } },
    tier_router: {
      enabled: true,
      default_tier: "normal",
      cooldown_s: 120,
      classifier: { pool: [] },
      tiers,
    },
  });
}

function goodPool() {
  return [
    { provider: "fixture-provider", model: "fixture-chat-model" },
    { provider: "fixture-provider", model: "fixture-chat-model-2" },
  ];
}

function upsertBody(name: string, pool: { provider: string; model: string }[]) {
  return { name, mode: "round_robin", escalate_to: null, pool, fallback: [] };
}

function snapshot(configPath: string) {
  return { text: fs.readFileSync(configPath, "utf8"), mtimeMs: fs.statSync(configPath).mtimeMs };
}

function expectUnchanged(
  configPath: string,
  before: { text: string; mtimeMs: number },
): void {
  const after = snapshot(configPath);
  expect(after.text).toBe(before.text);
  expect(after.mtimeMs).toBe(before.mtimeMs);
  expect(fs.existsSync(`${configPath}.bak`)).toBe(false);
}

describe("POST /api/hermes/profiles/[id]/tiers dry-run", () => {
  it("returns a real diff and leaves config.yaml content and mtime untouched", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig(
      "default",
      baseConfig(h, {
        normal: { mode: "round_robin", escalate_to: null, pool: goodPool(), fallback: [] },
      }),
    );
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "POST", upsertBody("complex", goodPool())),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.diff).toMatch(/^@@ /m);
    expect(body.yaml).toContain("complex:");
    const removed = body.diff
      .split("\n")
      .filter((l: string) => l.startsWith("-") && !l.startsWith("---"));
    expect(removed).toEqual([]);
    expectUnchanged(configPath, before);
  });

  it("rejects an unknown provider at the offending tier and pool index", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "POST", {
        name: "complex",
        pool: [...goodPool(), { provider: "ghost-provider", model: "fixture-chat-model" }],
      }),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ tier: "complex", index: 2, field: "provider" }),
    );
    expectUnchanged(configPath, before);
  });

  it("rejects a model missing from the router model catalog", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "POST", {
        name: "normal",
        pool: [{ provider: "fixture-provider", model: "hallucinated-model" }],
      }),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ tier: "normal", index: 0, field: "model" }),
    );
    expect(body.errors[0].message).toContain("not in the router model catalog");
    expectUnchanged(configPath, before);
  });
});

describe("POST /api/hermes/profiles/[id]/tiers real write", () => {
  it("returns 400 with row errors and writes nothing when invalid", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers", "POST", {
        name: "complex",
        pool: [{ provider: "ghost-provider", model: "hallucinated-model" }],
      }),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.dryRun).toBe(false);
    expect(body.errors).toEqual([
      expect.objectContaining({ tier: "complex", index: 0, field: "provider" }),
      expect.objectContaining({ tier: "complex", index: 0, field: "model" }),
    ]);
    expectUnchanged(configPath, before);
  });

  it("writes exactly the yaml the dry-run previewed and reads back the same", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");

    const previewRes = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "POST", upsertBody("complex", goodPool())),
      tiersCtx("default"),
    );
    const preview = await previewRes.json();

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers", "POST", upsertBody("complex", goodPool())),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.valid).toBe(true);
    expect(fs.readFileSync(configPath, "utf8")).toBe(preview.yaml);
    const written = h.configIo.readHermesConfig("default");
    expect(written.tier_router?.tiers.complex.pool).toHaveLength(2);
    expect(preview.yaml).toContain("complex:");
  });

  it("is not blocked by a broken tier it is not editing", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig(
      "default",
      baseConfig(h, {
        broken: {
          mode: "priority",
          escalate_to: null,
          pool: [{ provider: "ghost-provider", model: "hallucinated-model" }],
          fallback: [],
        },
      }),
    );

    const res = await h.tiersRoute.POST(
      jsonRequest("/api/hermes/profiles/default/tiers", "POST", upsertBody("normal", goodPool())),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    const written = h.configIo.readHermesConfig("default");
    expect(written.tier_router?.tiers.broken.pool[0].provider).toBe("ghost-provider");
    expect(written.tier_router?.tiers.normal.pool).toHaveLength(2);
  });
});

describe("PATCH /api/hermes/profiles/[id]/tiers classifier pool", () => {
  it("dry-run reports classifier pool rows and never writes", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const res = await h.tiersRoute.PATCH(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "PATCH", {
        classifier_pool: [{ provider: "ghost-provider", model: "fixture-chat-model" }],
      }),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ tier: "classifier", index: 0, field: "provider", list: "pool" }),
    );
    expectUnchanged(configPath, before);
  });

  it("writes a valid classifier pool after previewing it", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig("default", baseConfig(h, {}));
    const { configPath } = h.paths.profilePaths("default");

    const previewRes = await h.tiersRoute.PATCH(
      jsonRequest("/api/hermes/profiles/default/tiers?dry_run=1", "PATCH", { classifier_pool: goodPool() }),
      tiersCtx("default"),
    );
    const preview = await previewRes.json();
    expect(preview.valid).toBe(true);

    const res = await h.tiersRoute.PATCH(
      jsonRequest("/api/hermes/profiles/default/tiers", "PATCH", { classifier_pool: goodPool() }),
      tiersCtx("default"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(fs.readFileSync(configPath, "utf8")).toBe(preview.yaml);
    const written = h.configIo.readHermesConfig("default");
    expect(written.tier_router?.classifier.pool).toHaveLength(2);
  });
});

describe("tiers/[tierName] dry-run", () => {
  it("previews a delete without writing, then the real delete writes", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig(
      "default",
      baseConfig(h, {
        trivial: { mode: "priority", escalate_to: null, pool: goodPool(), fallback: [] },
      }),
    );
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const previewRes = await h.tierNameRoute.DELETE(
      new Request("http://localhost/api/hermes/profiles/default/tiers/trivial?dry_run=1"),
      tierNameCtx("default", "trivial"),
    );
    const preview = await previewRes.json();

    expect(preview.dryRun).toBe(true);
    expect(preview.yaml).not.toContain("trivial:");
    expect(preview.diff).toMatch(/^@@ /m);
    expectUnchanged(configPath, before);

    const res = await h.tierNameRoute.DELETE(
      new Request("http://localhost/api/hermes/profiles/default/tiers/trivial"),
      tierNameCtx("default", "trivial"),
    );
    const body = await res.json();

    expect(body.dryRun).toBe(false);
    expect(fs.readFileSync(configPath, "utf8")).not.toContain("trivial:");
    expect(h.configIo.readHermesConfig("default").tier_router?.tiers.trivial).toBeUndefined();
  });

  it("previews a rename without writing, then the real rename writes", async () => {
    const h = await fresh();
    await seedCatalog(h);
    h.configIo.writeHermesConfig(
      "default",
      baseConfig(h, {
        normal: { mode: "round_robin", escalate_to: null, pool: goodPool(), fallback: [] },
      }),
    );
    const { configPath } = h.paths.profilePaths("default");
    const before = snapshot(configPath);

    const previewRes = await h.tierNameRoute.PATCH(
      jsonRequest("/api/hermes/profiles/default/tiers/normal?dry_run=1", "PATCH", { newName: "standard" }),
      tierNameCtx("default", "normal"),
    );
    const preview = await previewRes.json();

    expect(preview.dryRun).toBe(true);
    expect(preview.valid).toBe(true);
    expect(preview.diff).toMatch(/^\+.*standard:$/m);
    expectUnchanged(configPath, before);

    const res = await h.tierNameRoute.PATCH(
      jsonRequest("/api/hermes/profiles/default/tiers/normal", "PATCH", { newName: "standard" }),
      tierNameCtx("default", "normal"),
    );

    expect(res.status).toBe(200);
    const written = h.configIo.readHermesConfig("default");
    expect(written.tier_router?.tiers.standard).toBeDefined();
    expect(written.tier_router?.tiers.normal).toBeUndefined();
    expect(written.tier_router?.default_tier).toBe("standard");
  });
});

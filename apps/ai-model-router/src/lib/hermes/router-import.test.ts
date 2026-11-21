import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";

import type { Model } from "../types";
import type { ModelCatalog } from "./config-validate";

let dir: string;
const origEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-import-"));
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
    configIo: await import("./config-io"),
    configSchema: await import("./config-schema"),
    configValidate: await import("./config-validate"),
    profiles: await import("./profiles"),
    routerImport: await import("./router-import"),
  };
}

type Harness = Awaited<ReturnType<typeof fresh>>;

function catchErr(fn: () => unknown): { status?: number; message?: string } {
  try {
    fn();
  } catch (err) {
    return err as { status?: number; message?: string };
  }
  throw new Error("expected the call to throw");
}

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: 1,
    providerId: 1,
    providerSlug: "fixture-provider",
    providerName: "Fixture Provider",
    modelId: "fixture-chat-model",
    label: "Fixture Chat Model",
    quality: 60,
    speed: 60,
    cheapness: 60,
    contextWindow: 128000,
    maxOutput: 8192,
    inputCost: 1,
    outputCost: 2,
    skills: {},
    features: {
      tools: true,
      vision: false,
      json: true,
      streaming: true,
      reasoning: false,
      audio: false,
      embedding: false,
    },
    tags: [],
    notes: "",
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const catalog: ModelCatalog = { models: [model()] };

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
        pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }],
        fallback: [],
      },
    },
    routes: { plan: { easy: "complex" } },
  };
}

async function seedSource(h: Harness, id: string, tierRouter: Record<string, unknown>): Promise<void> {
  h.configIo.writeHermesConfig(
    id,
    h.configSchema.parseHermesConfig({
      model: { default: "m", provider: "fixture-provider" },
      providers: { "fixture-provider": { name: "Fixture" } },
      tier_router: tierRouter,
    }),
  );
}

describe("resolveTierRouterSource", () => {
  it("copies the tier_router block from another profile", async () => {
    const h = await fresh();
    await seedSource(h, "default", sourceTierRouter());

    const resolved = h.routerImport.resolveTierRouterSource({ from: "default" });

    expect(JSON.parse(JSON.stringify(resolved))).toEqual(sourceTierRouter());
  });

  it("copies a preset's tier_router block", async () => {
    const h = await fresh();
    const resolved = h.routerImport.resolveTierRouterSource({ preset: "local-first" });
    const { getRouterPreset } = await import("./router-presets");
    expect(JSON.parse(JSON.stringify(resolved))).toEqual(
      JSON.parse(JSON.stringify(getRouterPreset("local-first")!.tierRouter)),
    );
  });

  it("drops api_key values out of copied model refs so keys never cross profiles", async () => {
    const h = await fresh();
    await seedSource(h, "default", {
      tiers: {
        normal: {
          mode: "round_robin",
          escalate_to: null,
          api_key: "sk-secret-tier",
          pool: [{ provider: "fixture-provider", model: "m", api_key: "sk-secret-ref" }],
          fallback: [{ provider: "fixture-provider", model: "m", api_key: "sk-secret-fb" }],
        },
      },
      classifier: { api_key: "sk-secret-classifier", pool: [{ provider: "fixture-provider", model: "m", api_key: "sk-secret-cls" }] },
    });

    const resolved = h.routerImport.resolveTierRouterSource({ from: "default" });

    const text = JSON.stringify(resolved);
    expect(text).not.toContain("sk-secret");
    expect(text).not.toContain("api_key");
  });

  it("returns 404 for an unknown source profile", async () => {
    const h = await fresh();
    const err = catchErr(() => h.routerImport.resolveTierRouterSource({ from: "ghost" }));
    expect(err.status).toBe(404);
  });

  it("returns 404 for a source profile name that is not an identifier", async () => {
    const h = await fresh();
    const err = catchErr(() => h.routerImport.resolveTierRouterSource({ from: "../evil" }));
    expect(err.status).toBe(404);
  });

  it("returns 404 for a source profile without a tier_router block", async () => {
    const h = await fresh();
    h.configIo.writeHermesConfig("default", h.configSchema.parseHermesConfig({}));
    const err = catchErr(() => h.routerImport.resolveTierRouterSource({ from: "default" }));
    expect(err.status).toBe(404);
  });

  it("returns 404 for an unknown preset", async () => {
    const h = await fresh();
    const err = catchErr(() => h.routerImport.resolveTierRouterSource({ preset: "nope" }));
    expect(err.status).toBe(404);
  });
});

describe("applyImportTierRouter", () => {
  it("replaces only the tier_router block and leaves the rest of the config alone", async () => {
    const h = await fresh();
    const before = h.configSchema.parseHermesConfig({
      model: { default: "keep-me", provider: "fixture-provider" },
      providers: { "fixture-provider": { name: "Fixture", api_key: "${KEEP_ME}" } },
      fallback_providers: [{ provider: "fixture-provider", model: "m" }],
      model_aliases: { fast: "fixture-chat-model" },
      tier_router: { tiers: { old: { mode: "priority", escalate_to: null, pool: [], fallback: [] } } },
    });

    const seeded = h.configSchema.parseHermesConfig({ tier_router: sourceTierRouter() }).tier_router!;
    const next = h.routerImport.applyImportTierRouter(before, seeded);

    expect(JSON.parse(JSON.stringify(next.tier_router))).toEqual(sourceTierRouter());
    expect(next.model).toEqual(before.model);
    expect(next.providers).toEqual(before.providers);
    expect(next.fallback_providers).toEqual(before.fallback_providers);
    expect(next.model_aliases).toEqual(before.model_aliases);
  });
});

describe("createProfile with a seeded router", () => {
  it("writes a tier_router identical to the source block when read back from disk", async () => {
    const h = await fresh();
    await seedSource(h, "default", sourceTierRouter());
    const router = h.routerImport.resolveTierRouterSource({ from: "default" });

    h.profiles.createProfile("work", router);

    const { profilePaths } = await import("./paths");
    const raw = fs.readFileSync(profilePaths("work").configPath, "utf8");
    const written = JSON.parse(JSON.stringify(h.configIo.readHermesConfig("work").tier_router));
    expect(written).toEqual(sourceTierRouter());
    expect(parseYaml(raw).tier_router).toEqual(sourceTierRouter());
  });

  it("gives the new profile an empty .env and copies no providers or keys", async () => {
    const h = await fresh();
    await seedSource(h, "default", sourceTierRouter());
    const { profilePaths } = await import("./paths");
    fs.writeFileSync(profilePaths("default").envPath, "ANTHROPIC_API_KEY=sk-secret-env\n", { mode: 0o600 });
    const router = h.routerImport.resolveTierRouterSource({ from: "default" });

    h.profiles.createProfile("work", router);

    const target = profilePaths("work");
    expect(fs.readFileSync(target.envPath, "utf8")).toBe("");
    const raw = fs.readFileSync(target.configPath, "utf8");
    expect(raw).not.toContain("sk-secret");
    expect(raw).not.toContain("api_key");
    expect(h.configIo.readHermesConfig("work").providers).toEqual({});
  });
});

describe("import validation policy", () => {
  function tierConfig(h: Harness, tiers: Record<string, unknown>) {
    return h.configSchema.parseHermesConfig({
      providers: { "fixture-provider": { name: "Fixture" } },
      tier_router: { tiers, classifier: { pool: [] } },
    });
  }

  it("treats providers missing from the target profile as warnings, not errors", async () => {
    const h = await fresh();
    const before = h.configSchema.parseHermesConfig({});
    const after = tierConfig(h, {
      normal: {
        mode: "round_robin",
        escalate_to: null,
        pool: [
          { provider: "ghost-provider", model: "fixture-chat-model" },
          { provider: "fixture-provider", model: "hallucinated-model" },
        ],
        fallback: [],
      },
    });

    const outcome = h.configValidate.validateWrittenEntries(before, after, { kind: "import" }, catalog);

    expect(outcome.errors).toEqual([]);
    expect(outcome.warnings.map((w) => w.field).sort()).toEqual(["model", "provider"]);
  });

  it("still errors on a copied row with no model name", async () => {
    const h = await fresh();
    const before = h.configSchema.parseHermesConfig({});
    const after = tierConfig(h, {
      normal: {
        mode: "round_robin",
        escalate_to: null,
        pool: [{ provider: "fixture-provider", model: "" }],
        fallback: [],
      },
    });

    const outcome = h.configValidate.validateWrittenEntries(before, after, { kind: "import" }, catalog);

    expect(outcome.errors).toEqual([
      expect.objectContaining({ tier: "normal", index: 0, field: "model", list: "pool" }),
    ]);
  });

  it("downgrades an excluded model to a warning on import but keeps it an error on edit", async () => {
    const h = await fresh();
    const embedCatalog: ModelCatalog = {
      models: [model({ id: 9, modelId: "fixture-embed", label: "Fixture Embed", features: { ...model().features, embedding: true, tools: false } })],
    };
    const before = h.configSchema.parseHermesConfig({});
    const after = tierConfig(h, {
      normal: {
        mode: "round_robin",
        escalate_to: null,
        pool: [{ provider: "fixture-provider", model: "fixture-embed" }],
        fallback: [],
      },
    });

    const imported = h.configValidate.validateWrittenEntries(before, after, { kind: "import" }, embedCatalog);
    expect(imported.errors).toEqual([]);
    expect(imported.warnings).toEqual([
      expect.objectContaining({ tier: "normal", field: "model" }),
    ]);

    const edited = h.configValidate.validateWrittenEntries(before, after, { kind: "tier", name: "normal" }, embedCatalog);
    expect(edited.errors).toEqual([
      expect.objectContaining({ tier: "normal", field: "model" }),
    ]);
  });

  it("keeps the edit policy strict: a missing provider on a tier edit is still an error", async () => {
    const h = await fresh();
    const before = tierConfig(h, { normal: { mode: "round_robin", escalate_to: null, pool: [], fallback: [] } });
    const after = tierConfig(h, {
      normal: {
        mode: "round_robin",
        escalate_to: null,
        pool: [{ provider: "ghost-provider", model: "fixture-chat-model" }],
        fallback: [],
      },
    });

    const outcome = h.configValidate.validateWrittenEntries(before, after, { kind: "tier", name: "normal" }, catalog);

    expect(outcome.errors).toEqual([
      expect.objectContaining({ tier: "normal", field: "provider" }),
    ]);
  });
});

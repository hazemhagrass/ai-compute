import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * All of config-io / profiles / providers / tiers key off HERMES_HOME (see
 * paths.ts), so pointing it at a fresh temp dir per test gives full
 * read/write coverage against real files without ever touching the actual
 * ~/.hermes install these modules are designed to manage.
 */
let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-test-"));
  origHome = process.env.HERMES_HOME;
  process.env.HERMES_HOME = dir;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = origHome;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function fresh() {
  // Re-import so every module re-reads HERMES_HOME from the just-set env var
  // (paths.ts captures it once at module-eval time) — vi.resetModules()
  // forces a fresh module instance per test instead of the cached one from
  // a previous test's HERMES_HOME.
  vi.resetModules();
  return {
    configIo: await import("./config-io"),
    profiles: await import("./profiles"),
    providers: await import("./providers"),
    tiers: await import("./tiers"),
    paths: await import("./paths"),
  };
}

describe("config-io", () => {
  it("reads an empty config for a profile with no config.yaml yet", async () => {
    const { configIo } = await fresh();
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.providers).toEqual({});
    expect(cfg.fallback_providers).toEqual([]);
  });

  it("round-trips a written config exactly through YAML", async () => {
    const { configIo } = await fresh();
    const { parseHermesConfig } = await import("./config-schema");
    configIo.writeHermesConfig(
      "default",
      parseHermesConfig({
        model: { default: "claude-opus-5", provider: "anthropic" },
        providers: { anthropic: { name: "Anthropic" } },
        fallback_providers: [{ provider: "opencode-go", model: "glm-5.3-flash" }],
      }),
    );
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.model?.default).toBe("claude-opus-5");
    expect(cfg.providers.anthropic.name).toBe("Anthropic");
    expect(cfg.fallback_providers[0]).toEqual({ provider: "opencode-go", model: "glm-5.3-flash" });
  });

  it("keeps a .bak of the previous file on every write", async () => {
    const { configIo, paths } = await fresh();
    const { parseHermesConfig } = await import("./config-schema");
    configIo.writeHermesConfig("default", parseHermesConfig({ model: { default: "a" } }));
    configIo.writeHermesConfig("default", parseHermesConfig({ model: { default: "b" } }));
    const { configPath } = paths.profilePaths("default");
    expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
    const { parse } = await import("yaml");
    expect(parse(fs.readFileSync(`${configPath}.bak`, "utf8")).model.default).toBe("a");
  });

  it("updateHermesConfig defaults tier_router so callers never see undefined", async () => {
    const { configIo } = await fresh();
    const cfg = configIo.updateHermesConfig("default", (c) => c);
    expect(cfg.tier_router).toBeDefined();
    expect(cfg.tier_router?.tiers).toEqual({});
  });

  it("writes named profiles under profiles/<name>/config.yaml", async () => {
    const { configIo, paths } = await fresh();
    const { parseHermesConfig } = await import("./config-schema");
    configIo.writeHermesConfig("work", parseHermesConfig({ model: { default: "x" } }));
    const { configPath } = paths.profilePaths("work");
    expect(configPath).toBe(path.join(dir, "profiles", "work", "config.yaml"));
    expect(fs.existsSync(configPath)).toBe(true);
  });
});

describe("profiles", () => {
  it("always lists the default profile even with zero named profiles", async () => {
    const { profiles } = await fresh();
    const list = profiles.listHermesProfiles();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("default");
    expect(list[0].hasConfig).toBe(false);
  });

  it("lists named profile directories alongside default", async () => {
    const { configIo, profiles } = await fresh();
    const { parseHermesConfig } = await import("./config-schema");
    configIo.writeHermesConfig(
      "default",
      parseHermesConfig({ model: { default: "claude-opus-5", provider: "anthropic" } }),
    );
    configIo.writeHermesConfig("work", parseHermesConfig({ model: { default: "gpt-6", provider: "openai-codex" } }));
    const list = profiles.listHermesProfiles();
    expect(list.map((p) => p.id).sort()).toEqual(["default", "work"]);
    const work = list.find((p) => p.id === "work")!;
    expect(work.defaultModel).toBe("gpt-6");
    expect(work.isDefault).toBe(false);
  });
});

describe("providers", () => {
  it("addProvider writes the provider entry and the API key to .env", async () => {
    const { configIo, providers, paths } = await fresh();
    providers.addProvider("default", { id: "anthropic", catalogId: "anthropic", apiKey: "sk-test-123" });

    const cfg = configIo.readHermesConfig("default");
    expect(cfg.providers.anthropic).toBeDefined();

    const { envPath } = paths.profilePaths("default");
    const { envValues } = await import("./env");
    expect(envValues(envPath).ANTHROPIC_API_KEY).toBe("sk-test-123");
  });

  it("addProvider without a known env var stores the key on the provider entry (custom/self-hosted)", async () => {
    const { configIo, providers } = await fresh();
    providers.addProvider("default", {
      id: "my-lan-ollama",
      catalogId: "custom",
      baseUrl: "http://192.168.1.50:11434/v1",
    });
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.providers["my-lan-ollama"].api).toBe("http://192.168.1.50:11434/v1");
  });

  it("listProviderViews reports hasKey / isDefault / usedInFallback / usedInTiers", async () => {
    const { configIo, providers } = await fresh();
    providers.addProvider("default", { id: "anthropic", catalogId: "anthropic", apiKey: "sk-a" });
    providers.addProvider("default", { id: "opencode-go", catalogId: "opencode-go" });
    providers.setDefaultModel("default", "anthropic", "claude-opus-5");

    configIo.updateHermesConfig("default", (cfg) => {
      cfg.fallback_providers = [{ provider: "opencode-go", model: "glm-5.3-flash" }];
      cfg.tier_router = {
        enabled: true,
        default_tier: "normal",
        cooldown_s: 120,
        classifier: { pool: [{ provider: "opencode-go", model: "glm-5.3-flash" }] },
        tiers: {
          normal: {
            mode: "round_robin",
            escalate_to: null,
            pool: [{ provider: "anthropic", model: "claude-opus-5" }],
            fallback: [],
          },
        },
      };
      return cfg;
    });

    const cfg = configIo.readHermesConfig("default");
    const views = providers.listProviderViews("default", cfg);
    const anthropic = views.find((v) => v.id === "anthropic")!;
    const oc = views.find((v) => v.id === "opencode-go")!;
    expect(anthropic.hasKey).toBe(true);
    expect(anthropic.isDefault).toBe(true);
    expect(anthropic.usedInTiers).toEqual(["normal"]);
    expect(oc.hasKey).toBe(false);
    expect(oc.usedInFallback).toBe(true);
    expect(oc.usedInTiers).toEqual(["classifier"]);
  });

  it("removeProvider clears fallback/tier references and default-model pointer", async () => {
    const { configIo, providers } = await fresh();
    providers.addProvider("default", { id: "anthropic", catalogId: "anthropic" });
    providers.setDefaultModel("default", "anthropic", "claude-opus-5");
    configIo.updateHermesConfig("default", (cfg) => {
      cfg.fallback_providers = [{ provider: "anthropic", model: "claude-opus-5" }];
      return cfg;
    });

    providers.removeProvider("default", "anthropic");

    const cfg = configIo.readHermesConfig("default");
    expect(cfg.providers.anthropic).toBeUndefined();
    expect(cfg.fallback_providers).toEqual([]);
    expect(cfg.model?.provider).toBeUndefined();
  });

  it("updateProvider with apiKey: '' clears a stored key", async () => {
    const { providers, paths } = await fresh();
    providers.addProvider("default", { id: "anthropic", catalogId: "anthropic", apiKey: "sk-a" });
    providers.updateProvider("default", "anthropic", { apiKey: "" });
    const { envPath } = paths.profilePaths("default");
    const { envValues } = await import("./env");
    expect(envValues(envPath).ANTHROPIC_API_KEY).toBeUndefined();
  });
});

describe("tiers", () => {
  it("upsertTier creates a tier with defaults filled in", async () => {
    const { configIo, tiers } = await fresh();
    tiers.upsertTier("default", "trivial", { pool: [{ provider: "opencode-go", model: "glm-5.3-flash" }] });
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.tiers.trivial.mode).toBe("round_robin");
    expect(cfg.tier_router?.tiers.trivial.pool).toHaveLength(1);
  });

  it("removeTier clears dangling escalate_to pointers and resets default_tier", async () => {
    const { configIo, tiers } = await fresh();
    tiers.upsertTier("default", "trivial", { pool: [{ provider: "a", model: "m" }] });
    tiers.upsertTier("default", "normal", { pool: [{ provider: "a", model: "m" }], escalate_to: "trivial" });
    tiers.setDefaultTier("default", "trivial");

    tiers.removeTier("default", "trivial");

    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.tiers.trivial).toBeUndefined();
    expect(cfg.tier_router?.tiers.normal.escalate_to).toBeNull();
    expect(cfg.tier_router?.default_tier).toBe("normal");
  });

  it("renameTier moves the entry and fixes up escalate_to + default_tier references", async () => {
    const { configIo, tiers } = await fresh();
    tiers.upsertTier("default", "trivial", { pool: [{ provider: "a", model: "m" }] });
    tiers.upsertTier("default", "normal", { pool: [{ provider: "a", model: "m" }], escalate_to: "trivial" });
    tiers.setDefaultTier("default", "trivial");

    tiers.renameTier("default", "trivial", "cheap");

    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.tiers.trivial).toBeUndefined();
    expect(cfg.tier_router?.tiers.cheap).toBeDefined();
    expect(cfg.tier_router?.tiers.normal.escalate_to).toBe("cheap");
    expect(cfg.tier_router?.default_tier).toBe("cheap");
  });

  it("setClassifierPool and setTierRouterEnabled update just those fields", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setTierRouterEnabled("default", true);
    tiers.setClassifierPool("default", [{ provider: "opencode-go", model: "glm-5.3-flash" }]);
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.enabled).toBe(true);
    expect(cfg.tier_router?.classifier.pool).toHaveLength(1);
  });
});

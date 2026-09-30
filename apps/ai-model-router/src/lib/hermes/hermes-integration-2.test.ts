import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Same fresh-HERMES_HOME-per-test approach as hermes-integration.test.ts —
 * see that file for the rationale on vi.resetModules().
 */
let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-test2-"));
  origHome = process.env.HERMES_HOME;
  process.env.HERMES_HOME = dir;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = origHome;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function fresh() {
  vi.resetModules();
  return {
    configIo: await import("./config-io"),
    profiles: await import("./profiles"),
    tiers: await import("./tiers"),
    fallback: await import("./fallback"),
    aliases: await import("./aliases"),
  };
}

describe("fallback chain", () => {
  it("reads an empty chain for a config with none set", async () => {
    const { fallback } = await fresh();
    expect(fallback.getFallbackChain("default")).toEqual([]);
  });

  it("setFallbackChain replaces the whole ordered array", async () => {
    const { fallback } = await fresh();
    const chain = [
      { provider: "opencode-go", model: "deepseek-v4-pro" },
      { provider: "anthropic", model: "claude-opus-5" },
    ];
    const result = fallback.setFallbackChain("default", chain);
    expect(result).toEqual(chain);
    expect(fallback.getFallbackChain("default")).toEqual(chain);
  });

  it("an empty array clears the chain", async () => {
    const { fallback } = await fresh();
    fallback.setFallbackChain("default", [{ provider: "a", model: "m" }]);
    fallback.setFallbackChain("default", []);
    expect(fallback.getFallbackChain("default")).toEqual([]);
  });
});

describe("classifier settings", () => {
  it("setClassifierSettings sets timeout_s and history_turns independently", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setClassifierSettings("default", { timeout_s: 12 });
    tiers.setClassifierSettings("default", { history_turns: 4 });
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.classifier.timeout_s).toBe(12);
    expect(cfg.tier_router?.classifier.history_turns).toBe(4);
  });

  it("does not clobber the pool when only settings change", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setClassifierPool("default", [{ provider: "a", model: "m" }]);
    tiers.setClassifierSettings("default", { timeout_s: 5 });
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.classifier.pool).toEqual([{ provider: "a", model: "m" }]);
    expect(cfg.tier_router?.classifier.timeout_s).toBe(5);
  });
});

describe("task routes", () => {
  it("setRoute creates the task/subtype/tier mapping", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setRoute("default", "plan", "easy", "plan");
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.routes?.plan.easy).toBe("plan");
  });

  it("removeRoute deletes the leaf and prunes an emptied parent", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setRoute("default", "plan", "easy", "plan");
    tiers.removeRoute("default", "plan", "easy");
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.routes?.plan).toBeUndefined();
  });

  it("removeRoute leaves sibling subtypes under the same task intact", async () => {
    const { configIo, tiers } = await fresh();
    tiers.setRoute("default", "plan", "easy", "plan");
    tiers.setRoute("default", "plan", "hard", "complex");
    tiers.removeRoute("default", "plan", "easy");
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.routes?.plan.easy).toBeUndefined();
    expect(cfg.tier_router?.routes?.plan.hard).toBe("complex");
  });

  it("removeTier drops any route pointing at the removed tier", async () => {
    const { configIo, tiers } = await fresh();
    tiers.upsertTier("default", "cheap", { pool: [{ provider: "a", model: "m" }] });
    tiers.setRoute("default", "plan", "easy", "cheap");
    tiers.removeTier("default", "cheap");
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.routes?.plan).toBeUndefined();
  });

  it("renameTier updates any route pointing at the renamed tier", async () => {
    const { configIo, tiers } = await fresh();
    tiers.upsertTier("default", "cheap", { pool: [{ provider: "a", model: "m" }] });
    tiers.setRoute("default", "plan", "easy", "cheap");
    tiers.renameTier("default", "cheap", "budget");
    const cfg = configIo.readHermesConfig("default");
    expect(cfg.tier_router?.routes?.plan.easy).toBe("budget");
  });
});

describe("model aliases", () => {
  it("listAliases is empty for a config with none set", async () => {
    const { aliases } = await fresh();
    expect(aliases.listAliases("default")).toEqual({});
  });

  it("setAlias then listAliases round-trips a ModelRef", async () => {
    const { aliases } = await fresh();
    aliases.setAlias("default", "fast", { provider: "anthropic", model: "claude-opus-5" });
    expect(aliases.listAliases("default")).toEqual({
      fast: { provider: "anthropic", model: "claude-opus-5" },
    });
  });

  it("removeAlias deletes just the named alias", async () => {
    const { aliases } = await fresh();
    aliases.setAlias("default", "fast", { provider: "anthropic", model: "claude-opus-5" });
    aliases.setAlias("default", "cheap", { provider: "opencode-go", model: "glm-5.3-flash" });
    aliases.removeAlias("default", "fast");
    const result = aliases.listAliases("default");
    expect(result.fast).toBeUndefined();
    expect(result.cheap).toEqual({ provider: "opencode-go", model: "glm-5.3-flash" });
  });

  it("rejects an alias name that doesn't look like an identifier", async () => {
    const { aliases } = await fresh();
    expect(() => aliases.setAlias("default", "not a valid name!", { provider: "a", model: "m" })).toThrow();
  });

  it("normalizes a legacy bare-string alias (provider/model) on read", async () => {
    const { configIo, aliases } = await fresh();
    configIo.updateHermesConfig("default", (cfg) => {
      cfg.model_aliases = { legacy: "anthropic/claude-opus-5" };
      return cfg;
    });
    expect(aliases.listAliases("default")).toEqual({
      legacy: { provider: "anthropic", model: "claude-opus-5" },
    });
  });
});

describe("profile lifecycle", () => {
  it("createProfile makes a directory with a valid empty config.yaml and .env", async () => {
    const { profiles, configIo } = await fresh();
    const summary = profiles.createProfile("work");
    expect(summary.id).toBe("work");
    expect(summary.hasConfig).toBe(true);
    const cfg = configIo.readHermesConfig("work");
    expect(cfg.providers).toEqual({});
    expect(fs.existsSync(path.join(dir, "profiles", "work", ".env"))).toBe(true);
  });

  it("createProfile rejects \"default\" and duplicate names", async () => {
    const { profiles } = await fresh();
    expect(() => profiles.createProfile("default")).toThrow();
    profiles.createProfile("work");
    expect(() => profiles.createProfile("work")).toThrow();
  });

  it("createProfile rejects a name that isn't identifier-shaped", async () => {
    const { profiles } = await fresh();
    expect(() => profiles.createProfile("not valid!")).toThrow();
  });

  it("deleteProfile moves the directory aside instead of removing it", async () => {
    const { profiles } = await fresh();
    profiles.createProfile("work");
    profiles.deleteProfile("work");
    expect(fs.existsSync(path.join(dir, "profiles", "work"))).toBe(false);
    const trashDirs = fs.readdirSync(path.join(dir, "profiles")).filter((n) => n.startsWith(".deleted-work-"));
    expect(trashDirs).toHaveLength(1);
  });

  it("deleteProfile refuses to delete \"default\"", async () => {
    const { profiles } = await fresh();
    expect(() => profiles.deleteProfile("default")).toThrow();
  });

  it("a deleted profile no longer appears in listHermesProfiles", async () => {
    const { profiles } = await fresh();
    profiles.createProfile("work");
    profiles.deleteProfile("work");
    const list = profiles.listHermesProfiles();
    expect(list.map((p) => p.id)).not.toContain("work");
  });
});

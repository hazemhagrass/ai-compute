import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-profiles-test-"));
  origHome = process.env.HERMES_HOME;
  process.env.HERMES_HOME = dir;
  fs.mkdirSync(path.join(dir, "profiles", "good"), { recursive: true });
  fs.writeFileSync(path.join(dir, "profiles", "good", "config.yaml"), [
    "model:",
    "  default: glm-5.3-flash",
    "  provider: opencode-go",
    "tier_router:",
    "  enabled: true",
    "  tiers:",
    "    normal:",
    "      mode: weighted_round_robin",
    "      pool:",
    "        - provider: opencode-go",
    "          model: glm-5.3-flash",
    "          weight: 3",
  ].join("\n"), "utf8");
  fs.mkdirSync(path.join(dir, "profiles", "broken"), { recursive: true });
  fs.writeFileSync(path.join(dir, "profiles", "broken", "config.yaml"), [
    "tier_router:",
    "  enabled: true",
    "  cooldown_s: ten",
  ].join("\n"), "utf8");
  // Realistic bad YAML: the parse error embeds the offending source line (right where a
  // key-like line lives) in err.message, so the raw message is exactly what must not leak.
  fs.mkdirSync(path.join(dir, "profiles", "leaky"), { recursive: true });
  fs.writeFileSync(path.join(dir, "profiles", "leaky", "config.yaml"), [
    "model: {a: 1",
    "api_key: FAKE",
  ].join("\n"), "utf8");
  fs.mkdirSync(path.join(dir, "profiles", "empty"), { recursive: true });
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = origHome;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function fresh() {
  vi.resetModules();
  return { profiles: await import("./profiles") };
}

describe("listHermesProfiles", () => {
  it("lists every profile even when one has an unparseable config", async () => {
    const { profiles } = await fresh();
    const list = profiles.listHermesProfiles();
    expect(list.map((p) => p.id)).toContain("default");
    expect(list.map((p) => p.id).sort()).toContain("broken");
  });

  it("summarizes good and empty profiles normally", async () => {
    const { profiles } = await fresh();
    const list = profiles.listHermesProfiles();
    const good = list.find((p) => p.id === "good");
    expect(good).toMatchObject({
      hasConfig: true,
      defaultModel: "glm-5.3-flash",
      tierRouterEnabled: true,
      tierCount: 1,
    });
    expect(good?.configError).toBeUndefined();
    const empty = list.find((p) => p.id === "empty");
    expect(empty?.hasConfig).toBe(false);
    expect(empty?.configError).toBeUndefined();
  });

  it("flags a config parse error on the offending profile only", async () => {
    const { profiles } = await fresh();
    const list = profiles.listHermesProfiles();
    const broken = list.find((p) => p.id === "broken");
    expect(broken?.hasConfig).toBe(true);
    expect(broken?.configError).toBeTruthy();
    // Zeroed counts, no throw, and the flag stays on the one bad profile.
    expect(broken?.providerCount).toBe(0);
    expect(list.find((p) => p.id === "good")?.configError).toBeUndefined();
  });
});

describe("configError sanitisation", () => {
  it("never lets config source text reach configError", async () => {
    const { profiles } = await fresh();
    const err = profiles.getHermesProfile("leaky").configError ?? "";
    expect(err).toBeTruthy();
    // The raw YAML error message contains this source line; the summary must not.
    expect(err).not.toContain("FAKE");
    expect(err).not.toContain("api_key: FAKE");
  });

  it("keeps configError short and on a single line", async () => {
    const { profiles } = await fresh();
    for (const id of ["broken", "leaky"]) {
      const err = profiles.getHermesProfile(id).configError ?? "";
      expect(err, id).toBeTruthy();
      expect(err.length, id).toBeLessThanOrEqual(80);
      expect(err, id).not.toContain("\n");
    }
  });

  it("names the offending field for schema errors instead of dumping issue JSON", async () => {
    const { profiles } = await fresh();
    // broken fixture: cooldown_s: ten -> zod invalid_type at tier_router.cooldown_s.
    const err = profiles.getHermesProfile("broken").configError ?? "";
    expect(err).toContain("cooldown_s");
    expect(err).not.toContain("[");
  });
});

describe("getHermesProfile", () => {
  it("isolates a broken config and keeps its neighbours healthy", async () => {
    const { profiles } = await fresh();
    const broken = profiles.getHermesProfile("broken");
    expect(broken.id).toBe("broken");
    expect(broken.hasConfig).toBe(true);
    expect(broken.configError).toBeTruthy();
    expect(broken.providerCount).toBe(0);
    expect(broken.tierCount).toBe(0);
    expect(broken.defaultModel).toBe("");
    expect(broken.tierRouterEnabled).toBe(false);

    const good = profiles.getHermesProfile("good");
    expect(good.configError).toBeUndefined();
    expect(good.defaultModel).toBe("glm-5.3-flash");
    expect(good.tierCount).toBe(1);
  });

  it("coerces Hermes-style weights without failing the profile", async () => {
    // _clean_pool parity through the full read path: '3' -> 3, 0 -> 1, 'abc' -> 1.
    fs.mkdirSync(path.join(dir, "profiles", "weights"), { recursive: true });
    fs.writeFileSync(path.join(dir, "profiles", "weights", "config.yaml"), [
      "tier_router:",
      "  enabled: true",
      "  tiers:",
      "    normal:",
      "      mode: weighted_round_robin",
      "      pool:",
      "        - provider: a",
      "          model: m1",
      "          weight: \"3\"",
      "        - provider: b",
      "          model: m2",
      "          weight: 0",
      "        - provider: c",
      "          model: m3",
      "          weight: abc",
    ].join("\n"), "utf8");
    const { profiles } = await fresh();
    const p = profiles.getHermesProfile("weights");
    expect(p.configError).toBeUndefined();
    expect(p.tierCount).toBe(1);
    expect(p.tierRouterEnabled).toBe(true);
  });
});

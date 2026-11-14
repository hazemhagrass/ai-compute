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

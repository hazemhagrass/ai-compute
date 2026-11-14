import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-profiles-test-"));
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
    paths: await import("./paths"),
    profiles: await import("./profiles"),
  };
}

function profilesDirEntries(): string[] {
  const profiles = path.join(dir, "profiles");
  return fs.existsSync(profiles) ? fs.readdirSync(profiles) : [];
}

describe("profile name validation", () => {
  it("accepts a 64-character name and creates the profile", async () => {
    const { paths, profiles } = await fresh();
    const name = "a" + "b".repeat(63); // exactly 64 chars
    expect(name).toHaveLength(64);

    // The single validator lives in paths.ts; profiles.ts delegates to it.
    expect(paths.isValidProfileId(name)).toBe(true);
    expect(profiles.isValidProfileName(name)).toBe(true);

    const summary = profiles.createProfile(name);
    expect(summary.id).toBe(name);
    expect(fs.existsSync(path.join(dir, "profiles", name, "config.yaml"))).toBe(true);
  });

  it("rejects a 65-character name before mkdirSync leaves an orphan directory", async () => {
    const { paths, profiles } = await fresh();
    const name = "a" + "b".repeat(64); // one over the limit
    expect(name).toHaveLength(65);

    expect(paths.isValidProfileId(name)).toBe(false);
    expect(profiles.isValidProfileName(name)).toBe(false);

    expect(() => profiles.createProfile(name)).toThrow(/identifier/);
    // Validation runs before mkdirSync: no directory, no config, no trash entry.
    expect(profilesDirEntries()).toEqual([]);
  });

  it.each([
    ["traversal", ".."],
    ["path segment", "a/b"],
    ["dot", "a.b"],
    ["leading dash", "-abc"],
    ["space", "a b"],
    ["empty", ""],
  ])("rejects %s names without creating a directory", async (_label, name) => {
    const { paths, profiles } = await fresh();
    expect(paths.isValidProfileId(name)).toBe(false);
    expect(profiles.isValidProfileName(name)).toBe(false);
    expect(() => profiles.createProfile(name)).toThrow();
    expect(profilesDirEntries()).toEqual([]);
  });

  it("keeps exactly one name rule: profiles.ts delegates to the paths.ts validator", async () => {
    const { paths, profiles } = await fresh();
    // "default" is a valid id (HERMES_HOME itself) but never a creatable profile name.
    expect(paths.isValidProfileId("default")).toBe(true);
    expect(profiles.isValidProfileName("default")).toBe(false);
    for (const name of ["a", "A-b_9", "z".repeat(64)]) {
      expect(profiles.isValidProfileName(name)).toBe(paths.isValidProfileId(name));
    }
  });
});

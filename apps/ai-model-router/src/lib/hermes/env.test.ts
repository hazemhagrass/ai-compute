import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * env.ts is a plain file editor with no other module dependency, so these
 * tests hit a real temp file rather than mocking fs — the whole point is
 * verifying exact byte-level round-tripping (comments, ordering) survives.
 */
import { envValues, hasAnyEnvKey, readEnvFile, setEnvValue } from "./env";

let dir: string;
let envPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-env-test-"));
  envPath = path.join(dir, ".env");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("readEnvFile / envValues", () => {
  it("returns an empty list for a missing file", () => {
    expect(readEnvFile(envPath)).toEqual([]);
    expect(envValues(envPath)).toEqual({});
  });

  it("parses active and commented keys, ignoring quotes", () => {
    fs.writeFileSync(
      envPath,
      ['# a doc comment', '# OLD_KEY=unused', 'ACTIVE_KEY=plain', 'QUOTED_KEY="has spaces"', ''].join("\n"),
    );
    const values = envValues(envPath);
    expect(values.ACTIVE_KEY).toBe("plain");
    expect(values.QUOTED_KEY).toBe("has spaces");
    expect(values.OLD_KEY).toBeUndefined();
  });

  it("hasAnyEnvKey is true if any candidate name has a value", () => {
    fs.writeFileSync(envPath, "FOO=bar\n");
    expect(hasAnyEnvKey(envPath, ["MISSING", "FOO"])).toBe(true);
    expect(hasAnyEnvKey(envPath, ["MISSING", "ALSO_MISSING"])).toBe(false);
    expect(hasAnyEnvKey(envPath, [])).toBe(false);
  });
});

describe("setEnvValue", () => {
  it("appends a new key to an empty/missing file", () => {
    setEnvValue(envPath, "NEW_KEY", "value1");
    expect(envValues(envPath).NEW_KEY).toBe("value1");
  });

  it("replaces an active line in place, preserving every other line and comment", () => {
    fs.writeFileSync(envPath, ["# doc for FOO", "FOO=old", "BAR=untouched", ""].join("\n"));
    setEnvValue(envPath, "FOO", "new");
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    expect(lines[0]).toBe("# doc for FOO");
    expect(lines[1]).toBe("FOO=new");
    expect(lines[2]).toBe("BAR=untouched");
  });

  it("uncomments a commented key in place instead of appending a duplicate", () => {
    fs.writeFileSync(envPath, ["# Get your key at https://example.com", "# MY_KEY=", ""].join("\n"));
    setEnvValue(envPath, "MY_KEY", "sk-abc");
    const content = fs.readFileSync(envPath, "utf8");
    expect(content).toContain("Get your key at https://example.com");
    expect(content.match(/MY_KEY/g)?.length).toBe(1);
    expect(envValues(envPath).MY_KEY).toBe("sk-abc");
  });

  it("quotes a value containing whitespace", () => {
    setEnvValue(envPath, "SPACED", "has a space");
    expect(fs.readFileSync(envPath, "utf8")).toContain('SPACED="has a space"');
    expect(envValues(envPath).SPACED).toBe("has a space");
  });

  it("deletes the line when value is null", () => {
    fs.writeFileSync(envPath, ["FOO=bar", "BAZ=qux", ""].join("\n"));
    setEnvValue(envPath, "FOO", null);
    expect(envValues(envPath).FOO).toBeUndefined();
    expect(envValues(envPath).BAZ).toBe("qux");
  });

  it("writes the file with 0600 permissions", () => {
    setEnvValue(envPath, "FOO", "bar");
    const mode = fs.statSync(envPath).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

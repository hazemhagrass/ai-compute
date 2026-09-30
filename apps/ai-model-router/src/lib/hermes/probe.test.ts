import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let origHome: string | undefined;
let originalFetch: typeof fetch;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-probe-test-"));
  origHome = process.env.HERMES_HOME;
  process.env.HERMES_HOME = dir;
  originalFetch = global.fetch;
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = origHome;
  fs.rmSync(dir, { recursive: true, force: true });
  global.fetch = originalFetch;
});

async function fresh() {
  vi.resetModules();
  return { probe: await import("./probe") };
}

describe("probeHermesProvider", () => {
  it("reports notTestable for oauth/aws_sdk/vertex auth types without making a network call", async () => {
    const { probe } = await fresh();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await probe.probeHermesProvider("default", "bedrock", {}, "bedrock");
    expect(result.notTestable).toBe(true);
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a clear error when no API key is configured for a key-based provider", async () => {
    const { probe } = await fresh();
    const result = await probe.probeHermesProvider("default", "anthropic", {}, "anthropic");
    expect(result.ok).toBe(false);
    expect(result.notTestable).toBe(false);
    expect(result.error).toMatch(/no API key/i);
  });

  it("returns ok:true with a model count on a successful probe", async () => {
    const { probe } = await fresh();
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "m1" }, { id: "m2" }] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await probe.probeHermesProvider(
      "default",
      "my-custom",
      { api: "http://localhost:11434/v1", api_key: "test-key-value" },
      "custom",
    );
    expect(result.ok).toBe(true);
    expect(result.modelCount).toBe(2);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok:false with a redacted error on a non-2xx response, never leaking the key", async () => {
    const { probe } = await fresh();
    global.fetch = vi.fn(async () => new Response("unauthorized: secret-key-abc123", { status: 401 })) as unknown as typeof fetch;

    const result = await probe.probeHermesProvider(
      "default",
      "my-custom",
      { api: "http://localhost:11434/v1", api_key: "secret-key-abc123" },
      "custom",
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).not.toContain("secret-key-abc123");
  });

  it("returns ok:false with no base URL configured when the entry and catalog both lack one", async () => {
    const { probe } = await fresh();
    const result = await probe.probeHermesProvider("default", "my-custom", { api_key: "x" }, "custom");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no base URL/i);
  });
});

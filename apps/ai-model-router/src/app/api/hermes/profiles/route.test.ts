import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";

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

import DEFAULT_PROFILE_TIER_ROUTER from "@/lib/hermes/default-tier-router.fixture.json";
import CLOUD_BALANCED_TIER_ROUTER from "@/lib/hermes/presets/cloud-balanced.fixture.json";

let dir: string;
const origEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-hermes-create-route-"));
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
    profilesRoute: await import("./route"),
    configIo: await import("@/lib/hermes/config-io"),
    configSchema: await import("@/lib/hermes/config-schema"),
    paths: await import("@/lib/hermes/paths"),
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/hermes/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hermes/profiles with a router source", () => {
  it("creates a profile from default whose tier_router is identical when read back from disk", async () => {
    const h = await fresh();
    h.configIo.writeHermesConfig(
      "default",
      h.configSchema.parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER }),
    );

    const res = await h.profilesRoute.POST(post({ id: "work", from: "default" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.profile.id).toBe("work");

    const { profilePaths } = h.paths;
    const raw = fs.readFileSync(profilePaths("work").configPath, "utf8");
    const written = JSON.parse(JSON.stringify(parseYaml(raw).tier_router));
    expect(written).toEqual(JSON.parse(JSON.stringify(DEFAULT_PROFILE_TIER_ROUTER)));
  });

  it("copies no .env content, provider entries or API keys from the source profile", async () => {
    const h = await fresh();
    h.configIo.writeHermesConfig(
      "default",
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
    fs.writeFileSync(h.paths.profilePaths("default").envPath, "ANTHROPIC_API_KEY=sk-secret-env\n", {
      mode: 0o600,
    });

    const res = await h.profilesRoute.POST(post({ id: "work", from: "default" }));

    expect(res.status).toBe(201);
    const target = h.paths.profilePaths("work");
    expect(fs.readFileSync(target.envPath, "utf8")).toBe("");
    const raw = fs.readFileSync(target.configPath, "utf8");
    expect(raw).not.toContain("sk-secret");
    expect(raw).not.toContain("api_key");
    const written = h.configIo.readHermesConfig("work");
    expect(written.providers).toEqual({});
    expect(written.tier_router?.tiers.normal.pool[0]).toEqual({
      provider: "fixture-provider",
      model: "m",
    });
    // The source keeps its own secrets untouched.
    expect(fs.readFileSync(h.paths.profilePaths("default").envPath, "utf8")).toContain("sk-secret-env");
  });

  it("seeds a new profile from a preset fixture", async () => {
    const h = await fresh();

    const res = await h.profilesRoute.POST(post({ id: "cloud", preset: "cloud-balanced" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    const raw = fs.readFileSync(h.paths.profilePaths("cloud").configPath, "utf8");
    const written = JSON.parse(JSON.stringify(parseYaml(raw).tier_router));
    expect(written).toEqual(JSON.parse(JSON.stringify(CLOUD_BALANCED_TIER_ROUTER)));
    expect(body.profile.tierCount).toBe(4);
  });

  it("rejects from and preset together with 400 and creates nothing", async () => {
    const h = await fresh();
    h.configIo.writeHermesConfig(
      "default",
      h.configSchema.parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER }),
    );

    const res = await h.profilesRoute.POST(post({ id: "work", from: "default", preset: "cloud-balanced" }));

    expect(res.status).toBe(400);
    expect(fs.existsSync(h.paths.profilePaths("work").root)).toBe(false);
  });

  it("rejects an unknown source with 404 and creates nothing", async () => {
    const h = await fresh();

    const res = await h.profilesRoute.POST(post({ id: "work", from: "ghost" }));

    expect(res.status).toBe(404);
    expect(fs.existsSync(h.paths.profilePaths("work").root)).toBe(false);
  });

  it("rejects copying from the profile being created", async () => {
    const h = await fresh();

    const res = await h.profilesRoute.POST(post({ id: "work", from: "work" }));

    expect(res.status).toBe(400);
    expect(fs.existsSync(h.paths.profilePaths("work").root)).toBe(false);
  });

  it("still creates a profile with an empty router when no source is given", async () => {
    const h = await fresh();

    const res = await h.profilesRoute.POST(post({ id: "plain" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    const raw = fs.readFileSync(h.paths.profilePaths("plain").configPath, "utf8");
    const written = parseYaml(raw);
    expect(written.tier_router?.tiers ?? {}).toEqual({});
    expect(body.profile.tierCount).toBe(0);
  });
});

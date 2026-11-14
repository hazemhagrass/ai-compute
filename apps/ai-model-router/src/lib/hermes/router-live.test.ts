import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// Fixture lines mirror the real log formats produced by Hermes's RedactingFormatter
// (verified against live ~/.hermes/logs/agent.log); model and provider names only, no
// secrets. Timestamps are generated relative to "now" so derived cooldown windows land
// in the future deterministically.

let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-router-live-test-"));
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
    readRouterLive: (await import("./router-live")).readRouterLive,
  };
}

const BASE_CONFIG = {
  model: { default: "claude-opus-5", provider: "anthropic" },
  tier_router: {
    enabled: true,
    default_tier: "normal",
    cooldown_s: 120,
    restore_primary: true,
    classifier: { pool: [{ provider: "opencode-go", model: "glm-5.3-flash" }] },
    tiers: {
      normal: {
        mode: "priority",
        escalate_to: null,
        pool: [{ provider: "anthropic", model: "claude-sonnet-5" }],
        fallback: [],
      },
    },
  },
};

function writeConfig(profileRoot: string, config: Record<string, unknown>): void {
  fs.mkdirSync(profileRoot, { recursive: true });
  fs.writeFileSync(path.join(profileRoot, "config.yaml"), YAML.stringify(config), "utf8");
}

function logTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMilliseconds(), 3)}`
  );
}

function tierLine(ts: string, level: string, tag: string | null, message: string): string {
  return tag === null
    ? `${ts} ${level}  agent.tier_router: ${message}`
    : `${ts} ${level} [${tag}] agent.tier_router: ${message}`;
}

function writeLogs(profileRoot: string, files: Record<string, string[]>): void {
  const logsDir = path.join(profileRoot, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  for (const [name, lines] of Object.entries(files)) {
    fs.writeFileSync(path.join(logsDir, name), lines.join("\n") + "\n", "utf8");
  }
}

function writeStateFile(profileRoot: string, state: unknown): void {
  fs.mkdirSync(path.join(profileRoot, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(profileRoot, "state", "tier-router.json"),
    JSON.stringify(state),
    "utf8",
  );
}

function writeGatewayState(profileRoot: string, running: boolean, pid?: number): void {
  fs.writeFileSync(
    path.join(profileRoot, "gateway_state.json"),
    JSON.stringify(running ? { gateway_state: "running", pid: pid ?? 1 } : { gateway_state: "stopped" }),
    "utf8",
  );
}

type ReadSyncCall = [number, Buffer, number, number, number];

function readSyncCalls(spy: MockInstance): ReadSyncCall[] {
  return spy.mock.calls as unknown as ReadSyncCall[];
}

function bytesFromReadSync(spy: MockInstance): number {
  return spy.mock.results.reduce((sum, r) => sum + (r.value as number), 0);
}

interface RouterLiveJson {
  profile: string;
  source: "state" | "logs" | "none";
  generated_at: string;
  state_stale?: boolean;
  cooldowns: {
    provider: string;
    model: string;
    base_url?: string;
    scope: string;
    expires_at: string;
    approx: boolean;
  }[];
  decisions: {
    at: string;
    tier_requested: string;
    tier_used: string;
    source: string;
    model?: string;
    provider?: string;
    switched?: boolean;
  }[];
  restore: {
    enabled: boolean;
    last_event?: "restored" | "deferred";
    last_model?: string;
    last_provider?: string;
    last_at?: string;
    pending_capture?: boolean;
  };
  warnings: string[];
}

describe("readRouterLive", () => {
  it("returns source none with a warning when the tier router is disabled", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, { model: BASE_CONFIG.model, tier_router: { ...BASE_CONFIG.tier_router, enabled: false } });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.source).toBe("none");
    expect(live.decisions).toEqual([]);
    expect(live.cooldowns).toEqual([]);
    expect(live.restore.enabled).toBe(false);
    expect(live.warnings.join(" ")).toContain("disabled");
  });

  it("derives decisions, restore status, and approximate cooldowns from log lines", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const t1 = Date.now() - 400_000;
    const t2 = Date.now() - 300_000;
    const t3 = Date.now() - 200_000;
    const t4 = Date.now() - 60_000; // classifier arm: expiry = t4 + 1800s
    const t5 = Date.now() - 30_000; // deferred restore
    const t6 = Date.now() - 10_000; // later successful restore wins
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(t1), "INFO", "20261108_234240_090d2a", "tier_router: normal→normal (classifier:coding/medium) -> claude-sonnet-5 via anthropic"),
        "",
        tierLine(logTimestamp(t2), "INFO", null, "tier_router: trivial→trivial (classifier:research/easy) -> iceman-contributor-free via opencode-go"),
        tierLine(logTimestamp(t3), "INFO", "20261001_131356_cb78d9", "tier_router: restored primary claude-opus-5-5 via anthropic (router re-decides fresh next turn)"),
        tierLine(logTimestamp(t4), "INFO", "20261001_131356_cb78d9", "tier_router: classifier glm-5.3-flash failed: Request timed out."),
        tierLine(logTimestamp(t5), "INFO", "20261001_131356_cb78d9", "tier_router: primary restore deferred (provider unavailable); capture kept, will retry"),
        tierLine(logTimestamp(t6), "INFO", "20261001_131356_cb78d9", "tier_router: restored primary claude-opus-5-5 via anthropic (router re-decides fresh next turn)"),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.source).toBe("logs");
    expect(live.state_stale).toBeUndefined();

    expect(live.decisions).toHaveLength(2);
    // Newest decision first.
    expect(live.decisions[0]).toEqual({
      at: new Date(t2).toISOString(),
      tier_requested: "trivial",
      tier_used: "trivial",
      source: "classifier:research/easy",
      model: "iceman-contributor-free",
      provider: "opencode-go",
      switched: true,
    });
    expect(live.decisions[1].at).toBe(new Date(t1).toISOString());
    expect(live.decisions[1].tier_requested).toBe("normal");
    expect(live.decisions[1].source).toBe("classifier:coding/medium");

    expect(live.restore).toEqual({
      enabled: true,
      last_event: "restored",
      last_model: "claude-opus-5-5",
      last_provider: "anthropic",
      last_at: new Date(t6).toISOString(),
    });

    // The classifier failure arms an approximate cooldown for the configured pool entry.
    expect(live.cooldowns).toHaveLength(1);
    const cooldown = live.cooldowns[0];
    expect(cooldown.model).toBe("glm-5.3-flash");
    expect(cooldown.provider).toBe("opencode-go");
    expect(cooldown.scope).toBe("classifier");
    expect(cooldown.approx).toBe(true);
    const expectedExpiry = t4 + 1800_000; // max(failure baseline 1800, cooldown_s 120)
    expect(Math.abs(new Date(cooldown.expires_at).getTime() - expectedExpiry)).toBeLessThan(2000);

    expect(live.warnings.join(" ")).toContain("approximat");
  });

  it("flags a pending capture when the latest restore event is deferred", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const deferredAt = Date.now() - 20_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(Date.now() - 60_000), "INFO", "sess", "tier_router: restored primary claude-opus-5-5 via anthropic (router re-decides fresh next turn)"),
        tierLine(logTimestamp(deferredAt), "WARNING", "sess", "tier_router: primary restore deferred (rate limited); capture kept, will retry"),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.restore.last_event).toBe("deferred");
    expect(live.restore.last_at).toBe(new Date(deferredAt).toISOString());
    expect(live.restore.pending_capture).toBe(true);
  });

  it("ignores noisy and foreign log lines", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    writeLogs(dir, {
      "agent.log": [
        "this is not a log line",
        "2026-11-13 15:18:07,183 INFO [20261108_234240_090d2a] agent.agent: turn complete",
        "2026-11-13 15:18:08,000 INFO [20261108_234240_090d2a] agent.other: tier_router: normal→normal (spoofed) -> bad via provider",
        `${logTimestamp(Date.now() - 60_000)} INFO [sess] agent.tier_router: classifier budget exhausted; using default tier 'plan'`,
        `${logTimestamp(Date.now() - 50_000)} INFO [sess] agent.tier_router: tier_router: normal→normal (default) -> claude-sonnet-5 via anthropic`,
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    // The spoofed line carries a different logger; the budget line is not a decision line.
    expect(live.decisions).toHaveLength(1);
    expect(live.decisions[0].source).toBe("default");
    expect(live.cooldowns).toHaveLength(0);
  });

  it("scans past dense non-router noise to reach sparse router lines", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    // Mirrors the live install: thousands of unrelated lines accumulate between router
    // decisions, so a fixed small tail would miss them; the adaptive scan must grow.
    const noise: string[] = [];
    const old = Date.now() - 400_000;
    const recent = Date.now() - 10_000;
    for (let i = 0; i < 3000; i++) {
      noise.push(
        `${logTimestamp(old + i)} INFO [sess] agent.agent: turn ${i} completed with usage stats`,
      );
    }
    writeLogs(dir, {
      "agent.log": [
        ...noise,
        tierLine(logTimestamp(recent), "INFO", "sess", "tier_router: normal→normal (default) -> claude-sonnet-5 via anthropic"),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.decisions).toHaveLength(1);
    expect(live.decisions[0].at).toBe(new Date(recent).toISOString());
    expect(live.decisions[0].tier_used).toBe("normal");
  });

  it("reads across rotation boundaries from oldest to newest", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const old = Date.now() - 400_000;
    const recent = Date.now() - 100_000;
    writeLogs(dir, {
      "agent.log.3": [
        tierLine(logTimestamp(old), "INFO", "sess", "tier_router: plan→plan (default) -> claude-opus-5-5 via anthropic"),
      ],
      "agent.log": [
        tierLine(logTimestamp(recent), "INFO", "sess", "tier_router: test→test (classifier:test/medium) -> mimo-v2.6-pro via opencode-go"),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.decisions).toHaveLength(2);
    expect(live.decisions[0].at).toBe(new Date(recent).toISOString());
    expect(live.decisions[0].tier_requested).toBe("test");
    expect(live.decisions[1].at).toBe(new Date(old).toISOString());
    expect(live.decisions[1].tier_requested).toBe("plan");
  });

  it("prefers a fresh valid state file over logs", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const t = Date.now() - 30_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(t), "INFO", "sess", "tier_router: normal→normal (classifier:coding/medium) -> claude-sonnet-5 via anthropic"),
      ],
    });
    writeGatewayState(dir, true, 4242);
    const cooldownExpiry = new Date(Date.now() + 900_000).toISOString();
    writeStateFile(dir, {
      schema: 1,
      generated_at: new Date().toISOString(),
      pid: 4242,
      balancer: {
        coolings: [
          {
            provider: "anthropic",
            model: "claude-sonnet-5",
            scope: "pool:normal",
            expires_at: cooldownExpiry,
          },
        ],
      },
      last_decision: {
        at: new Date(t).toISOString(),
        tier_requested: "normal",
        tier_used: "normal",
        source: "classifier:coding/medium",
        model: "claude-sonnet-5",
        provider: "anthropic",
        switched: true,
      },
      decisions: [
        {
          at: new Date(t - 1000).toISOString(),
          tier_requested: "plan",
          tier_used: "plan",
          source: "default",
          model: "claude-opus-5-5",
          provider: "anthropic",
          switched: true,
        },
      ],
      restore: {
        enabled: true,
        last_event: "restored",
        last_model: "claude-opus-5-5",
        last_provider: "anthropic",
        last_at: new Date(t - 2000).toISOString(),
        pending_capture: false,
      },
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.source).toBe("state");
    expect(live.state_stale).toBeUndefined();
    expect(live.decisions).toHaveLength(2);
    expect(live.decisions[0].tier_requested).toBe("normal"); // last_decision is newest
    expect(live.decisions[1].tier_requested).toBe("plan");
    expect(live.cooldowns).toHaveLength(1);
    expect(live.cooldowns[0].approx).toBe(false);
    expect(live.cooldowns[0].scope).toBe("pool:normal");
    expect(live.cooldowns[0].expires_at).toBe(cooldownExpiry);
    expect(live.restore.enabled).toBe(true);
    expect(live.restore.last_event).toBe("restored");
  });

  it.each([
    ["gateway pid differs from the writer pid", 999 as number | undefined],
    ["gateway not running", undefined],
  ])("falls back to logs when the state file is stale: %s", async (_label, gwPid) => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const t = Date.now() - 30_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(t), "INFO", "sess", "tier_router: plan→plan (default) -> claude-opus-5-5 via anthropic"),
      ],
    });
    writeGatewayState(dir, gwPid !== undefined, gwPid);
    writeStateFile(dir, {
      schema: 1,
      generated_at: new Date().toISOString(),
      pid: 4242,
      balancer: {
        coolings: [
          {
            provider: "anthropic",
            model: "claude-sonnet-5",
            scope: "pool:normal",
            expires_at: new Date(Date.now() + 900_000).toISOString(),
          },
        ],
      },
      decisions: [
        {
          at: new Date(t).toISOString(),
          tier_requested: "router-only-decision",
          tier_used: "router-only-decision",
          source: "default",
          model: "x",
          provider: "y",
          switched: true,
        },
      ],
      restore: { enabled: true, last_event: "restored", last_model: "x", last_provider: "y" },
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.source).toBe("logs");
    expect(live.state_stale).toBe(true);
    expect(live.warnings.join(" ")).toContain("stale");
    expect(live.decisions).toHaveLength(1);
    expect(live.decisions[0].tier_requested).toBe("plan"); // from logs, not the state file
    expect(live.cooldowns).toHaveLength(0); // state-file-only cooling is not shown as current
  });

  it("marks the state file stale when gateway_state.json is absent", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);
    writeStateFile(dir, {
      schema: 1,
      generated_at: new Date().toISOString(),
      pid: 4242,
      balancer: { coolings: [{ provider: "a", model: "m", scope: "s", expires_at: new Date(Date.now() + 60_000).toISOString() }] },
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.state_stale).toBe(true);
    expect(live.source).toBe("logs");
  });

  it("falls back to logs when the state file is invalid", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);
    const t = Date.now() - 30_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(t), "INFO", "sess", "tier_router: plan→plan (default) -> claude-opus-5-5 via anthropic"),
      ],
    });
    writeGatewayState(dir, true, 4242);
    fs.mkdirSync(path.join(dir, "state"), { recursive: true });
    fs.writeFileSync(path.join(dir, "state", "tier-router.json"), "{not json", "utf8");

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.source).toBe("logs");
    expect(live.warnings.join(" ")).toContain("could not be read");
    expect(live.decisions).toHaveLength(1);
  });

  it("uses max routing.failure_cooldown_seconds and tier_router.cooldown_s for derived windows", async () => {
    const { readRouterLive } = await fresh();
    // Config override 90 beats cooldown_s 60; the default baseline 1800 would win without it.
    writeConfig(dir, {
      ...BASE_CONFIG,
      routing: { failure_cooldown_seconds: 90 },
      tier_router: { ...BASE_CONFIG.tier_router, cooldown_s: 60 },
    });

    const armAt = Date.now() - 20_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(armAt), "INFO", "sess", "tier_router: classifier glm-5.3-flash failed: Request timed out."),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.cooldowns).toHaveLength(1);
    const expected = armAt + 90_000;
    expect(Math.abs(new Date(live.cooldowns[0].expires_at).getTime() - expected)).toBeLessThan(2000);
  });

  it("filters derived cooldowns whose approximate expiry has already passed", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const armAt = Date.now() - 2_000_000;
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(armAt), "INFO", "sess", "tier_router: classifier glm-5.3-flash failed: Request timed out."),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.cooldowns).toHaveLength(0);
  });

  it("keeps the ten most recent decisions", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const lines: string[] = [];
    for (let i = 14; i >= 0; i--) {
      const ts = logTimestamp(Date.now() - i * 1000);
      lines.push(tierLine(ts, "INFO", "sess", `tier_router: tier${i}→tier${i} (default) -> m${i} via p${i}`));
    }
    writeLogs(dir, { "agent.log": lines });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.decisions).toHaveLength(10);
    expect(live.decisions[0].tier_requested).toBe("tier0"); // newest
    expect(live.decisions[9].tier_requested).toBe("tier9"); // tenth newest
  });

  it("resolves a named profile under profiles/<name>", async () => {
    const { readRouterLive, paths } = await fresh();
    const config = { ...BASE_CONFIG, model: BASE_CONFIG.model };
    writeConfig(path.join(dir, "profiles", "work"), config);
    const t = Date.now() - 30_000;
    writeLogs(path.join(dir, "profiles", "work"), {
      "agent.log": [
        tierLine(logTimestamp(t), "INFO", "sess", "tier_router: normal→normal (classifier:coding/medium) -> claude-sonnet-5 via anthropic"),
      ],
    });

    expect(paths).toBeDefined();
    const live = readRouterLive("work") as RouterLiveJson;

    expect(live.profile).toBe("work");
    expect(live.source).toBe("logs");
    expect(live.decisions).toHaveLength(1);
  });

  it("drops tier-router lines whose timestamp does not parse", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    writeLogs(dir, {
      "agent.log": [
        // Log-shaped line with a garbage timestamp: parseLogTimestamp returns null and the
        // line must be dropped, not surfaced with an invalid date.
        "9999-99-99 99:99:99,999 INFO [sess] agent.tier_router: tier_router: ghost→ghost (default) -> ghost-model via ghost-provider",
        tierLine(logTimestamp(Date.now() - 30_000), "INFO", "sess", "tier_router: normal→normal (default) -> claude-sonnet-5 via anthropic"),
      ],
    });

    const live = readRouterLive("default") as RouterLiveJson;

    expect(live.decisions).toHaveLength(1);
    expect(live.decisions[0].model).toBe("claude-sonnet-5");
  });

  it("reads at most the scan cap per file in total, across disjoint windows", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    // Pure noise, no decisions anywhere: the scan grows to the cap and must stop there.
    const noise: string[] = [];
    for (let i = 0; i < 24_000; i++) {
      noise.push(
        `${logTimestamp(Date.now() - 3_600_000 + i)} INFO [sess] agent.agent: turn ${i} completed with usage stats`,
      );
    }
    writeLogs(dir, { "agent.log": noise });
    const fileSize = fs.statSync(path.join(dir, "logs", "agent.log")).size;
    expect(fileSize).toBeGreaterThan(256 * 1024); // file is larger than the injected cap

    const spy = vi.spyOn(fs, "readSync");
    try {
      readRouterLive("default", undefined, {
        chunkBaseBytes: 64 * 1024,
        maxScanBytesPerFile: 256 * 1024,
      });

      const totalBytes = bytesFromReadSync(spy);
      expect(totalBytes).toBeGreaterThan(0);
      expect(totalBytes).toBeLessThanOrEqual(256 * 1024);

      // Windows are disjoint: no byte of the file is ever read twice (the growth loop reads
      // only the not-yet-scanned region, so the sum cannot approach 2x the file size).
      const ranges = readSyncCalls(spy)
        .map(([, , length, position]) => ({ start: position, end: position + length }))
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].start).toBeGreaterThanOrEqual(ranges[i - 1].end);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("serves an unchanged log file from the scan cache and reads 0 bytes on the next poll", async () => {
    const { readRouterLive } = await fresh();
    writeConfig(dir, BASE_CONFIG);

    const logFile = path.join(dir, "logs", "agent.log");
    writeLogs(dir, {
      "agent.log": [
        tierLine(logTimestamp(Date.now() - 30_000), "INFO", "sess", "tier_router: normal→normal (default) -> claude-sonnet-5 via anthropic"),
      ],
    });

    const spy = vi.spyOn(fs, "readSync");
    try {
      const first = readRouterLive("default") as RouterLiveJson;
      expect(first.decisions).toHaveLength(1);
      expect(bytesFromReadSync(spy)).toBeGreaterThan(0);

      // Same path, size, and mtimeMs: the cached scan is served without touching the file.
      spy.mockClear();
      const second = readRouterLive("default") as RouterLiveJson;
      expect(second.decisions).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(0);
      expect(bytesFromReadSync(spy)).toBe(0);

      // Appending changes size+mtimeMs and must invalidate the cached entry.
      fs.appendFileSync(
        logFile,
        tierLine(logTimestamp(Date.now() - 10_000), "INFO", "sess", "tier_router: plan→plan (default) -> claude-opus-5-5 via anthropic") + "\n",
        "utf8",
      );
      const third = readRouterLive("default") as RouterLiveJson;
      expect(third.decisions).toHaveLength(2);
      expect(bytesFromReadSync(spy)).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });
});

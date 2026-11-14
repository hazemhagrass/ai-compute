import fs from "node:fs";
import path from "node:path";

import { readHermesConfig } from "./config-io";
import type { HermesConfig } from "./config-schema";
import { HERMES_HOME, profilePaths } from "./paths";
import {
  cooldownEntrySchema,
  restoreSchema,
  routerLiveSchema,
  tierRouterStateSchema,
  type CooldownEntry,
  type RouterDecision,
  type RouterLive,
  type RouterRestore,
  type TierRouterStateFile,
} from "./router-live-schema";
import { z } from "zod";

// Fallback source: the profile's agent.log{,.1,.2,.3}, written by Hermes's module logger
// agent.tier_router through RedactingFormatter. Log lines carry no secrets (model and
// provider names and session tags only).

const DECISIONS_KEEP = 10;
// newest-first adaptive scan constants: router lines are sparse in busy logs (verified on
// the live install: the newest agent.tier_router line sat ~45k lines above the tail of a
// 164k-line agent.log), so scanning a fixed small tail shows nothing. Start small and grow
// with a hard per-file cap; stop as soon as enough decisions are in hand.
const SCAN_CHUNK_BASE_BYTES = 256 * 1024;
const MAX_SCAN_BYTES_PER_FILE = 32 * 1024 * 1024;
const MAX_FUTURE_SKEW_MS = 120_000;

// Mirrors agent/failure_cooldown.py: DEFAULT_FAILURE_COOLDOWN_SECONDS. Every cooldown arm
// is floored by this baseline (or by routing.failure_cooldown_seconds when configured);
// the tier_router.cooldown_s value only matters when it is larger.
const DEFAULT_FAILURE_COOLDOWN_SECONDS = 1800;

const LOG_LINE_RE =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) (\w+)(?: \[([^\]]*)\]| ) ?agent\.tier_router: (.*)$/;
const DECISION_RE =
  /^tier_router: (\S+)→(\S+)\s*\(([^)]+)\)\s*->\s*(\S+) via (\S+)/;
const RESTORED_RE = /^tier_router: restored primary (\S+) via (\S+)/;
const DEFERRED_RE = /^tier_router: primary restore deferred \(([^)]*)\)/;
const CLASSIFIER_FAILURE_RE = /^tier_router: classifier (\S+) failed:/;

const failureCooldownConfigSchema = z.object({
  failure_cooldown_seconds: z.number().finite().positive(),
});

type StateFileResult =
  | { kind: "absent" }
  | { kind: "ok"; data: TierRouterStateFile }
  | { kind: "invalid"; reason: string };

interface LogEvent {
  at: Date;
  message: string;
}

function parseLogTimestamp(raw: string): Date | null {
  // "2026-11-13 15:18:07,183" -> "2026-11-13T15:18:07.183" (no zone -> writer's local time)
  const date = new Date(raw.replace(" ", "T").replace(",", "."));
  return Number.isNaN(date.getTime()) ? null : date;
}

function failureCooldownSeconds(config: HermesConfig): number {
  // HermesConfig is passthrough; the routing key is not part of the typed schema.
  const routing = (config as { routing?: unknown }).routing;
  const parsed = failureCooldownConfigSchema.safeParse(routing);
  return parsed.success ? parsed.data.failure_cooldown_seconds : DEFAULT_FAILURE_COOLDOWN_SECONDS;
}

// PoolBalancer.report_failure arms a cooldown for max(min_cooldown_s, cooldown_s), where
// min_cooldown_s defaults to the generic-failure baseline. retry_after (Retry-After from
// a provider) can extend it but is not logged, hence approx.
function cooldownWindowSeconds(config: HermesConfig): number {
  return Math.max(failureCooldownSeconds(config), config.tier_router?.cooldown_s ?? 120);
}

// The classifier failure log line names the model only; resolve the provider from the
// configured classifier pool so the UI can show a full entry key.
function classifierProviderFor(config: HermesConfig, model: string): string {
  const hit = (config.tier_router?.classifier?.pool ?? []).find((e) => e.model === model);
  return hit?.provider ?? "";
}

function readGatewayState(roots: string[]): { running: boolean; pid: number | null } {
  for (const root of roots) {
    try {
      const file = path.join(root, "gateway_state.json");
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
        gateway_state?: unknown;
        pid?: unknown;
      };
      if (raw.gateway_state === "running") {
        return { running: true, pid: typeof raw.pid === "number" ? raw.pid : null };
      }
      // Present and explicitly not running (stopped/crashed): the gateway is down.
      return { running: false, pid: null };
    } catch {
      // Unreadable or malformed: try the next candidate root.
    }
  }
  return { running: false, pid: null };
}

function stateIsFresh(state: TierRouterStateFile, profileRoot: string): boolean {
  const generated = new Date(state.generated_at);
  if (Number.isNaN(generated.getTime())) return false;
  if (generated.getTime() - Date.now() > MAX_FUTURE_SKEW_MS) return false;
  const gateway = readGatewayState([profileRoot, HERMES_HOME]);
  if (!gateway.running) return false;
  if (
    state.pid !== undefined &&
    gateway.pid !== null &&
    state.pid !== gateway.pid
  ) {
    // The file was written by a process that is no longer the running gateway.
    return false;
  }
  return true;
}

function readTierRouterStateFile(statePath: string): StateFileResult {
  let raw: string;
  try {
    if (!fs.existsSync(statePath)) return { kind: "absent" };
    raw = fs.readFileSync(statePath, "utf8");
  } catch (err) {
    return { kind: "invalid", reason: err instanceof Error ? err.message : "unreadable" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { kind: "invalid", reason: err instanceof Error ? err.message : "invalid JSON" };
  }
  const result = tierRouterStateSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { kind: "invalid", reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "schema mismatch" };
  }
  return { kind: "ok", data: result.data };
}

function decisionKey(d: RouterDecision): string {
  return [d.at, d.tier_requested, d.tier_used, d.source, d.model ?? "", d.provider ?? ""].join("|");
}

function mergeDecisions(candidates: RouterDecision[], cap: number): RouterDecision[] {
  const seen = new Set<string>();
  const unique: RouterDecision[] = [];
  for (const d of candidates) {
    const key = decisionKey(d);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }
  return unique.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, cap);
}

function buildLiveFromState(
  profileId: string,
  state: TierRouterStateFile,
  config: HermesConfig,
): RouterLive {
  const now = Date.now();

  const cooldowns: CooldownEntry[] = state.balancer.coolings
    .map((c) => cooldownEntrySchema.parse({ ...c, approx: false }))
    .filter((c) => {
      const expires = new Date(c.expires_at).getTime();
      return Number.isFinite(expires) && expires > now;
    });

  const decisions = mergeDecisions(
    [state.last_decision, ...state.decisions].filter((d): d is RouterDecision => Boolean(d)),
    DECISIONS_KEEP,
  );

  const restore = restoreSchema.parse({
    ...(state.restore ?? {}),
    enabled: config.tier_router?.restore_primary === true,
  });

  return routerLiveSchema.parse({
    profile: profileId,
    source: "state",
    generated_at: state.generated_at,
    cooldowns,
    decisions,
    restore,
    warnings: [],
  });
}

function readChunkEventsWindow(
  filePath: string,
  start: number,
  end: number,
): { events: LogEvent[]; reachedStart: boolean } {
  try {
    if (!fs.existsSync(filePath)) return { events: [], reachedStart: true };
    const size = fs.statSync(filePath).size;
    if (size === 0) return { events: [], reachedStart: true };
    const s = Math.max(0, Math.min(size, start));
    const e = Math.max(s, Math.min(size, end));
    const chunk = e - s;
    if (chunk <= 0) return { events: [], reachedStart: s === 0 };
    const buf = Buffer.alloc(chunk);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, buf, 0, chunk, s);
    } finally {
      fs.closeSync(fd);
    }
    const reachedStart = s === 0;
    const lines = buf.toString("utf8").split("\n");
    if (!reachedStart) lines.shift(); // first chunk line may be partial; drop it
    const events: LogEvent[] = [];
    for (const line of lines) {
      const match = LOG_LINE_RE.exec(line);
      if (!match) continue;
      const at = parseLogTimestamp(match[1]);
      if (!at) continue;
      events.push({ at, message: match[4] });
    }
    return { events, reachedStart };
  } catch {
    return { events: [], reachedStart: true };
  }
}

function collectTierRouterEvents(root: string): LogEvent[] {
  const files = ["agent.log", "agent.log.1", "agent.log.2", "agent.log.3"].map((name) =>
    path.join(root, "logs", name),
  );
  const all: LogEvent[] = [];
  for (const file of files) {
    let fileEvents: LogEvent[] = [];
    let end: number;
    try {
      end = fs.existsSync(file) ? fs.statSync(file).size : 0;
    } catch {
      end = 0;
    }
    if (end === 0) continue;
    let chunkSize = SCAN_CHUNK_BASE_BYTES;
    let totalRead = 0;
    let reachedStart = false;
    while (!reachedStart && totalRead < MAX_SCAN_BYTES_PER_FILE) {
      const size = Math.min(chunkSize, MAX_SCAN_BYTES_PER_FILE - totalRead);
      const start = Math.max(0, end - size);
      const res = readChunkEventsWindow(file, start, end);
      fileEvents = [...res.events, ...fileEvents];
      totalRead += end - start;
      reachedStart = res.reachedStart || start === 0;
      if (countDecisions(all) + countDecisions(fileEvents) >= DECISIONS_KEEP) break;
      if (reachedStart) break;
      end = start;
      chunkSize = Math.min(MAX_SCAN_BYTES_PER_FILE, chunkSize * 4);
    }
    all.push(...fileEvents);
    if (countDecisions(all) >= DECISIONS_KEEP) break;
  }
  return all.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function countDecisions(events: LogEvent[]): number {
  let count = 0;
  for (const event of events) {
    if (DECISION_RE.test(event.message)) count++;
  }
  return count;
}

function deriveLiveFromLogs(profileId: string, root: string, config: HermesConfig): RouterLive {
  const now = Date.now();
  const enabled = config.tier_router?.restore_primary === true;
  let restore: RouterRestore = restoreSchema.parse({ enabled });
  const decisions: RouterDecision[] = [];
  const arms = new Map<string, { entry: CooldownEntry; at: number }>();
  const window = cooldownWindowSeconds(config);

  for (const event of collectTierRouterEvents(root)) {
    const decision = DECISION_RE.exec(event.message);
    if (decision) {
      decisions.push({
        at: event.at.toISOString(),
        tier_requested: decision[1],
        tier_used: decision[2],
        source: decision[3],
        model: decision[4],
        provider: decision[5],
        switched: true,
      });
      continue;
    }
    const restored = RESTORED_RE.exec(event.message);
    if (restored) {
      restore = restoreSchema.parse({
        enabled,
        last_event: "restored",
        last_model: restored[1],
        last_provider: restored[2],
        last_at: event.at.toISOString(),
      });
      continue;
    }
    const deferred = DEFERRED_RE.exec(event.message);
    if (deferred) {
      // The capture is kept after a deferred restore (tier_router.py logs "capture kept,
      // will retry"), so pending_capture stays true until a later restored event.
      restore = restoreSchema.parse({
        enabled,
        last_event: "deferred",
        last_at: event.at.toISOString(),
        pending_capture: true,
      });
      continue;
    }
    const failure = CLASSIFIER_FAILURE_RE.exec(event.message);
    if (failure) {
      const model = failure[1];
      const provider = classifierProviderFor(config, model);
      const expires = event.at.getTime() + window * 1000;
      arms.set(
        `${provider}|${model}`,
        {
          entry: {
            provider,
            model,
            scope: "classifier",
            expires_at: new Date(expires).toISOString(),
            approx: true,
          },
          at: event.at.getTime(),
        },
      );
    }
  }

  const cooldowns = Array.from(arms.values())
    .filter(({ entry }) => new Date(entry.expires_at).getTime() > now)
    .sort((a, b) => b.at - a.at)
    .map(({ entry }) => entry);

  const keptDecisions = decisions.slice(-DECISIONS_KEEP).reverse();

  const warnings: string[] = [
    "Cooldown windows are approximations derived from logged classifier-pool failures; cooldown arming is not logged, so other pool failures and any Retry-After extensions are invisible here.",
  ];
  if (decisions.length === 0 && restore.last_event === undefined && cooldowns.length === 0) {
    warnings.unshift("No tier-router activity found in this profile's agent.log rotations");
  }

  return {
    profile: profileId,
    source: "logs",
    generated_at: new Date(now).toISOString(),
    cooldowns,
    decisions: keptDecisions,
    restore,
    warnings,
  };
}

export function readRouterLive(profileId: string, cfg?: HermesConfig): RouterLive {
  const config = cfg ?? readHermesConfig(profileId);
  const { root } = profilePaths(profileId);
  const generatedAt = new Date().toISOString();

  if (!config.tier_router?.enabled) {
    return routerLiveSchema.parse({
      profile: profileId,
      source: "none",
      generated_at: generatedAt,
      restore: { enabled: false },
      warnings: ["Tier router is disabled in this profile's config"],
    });
  }

  const stateResult = readTierRouterStateFile(path.join(root, "state", "tier-router.json"));
  if (stateResult.kind === "ok" && stateIsFresh(stateResult.data, root)) {
    return buildLiveFromState(profileId, stateResult.data, config);
  }

  const warnings: string[] = [];
  if (stateResult.kind === "ok") {
    warnings.push(
      "State file state/tier-router.json is present but stale (gateway not running, or written by another process); showing log-derived data",
    );
  } else if (stateResult.kind === "invalid") {
    warnings.push(`State file state/tier-router.json could not be read (${stateResult.reason}); showing log-derived data`);
  }

  const live = deriveLiveFromLogs(profileId, root, config);
  return routerLiveSchema.parse({
    ...live,
    warnings: [...warnings, ...live.warnings],
    ...(stateResult.kind === "ok" ? { state_stale: true } : {}),
  });
}

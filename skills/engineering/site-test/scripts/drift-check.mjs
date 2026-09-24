#!/usr/bin/env node
// Drift check: compare this run's results against the site and the last run.
//
// Fails the build (exit 1) when any of these is true:
//   - a route in the sitemap has no scenario touching it
//   - a role appears in the auth event stream that is not in the config
//   - a scenario passed with a fallback selector match (false green)
//   - a control was clicked in the recorded trace that no scenario clicks
//
// Usage:
//   node drift-check.mjs <outDir> [--config=<path>] [--last=<previousResultsJson>]
//
// Inputs it expects in <outDir>:
//   crawl-report.json    from crawl.mjs
//   scenarios.json       from scenarios.mjs (roles, results, observed selectors)
//   auth-events.json     optional, roles observed at sign-in time
//   click-trace.json     optional, controls clicked during runs
//
// Output: <outDir>/drift.json and a printed report.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=") || "1"];
    }),
);
const [outDir] = positional;
if (!outDir) {
  console.error("Usage: node drift-check.mjs <outDir> [--config=<path>] [--last=<path>]");
  process.exit(2);
}

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

const config = flags.config ? readJson(flags.config) : { known_routes: [], excluded_routes: [], roles: ["guest"], scenarios: [] };
const crawl = readJson(join(outDir, "crawl-report.json")) ?? { pages: [] };
const scenarios = readJson(join(outDir, "scenarios.json")) ?? { results: [] };
const authEvents = readJson(join(outDir, "auth-events.json")) ?? { roles: [] };
const clickTrace = readJson(join(outDir, "click-trace.json")) ?? { clicks: [] };
const last = flags.last ? readJson(flags.last) : null;

const findings = [];

// -- 1. Uncovered routes -----------------------------------------------------

const excluded = new Set(config.excluded_routes ?? []);
const routesInCrawl = new Set(crawl.pages.map((p) => p.path));
const routesTouched = new Set(
  scenarios.results.flatMap((r) => r.routesTouched ?? [r.route].filter(Boolean)),
);
for (const path of routesInCrawl) {
  if (excluded.has(path)) continue;
  if (path.startsWith("/__does-not-exist-")) continue;
  if (!routesTouched.has(path)) {
    findings.push({
      kind: "uncovered-route",
      route: path,
      reason: "route is served by the site but no scenario touches it",
    });
  }
}

// -- 2. Unknown roles --------------------------------------------------------

const knownRoles = new Set(config.roles ?? ["guest"]);
for (const role of authEvents.roles ?? []) {
  if (!knownRoles.has(role)) {
    findings.push({
      kind: "unknown-role",
      role,
      reason: "role observed at runtime is not listed in site-test.config.json",
    });
  }
}

// -- 3. False greens ---------------------------------------------------------

for (const result of scenarios.results ?? []) {
  if (result.status !== "pass") continue;
  for (const assertion of result.assertions ?? []) {
    if (
      assertion.matchedFallback &&
      assertion.matchedFallback !== assertion.selector
    ) {
      findings.push({
        kind: "false-green",
        scenario: result.name,
        expected: assertion.selector,
        matched: assertion.matchedFallback,
        reason: "assertion matched a fallback selector, not the one it named",
      });
    }
  }
}

// -- 4. Uncovered click paths -----------------------------------------------

const clickedSelectors = new Set(
  scenarios.results.flatMap((r) => r.assertions?.map((a) => a.selector) ?? []),
);
for (const click of clickTrace.clicks ?? []) {
  if (!clickedSelectors.has(click.selector)) {
    findings.push({
      kind: "coverage-gap",
      selector: click.selector,
      route: click.route,
      reason: "control was interacted with at runtime but no scenario asserts on it",
    });
  }
}

// -- 5. Regressions against last run ----------------------------------------

if (last) {
  const lastPass = new Map(
    (last.results ?? [])
      .filter((r) => r.status === "pass")
      .map((r) => [r.name, r]),
  );
  for (const now of scenarios.results ?? []) {
    if (now.status !== "pass" && lastPass.has(now.name)) {
      findings.push({
        kind: "regression",
        scenario: now.name,
        reason: `scenario passed in the last run and does not now: ${now.status}`,
      });
    }
  }
}

// -- Write drift report -----------------------------------------------------

const drift = {
  outDir,
  startedAt: new Date().toISOString(),
  counts: findings.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {}),
  findings,
};
writeFileSync(join(outDir, "drift.json"), JSON.stringify(drift, null, 2));

if (findings.length === 0) {
  console.log("drift: none. site, roles and scenarios in step.");
  process.exit(0);
}

console.log(`drift: ${findings.length} finding(s)`);
for (const f of findings) {
  console.log(`  [${f.kind}] ${f.reason}`);
  if (f.route) console.log(`    route: ${f.route}`);
  if (f.role) console.log(`    role: ${f.role}`);
  if (f.scenario) console.log(`    scenario: ${f.scenario}`);
  if (f.selector) console.log(`    selector: ${f.selector}`);
}
process.exit(1);

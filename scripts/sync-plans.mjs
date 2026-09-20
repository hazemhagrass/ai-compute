#!/usr/bin/env node
/**
 * Regenerate docs/plans/*.md from live GitHub issue state.
 *
 * Progress numbers are derived, never typed: a closed issue flips its box.
 * Hand-counting has produced plans reading 100% complete with whole sections
 * unbuilt, so the generator is the only thing allowed to write the numbers.
 *
 *   node scripts/sync-plans.mjs            # dry run, prints the table
 *   node scripts/sync-plans.mjs --write    # rewrite the phase files
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "hazemhagrass/ai-compute";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLANS = join(ROOT, "docs", "plans");
const WRITE = process.argv.includes("--write");

const PHASES = [
  { n: 1, slug: "foundation", label: "Foundation",      focus: "Correctness, tests, CI",
    intent: "Nothing below is safe to build on until the things here are true. The scoring engine and the cost arithmetic are pure functions that decide what a user spends money on, and both shipped with zero tests." },
  { n: 2, slug: "security",   label: "Security",        focus: "Auth, tenancy, secret handling",
    intent: "The app stores API keys and an unbounded archive of every prompt ever sent. It currently has no authentication of any kind, which makes this the phase that blocks every deployment that is not localhost." },
  { n: 3, slug: "router",     label: "Router quality",  focus: "Scoring, evaluation, benchmarks",
    intent: "The product is a ranking, and the ranking is built on scores that were assigned by hand. Everything here is about replacing plausible guesses with measurements." },
  { n: 4, slug: "analytics",  label: "Analytics",       focus: "Budgets, reporting, exports",
    intent: "Analytics today is entirely retrospective: it reports what was spent after it was spent. This phase makes it predictive and reconcilable against a real invoice." },
  { n: 5, slug: "providers",  label: "Providers",       focus: "Streaming, fallback, coverage",
    intent: "The client speaks two request shapes and waits for the full response. Streaming is the single biggest perceived-quality gap, and the features flags already advertise it." },
  { n: 6, slug: "release",    label: "Release",         focus: "Packaging, deploy, backups",
    intent: "Making the thing installable and survivable by someone who is not the author, including the case where the author's disk dies." },
  { n: 7, slug: "skills",     label: "Skills",          focus: "Agent skill authoring",
    intent: "Portable procedural knowledge, written once and loaded by whichever agent needs it. These are the crown jewels of the repo: the app is replaceable, the accumulated procedure is not." },
];

function gh(args) {
  return JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
}

const issues = gh([
  "issue", "list", "--repo", REPO, "--state", "all", "--limit", "500",
  "--json", "number,title,state,labels,body",
]);

/** 20-cell bar that floors the done count, so 1/41 never renders as progress. */
function bar(done, partial, total) {
  const cells = 20;
  if (!total) return "⬜".repeat(cells);
  let filled = Math.floor((done / total) * cells);
  let amber = Math.floor((partial / total) * cells);
  // Partial work always gets at least one cell, or honesty becomes invisible.
  if (partial > 0 && amber === 0) amber = 1;
  if (filled + amber > cells) filled = cells - amber;
  return "🟩".repeat(filled) + "🟧".repeat(amber) + "⬜".repeat(cells - filled - amber);
}

const sizeOrder = { "size:S": 0, "size:M": 1, "size:L": 2 };
const table = [];

for (const phase of PHASES) {
  const tag = `phase-${phase.n}-${phase.slug}`;
  const mine = issues
    .filter((i) => i.labels.some((l) => l.name === tag))
    .sort((a, b) => {
      const sa = sizeOrder[a.labels.find((l) => l.name.startsWith("size:"))?.name] ?? 9;
      const sb = sizeOrder[b.labels.find((l) => l.name.startsWith("size:"))?.name] ?? 9;
      return sa - sb || a.number - b.number;
    });

  const done = mine.filter((i) => i.state === "CLOSED").length;
  // "waiting-approval" means the agent finished but a human has not reviewed:
  // real work landed, so it counts as in-progress, never as done.
  const partial = mine.filter(
    (i) => i.state === "OPEN" && i.labels.some((l) => l.name === "waiting-approval"),
  ).length;
  const total = mine.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const pctPartial = total ? Math.round((partial / total) * 100) : 0;

  const rows = mine.map((i) => {
    const box = i.state === "CLOSED" ? "x"
      : i.labels.some((l) => l.name === "waiting-approval") ? "~" : " ";
    const size = i.labels.find((l) => l.name.startsWith("size:"))?.name.slice(5) ?? "?";
    const blocked = i.labels.some((l) => l.name === "blocked") ? " 🔴 **blocked**" : "";
    // First non-empty body line: the reasoning, not just the label.
    const why = (i.body ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith("**"))
      ?.replace(/`/g, "") ?? "";
    const reason = why ? ` — ${why.length > 190 ? `${why.slice(0, 190)}…` : why}` : "";
    return `- [${box}] **[#${i.number}](https://github.com/${REPO}/issues/${i.number}) · ${i.title}** \`${size}\`${blocked}${reason}`;
  });

  const md = `# Phase ${phase.n}: ${phase.label}

${phase.intent}

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run \`node scripts/sync-plans.mjs --write\`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**${pct}% done${partial ? ` · ${pctPartial}% in progress` : ""}**

\`${bar(done, partial, total)}\`

🟩 **${done} done** · 🟧 **${partial} in progress** · ⬜ **${total - done - partial} remaining** — ${total} tickets

<!-- tracker:end -->

## Tickets

${rows.join("\n") || "_No tickets yet._"}

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/${REPO}/labels/${tag})
`;

  const file = join(PLANS, `phase-0${phase.n}-${phase.slug}.md`);
  if (WRITE) {
    mkdirSync(PLANS, { recursive: true });
    writeFileSync(file, md);
  }

  const status = total === 0 ? "not started"
    : done === total ? "✅ complete"
    : done === 0 && partial === 0 ? `not started · 0 / ${total}`
    : `${pct}% · ${done} / ${total}`;
  table.push(`| [${phase.n}. ${phase.label}](./phase-0${phase.n}-${phase.slug}.md) | ${phase.focus} | ${status} |`);
  console.log(`phase ${phase.n} ${phase.label.padEnd(15)} ${done}/${total} done, ${partial} in progress`);
}

// Mirror the totals into the all-plans table. Its numbers have gone stale
// before, reading "0 / 156" while the plan was past halfway.
const readme = join(PLANS, "README.md");
const src = readFileSync(readme, "utf8");
const next = src.replace(
  /<!-- plans-table:start -->[\s\S]*?<!-- plans-table:end -->/,
  `<!-- plans-table:start -->

| Phase | Focus | Progress |
| --- | --- | --- |
${table.join("\n")}

<!-- plans-table:end -->`,
);

if (WRITE) {
  writeFileSync(readme, next);
  console.log(`\nwrote ${PHASES.length} phase files + README`);
} else {
  console.log("\ndry run — pass --write to update the files");
}

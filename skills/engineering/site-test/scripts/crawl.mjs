#!/usr/bin/env node
// Read-only site crawl in headless Chrome: GET only, never clicks or submits.
//
// Usage:
//   node crawl.mjs <baseUrl> <outDir> [--sitemap=<path>] [--config=<path>]
//
// Env:
//   WIDTH        (default 1280)
//   MAX_PAGES    (default 60)
//   CHROME       (default: first found on PATH from common locations)
//
// Config (optional, JSON):
//   { "known_routes": ["/", "/pricing"], "excluded_routes": ["/admin"] }
//
// Outputs:
//   <outDir>/crawl-report.json    per-page evidence
//   <outDir>/<N>_<slug>.png       one screenshot per route

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const [baseArg, outDir] = positional;
if (!baseArg || !outDir) {
  console.error("Usage: node crawl.mjs <baseUrl> <outDir> [--sitemap=<path>] [--config=<path>]");
  process.exit(2);
}
const base = baseArg.replace(/\/$/, "");
const origin = new URL(base).origin;
const WIDTH = Number(process.env.WIDTH ?? 1280);
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 60);
const CHROME =
  process.env.CHROME ??
  [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].find(existsSync);
if (!CHROME) {
  console.error("Chrome not found. Set CHROME=/path/to/chrome.");
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const config = flags.config
  ? JSON.parse(readFileSync(flags.config, "utf8"))
  : { known_routes: ["/"], excluded_routes: [] };
const excluded = new Set(config.excluded_routes ?? []);

// Page set: known routes + sitemap + one deliberate 404 for regression.
const pages = new Set(config.known_routes ?? ["/"]);
pages.add(`/__does-not-exist-${Date.now().toString(36)}`);
try {
  const sitemapUrl = flags.sitemap || `${base}/sitemap.xml`;
  const xml = await (
    await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) })
  ).text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      const u = new URL(m[1]);
      if (u.origin === origin) pages.add(u.pathname || "/");
    } catch {}
  }
} catch {
  // No sitemap is fine, we still crawl known_routes.
}
const queue = [...pages].filter((p) => !excluded.has(p)).slice(0, MAX_PAGES);

// ---- Chrome over CDP -------------------------------------------------------

const port = 9400 + Math.floor(Math.random() * 400);
const userDataDir = mkdtempSync(join(tmpdir(), "site-test-crawl-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--disable-gpu",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250);
  try {
    target = await (
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
    ).json();
  } catch {}
}
if (!target) {
  console.error("Chrome did not start on port", port);
  chrome.kill("SIGKILL");
  process.exit(2);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));

let seq = 0;
const pending = new Map();
let events = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    events.push(msg);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

for (const domain of ["Page", "Runtime", "Network", "Log"]) await send(`${domain}.enable`);
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: 900,
  deviceScaleFactor: 1,
  mobile: WIDTH < 600,
});

// ---- Per-page probe --------------------------------------------------------

const probe = `(() => {
  const vw = document.documentElement.clientWidth;
  const text = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
  const labelled = (el) =>
    el.getAttribute("aria-label") ||
    el.getAttribute("aria-labelledby") ||
    (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
    el.closest("label");
  const name = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".")
      : "");
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1]));
  const skipped = headings.some((level, i) => i > 0 && level > headings[i - 1] + 1);
  const scroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
      if (getComputedStyle(p).overflowX !== "visible") return true;
    return false;
  };
  const overflow = [];
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if ((r.right > vw + 1 || r.left < -1) && !scroller(el) && !overflow.some((o) => o.node.contains(el)))
      overflow.push({ node: el, sel: name(el), right: Math.round(r.right) });
  }
  return JSON.stringify({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || "",
    canonical: document.querySelector('link[rel="canonical"]')?.href || "",
    h1: document.querySelectorAll("h1").length,
    skippedHeadings: skipped,
    imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.currentSrc || i.src).slice(0, 10),
    unlabeledFields: [...document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea")]
      .filter((f) => !labelled(f))
      .map(name)
      .slice(0, 10),
    unnamedControls: [...document.querySelectorAll("button,a[href]")]
      .filter((b) => !text(b) && !b.querySelector("img[alt]:not([alt=''])"))
      .map(name)
      .slice(0, 10),
    links: [
      ...new Set(
        [...document.querySelectorAll("a[href]")]
          .map((a) => a.href)
          .filter((h) => h.startsWith(location.origin))
          .map((h) => h.split("#")[0]),
      ),
    ],
    scrollWidth: document.documentElement.scrollWidth,
    vw,
    overflow: overflow.slice(0, 8).map(({ node, ...rest }) => rest),
  });
})()`;

// ---- Crawl loop ------------------------------------------------------------

const results = [];
const linkStatus = new Map();
let idx = 0;
for (const path of queue) {
  idx += 1;
  events = [];
  const url = base + path;
  let status = 0;
  try {
    status = (await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) })).status;
  } catch {}
  await send("Page.navigate", { url });
  for (let i = 0; i < 60 && !events.some((e) => e.method === "Page.loadEventFired"); i++)
    await sleep(250);
  await sleep(1500);

  const evaluated = await send("Runtime.evaluate", { expression: probe, returnByValue: true });
  const data = JSON.parse(evaluated.result?.result?.value ?? "{}");
  const finalUrl = (
    await send("Runtime.evaluate", { expression: "location.href", returnByValue: true })
  ).result?.result?.value;

  const exceptions = events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map(
      (e) =>
        e.params.exceptionDetails?.exception?.description?.split("\n")[0] ||
        e.params.exceptionDetails?.text,
    );
  const consoleErrors = events
    .filter(
      (e) =>
        (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") ||
        (e.method === "Log.entryAdded" && e.params.entry.level === "error"),
    )
    .map((e) =>
      (e.params.args
        ? e.params.args.map((a) => a.value ?? a.description).join(" ")
        : e.params.entry.text
      ).slice(0, 200),
    );
  const failedRequests = [
    ...events
      .filter((e) => e.method === "Network.loadingFailed" && !e.params.canceled)
      .map((e) => `failed: ${e.params.errorText}`),
    ...events
      .filter((e) => e.method === "Network.responseReceived" && e.params.response.status >= 400)
      .map((e) => `${e.params.response.status} ${e.params.response.url.slice(0, 120)}`),
  ];

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const slug = path.replace(/[^a-z0-9]+/gi, "_") || "_home";
  const file = join(outDir, `${String(idx).padStart(3, "0")}_${WIDTH}${slug}.png`);
  if (shot.result?.data) writeFileSync(file, Buffer.from(shot.result.data, "base64"));

  for (const link of data.links ?? []) if (!linkStatus.has(link)) linkStatus.set(link, null);

  results.push({
    path,
    url,
    finalUrl,
    httpStatus: status,
    title: data.title,
    description: data.description,
    canonical: data.canonical,
    h1Count: data.h1,
    skippedHeadings: data.skippedHeadings,
    imagesWithoutAlt: data.imagesWithoutAlt,
    unlabeledFields: data.unlabeledFields,
    unnamedControls: data.unnamedControls,
    scrollOverflow: data.scrollWidth > data.vw + 1 ? { width: data.scrollWidth, viewport: data.vw } : null,
    overflow: data.overflow,
    exceptions,
    consoleErrors,
    failedRequests,
    screenshot: file,
  });
  console.log(`[${idx}/${queue.length}] ${status} ${path} -> ${file}`);
}

// ---- Link-check pass (internal only) --------------------------------------

const linkResults = [];
for (const link of linkStatus.keys()) {
  try {
    const res = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    linkResults.push({ link, status: res.status });
  } catch (err) {
    linkResults.push({ link, status: 0, error: String(err.message || err) });
  }
}
const brokenLinks = linkResults.filter((l) => l.status === 0 || l.status >= 400);

// ---- Write report ---------------------------------------------------------

const report = {
  base,
  startedAt: new Date().toISOString(),
  width: WIDTH,
  pages: results,
  brokenLinks,
  summary: {
    total: results.length,
    withConsoleErrors: results.filter((r) => r.consoleErrors.length).length,
    withFailedRequests: results.filter((r) => r.failedRequests.length).length,
    withOverflow: results.filter((r) => r.overflow.length || r.scrollOverflow).length,
    brokenLinks: brokenLinks.length,
  },
};
writeFileSync(join(outDir, "crawl-report.json"), JSON.stringify(report, null, 2));

console.log("");
console.log(`crawled ${results.length} pages, ${brokenLinks.length} broken internal links.`);
console.log(`report: ${join(outDir, "crawl-report.json")}`);

// Failing exit if anything meaningful is broken.
const bad =
  results.some((r) => r.consoleErrors.length || r.failedRequests.length || r.exceptions.length) ||
  brokenLinks.length > 0;

ws.close();
chrome.kill("SIGTERM");
process.exit(bad ? 1 : 0);

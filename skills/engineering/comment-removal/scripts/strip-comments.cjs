const fs = require("fs");
const path = require("path");
const lib = require("./strip_code_comments.cjs");

const APPLY = process.argv.includes("--apply");
const LIST = process.argv.includes("--list");
const ROOT = process.argv.filter((a) => !a.startsWith("--"))[2] ?? ".";
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "out", "coverage", ".turbo"]);
const EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

let files = 0;
let changed = 0;
let commentLines = 0;
let totalComments = 0;
const kept = new Map();
const keptJsx = [];
const failures = [];
for (const f of walk(ROOT)) {
  const text = fs.readFileSync(f, "utf8");
  if (!text.length) continue;
  files += 1;
  const res = lib.strip(f, text);
  totalComments += res.comments.length;
  if (res.text === text) continue;
  if (!res.ok) {
    failures.push({ file: path.relative(ROOT, f), divergence: res.divergence });
    continue;
  }
  changed += 1;
  commentLines += res.removed;
  if (res.kept.length) kept.set(path.relative(ROOT, f), res.kept);
  for (const p of res.protectedJsx) keptJsx.push([path.relative(ROOT, f), p.text.split("\n")[0].trim().slice(0, 60)]);
  if (APPLY) fs.writeFileSync(f, res.text);
  else if (LIST) console.log(`  ${path.relative(ROOT, f)} (${res.comments.length} comments, ${res.removed} lines)`);
}

console.log(`${APPLY ? "APPLIED" : "DRY RUN"}: ${changed}/${files} files changed, ${commentLines} comment lines removed, ${totalComments} comments seen`);
if (failures.length) {
  console.log(`SKIPPED ${failures.length} file(s) failing verification:`);
  for (const f of failures) console.log(`  ${f.file}: ${f.divergence?.before} -> ${f.divergence?.after}`);
}
console.log(`kept directives (${kept.size} files):`);
for (const [f, k] of kept) console.log(`  ${f}: ${k.join(" | ")}`);
console.log(`kept JSX comments next to text (${keptJsx.length}):`);
for (const [f, t] of keptJsx) console.log(`  ${f}: ${t}`);

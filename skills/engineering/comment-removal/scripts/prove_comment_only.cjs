const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const lib = require("./strip_code_comments.cjs");

const REPO = process.argv[2];
const PREFIX = process.argv[3] ?? "";
const rel = execFileSync("git", ["-C", REPO, "diff", "--name-only", "HEAD", "--", PREFIX], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

let identical = 0;
const differs = [];
const newFiles = [];
for (const r of rel) {
  const abs = path.join(REPO, r);
  if (!fs.existsSync(abs)) continue;
  let head;
  try {
    head = execFileSync("git", ["-C", REPO, "show", `HEAD:${r}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    newFiles.push(r);
    continue;
  }
  const working = fs.readFileSync(abs, "utf8");
  const res = lib.strip(abs, head);
  if (!res.ok) {
    differs.push(`${r} (strip of HEAD failed verification)`);
    continue;
  }
  if (res.text === working) identical += 1;
  else differs.push(r);
}

console.log(`checked ${rel.length} changed files: ${identical} are exactly HEAD-with-comments-removed`);
if (newFiles.length) console.log(`new/untracked (skipped): ${newFiles.join(", ")}`);
if (differs.length) {
  console.log(`NOT pure comment-strips (${differs.length}):`);
  for (const d of differs) console.log(`  ${d}`);
}

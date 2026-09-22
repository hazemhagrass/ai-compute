#!/usr/bin/env python3
"""Security scan over skills before they are published.

Threat model: this repository is published to skill marketplaces, so a reader's
agent loads SKILL.md as *instructions* and may execute any bundled script. Two
different things therefore need two different scans:

  1. SKILL.md prose is instruction surface. Text that redirects the agent
     ("ignore previous instructions"), or tells it to fetch and run remote
     content, is prompt injection regardless of how innocent it looks.

  2. Bundled scripts are execution surface. Exfiltration, eval-style
     construction and unpinned installs matter in files that actually run.

The distinction matters for false positives. A security skill legitimately
*teaches* `curl | sh` inside a fenced bad example; that is documentation, not
an instruction to the agent. So prose rules skip fenced code blocks, and
execution rules apply only to real script files.

Exit code 0 = clean, 1 = findings.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"

SCRIPT_SUFFIXES = {".py", ".sh", ".bash", ".zsh", ".js", ".mjs", ".rb", ".pl", ".ps1"}

# --- instruction-surface rules (SKILL.md prose, outside fenced blocks) -------

INJECTION = [
    (r"ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+instructions",
     "instruction override"),
    (r"disregard\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|rules)",
     "instruction override"),
    (r"\bsystem\s*prompt\b.{0,40}\b(?:reveal|print|output|show|repeat|ignore)\b",
     "system prompt disclosure"),
    (r"\b(?:reveal|print|output|show|repeat)\b.{0,40}\bsystem\s*prompt\b",
     "system prompt disclosure"),
    (r"do\s+not\s+(?:tell|inform|mention\s+to)\s+the\s+user",
     "concealment from the user"),
    (r"without\s+(?:telling|informing|asking)\s+the\s+user",
     "concealment from the user"),
    (r"\byou\s+must\s+(?:now\s+)?(?:fetch|download|curl|wget)\b",
     "coerced remote fetch"),
]

# Prose that tells the agent to pull remote content at runtime. Issue #151
# requires an explicit documented reason for any of these.
RUNTIME_FETCH = [
    (r"(?:curl|wget)\s+[^\n|]*\|\s*(?:ba)?sh", "pipes a download straight into a shell"),
    (r"\b(?:curl|wget)\b[^\n]*\bhttps?://", "fetches a remote URL"),
    (r"\bpip\s+install\s+[^\n]*\bhttps?://", "installs from a URL"),
]

FETCH_WAIVER = "security-scan: runtime-fetch allowed"

# --- execution-surface rules (bundled script files) -------------------------

EXFIL = [
    (r"(?:curl|wget)[^\n]*(?:--data|-d\s|--upload-file|-T\s)", "uploads data to a remote host"),
    (r"requests\.(?:post|put)\s*\(", "posts data to a remote host"),
    (r"urllib\.request\.urlopen\s*\([^)]*data\s*=", "posts data to a remote host"),
    (r"\bnc\b[^\n]*\s-e\b", "netcat with command execution"),
    (r"base64\s+(?:-d|--decode)[^\n]*\|\s*(?:ba)?sh", "decodes and executes a payload"),
]

DANGEROUS = [
    (r"\beval\s*\(", "eval of constructed input"),
    (r"\bexec\s*\(", "exec of constructed input"),
    (r"subprocess\.[A-Za-z_]+\([^)]*shell\s*=\s*True", "shell=True subprocess"),
    (r"os\.system\s*\(", "os.system call"),
    (r"pickle\.loads?\s*\(", "pickle deserialisation"),
]

SECRETS_READ = [
    (r"(?:cat|read|open)\s*\(?[^\n]{0,40}(?:\.env|id_rsa|\.ssh/|credentials|\.aws/)",
     "reads a secret-bearing path"),
    (r"os\.environ(?:\.get)?\s*[\[(]\s*['\"](?:AWS_|GITHUB_TOKEN|OPENAI_|ANTHROPIC_)",
     "reads a credential environment variable"),
]

UNPINNED = [
    (r"pip\s+install\s+(?!-r\b)(?![^\n]*[=<>@])[A-Za-z][\w.-]*", "unpinned pip install"),
    (r"npm\s+i(?:nstall)?\s+(?:-g\s+)?(?![^\n]*@\d)[A-Za-z@][\w.@/-]*", "unpinned npm install"),
]


def strip_fences(text: str) -> list[tuple[int, str]]:
    """Return (line_number, line) for prose lines only, dropping fenced code."""
    out: list[tuple[int, str]] = []
    in_fence = False
    for i, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence:
            out.append((i, line))
    return out


def scan_prose(path: Path, findings: list[str]) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    waived = FETCH_WAIVER in text
    rel = path.relative_to(ROOT)
    for lineno, line in strip_fences(text):
        low = line.lower()
        for pattern, label in INJECTION:
            if re.search(pattern, low):
                findings.append(f"{rel}:{lineno}: prompt injection ({label}): {line.strip()[:90]}")
        if waived:
            continue
        # Inline `code` spans are documentation, exactly like fenced blocks:
        # a skill showing `curl http://svc` as a symptom is teaching, not
        # instructing the agent to fetch. Strip them before the fetch rules.
        low_prose = re.sub(r"`[^`]*`", "", low)
        for pattern, label in RUNTIME_FETCH:
            if re.search(pattern, low_prose):
                findings.append(
                    f"{rel}:{lineno}: runtime fetch in prose ({label}); "
                    f"document the reason or move it into a fenced example: {line.strip()[:70]}"
                )


def scan_script(path: Path, findings: list[str]) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(ROOT)
    rules = [("exfiltration", EXFIL), ("dangerous construct", DANGEROUS),
             ("secret access", SECRETS_READ), ("supply chain", UNPINNED)]
    for i, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith("#") and "install" not in line:
            continue
        for kind, ruleset in rules:
            for pattern, label in ruleset:
                if re.search(pattern, line):
                    findings.append(f"{rel}:{i}: {kind} ({label}): {line.strip()[:90]}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan skills for injection and unsafe scripts.")
    ap.add_argument("target", nargs="?", help="optional category/name to scan alone")
    args = ap.parse_args()

    if args.target:
        roots = [SKILLS / args.target]
        if not roots[0].is_dir():
            print(f"no such skill: {args.target}", file=sys.stderr)
            return 2
    else:
        roots = sorted(p for p in SKILLS.glob("*/*") if p.is_dir())

    findings: list[str] = []
    scanned_md = scanned_scripts = 0

    for skill in roots:
        for md in sorted(skill.glob("*.md")):
            scan_prose(md, findings)
            scanned_md += 1
        for sub in sorted(skill.rglob("*")):
            if sub.is_file() and sub.suffix in SCRIPT_SUFFIXES:
                scan_script(sub, findings)
                scanned_scripts += 1

    if findings:
        print(f"security scan: {len(findings)} finding(s)\n")
        for f in findings:
            print(f"  {f}")
        print("\nIf a finding is a deliberate teaching example, move it inside a fenced")
        print("code block. If a skill genuinely must fetch at runtime, state the reason")
        print(f"in the file and include the marker: {FETCH_WAIVER}")
        return 1

    print(f"security scan clean: {scanned_md} markdown file(s), {scanned_scripts} script(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

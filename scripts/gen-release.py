#!/usr/bin/env python3
"""Decide the next release version and write its notes (#149, #150).

Versioning rule, derived from what consumers actually care about:

  major  a skill was REMOVED or renamed. Someone's pin breaks.
  minor  a skill was ADDED. New capability, nothing breaks.
  patch  existing skills changed content only.

That is computed by diffing skills/MANIFEST.json between the last release
tag and the working tree, not by parsing commit messages: the manifest is
the source of truth for what is actually published, and commit subjects
lie. Prints shell-style key=value pairs for GitHub Actions outputs.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "skills" / "MANIFEST.json"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    ).stdout.strip()


def last_tag() -> str | None:
    tag = git("describe", "--tags", "--abbrev=0", "--match", "v*")
    return tag if re.fullmatch(r"v\d+\.\d+\.\d+", tag) else None


def manifest_at(ref: str | None) -> dict:
    if ref is None:
        if not MANIFEST.is_file():
            return {}
        raw = MANIFEST.read_text()
    else:
        raw = git("show", f"{ref}:skills/MANIFEST.json")
        if not raw:
            return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    skills = data.get("skills", {})
    # Tolerate both shapes: {name: {...}} and [{name: ...}, ...]
    if isinstance(skills, list):
        return {s.get("name", ""): s for s in skills if isinstance(s, dict)}
    return skills if isinstance(skills, dict) else {}


def content_hash(entry: object) -> str:
    if isinstance(entry, dict):
        for key in ("hash", "content_hash", "sha256", "digest"):
            if key in entry:
                return str(entry[key])
        return json.dumps(entry, sort_keys=True)
    return str(entry)


def bump(prev: str, level: str) -> str:
    major, minor, patch = (int(x) for x in prev.lstrip("v").split("."))
    if level == "major":
        return f"v{major + 1}.0.0"
    if level == "minor":
        return f"v{major}.{minor + 1}.0"
    return f"v{major}.{minor}.{patch + 1}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", help="append key=value pairs here (GITHUB_OUTPUT)")
    args = ap.parse_args()

    tag = last_tag()
    old = manifest_at(tag)
    new = manifest_at(None)

    if not new:
        print("skills/MANIFEST.json is missing or unreadable", file=sys.stderr)
        return 1

    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(
        name for name in set(new) & set(old)
        if content_hash(new[name]) != content_hash(old[name])
    )

    if removed:
        level = "major"
    elif added:
        level = "minor"
    elif changed:
        level = "patch"
    else:
        level = None

    if tag is None:
        version = "v0.1.0"
        level = level or "minor"
    elif level is None:
        version = tag
    else:
        version = bump(tag, level)

    lines = [f"# {version}", ""]
    if tag:
        lines.append(f"Changes since {tag}.")
        lines.append("")
    for title, names in (("Added", added), ("Removed", removed), ("Updated", changed)):
        if names:
            lines.append(f"## {title}")
            lines.extend(f"- {n}" for n in names)
            lines.append("")
    if not (added or removed or changed):
        lines.append("No skill content changed.")
        lines.append("")
    notes = "\n".join(lines)

    notes_path = ROOT / "RELEASE_NOTES.md"
    notes_path.write_text(notes)

    did_change = "true" if level is not None and version != tag else "false"
    out = [
        f"version={version}",
        f"level={level or 'none'}",
        f"changed={did_change}",
        f"notes_path={notes_path}",
        f"added={len(added)}",
        f"removed={len(removed)}",
        f"updated={len(changed)}",
    ]
    for line in out:
        print(line)
    if args.output:
        with open(args.output, "a", encoding="utf-8") as fh:
            fh.write("\n".join(out) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

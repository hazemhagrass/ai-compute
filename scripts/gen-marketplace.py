#!/usr/bin/env python3
"""Generate the Claude Code plugin marketplace manifest from the skill tree.

Why per-category plugins instead of one big one: a marketplace entry is the
unit a user installs. Nobody wants 98 skills to get the three finance ones,
and progressive disclosure only keeps *loading* cheap, not the install
decision. One plugin per category keeps each install meaningful, and the
manifest is generated from disk so it can never drift from the tree.

Writes .claude-plugin/marketplace.json. With --check, verifies the committed
manifest matches what the tree would produce right now (used in CI).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"
OUT = ROOT / ".claude-plugin" / "marketplace.json"

OWNER = "hazemhagrass"
REPO = "ai-compute"

# Blurbs describe the category as a unit, since that is what gets installed.
CATEGORY_BLURB = {
    "ai": "Working with models: prompting, model selection, agent SDKs.",
    "career": "Resumes, portfolios, interviews, and negotiation.",
    "data": "Analysis and presentation of data: dataframes, SQL, BI, visualisation.",
    "design": "Usability, accessibility, and design systems.",
    "devops": "Build, deploy, run, observe: containers, orchestration, pipelines.",
    "devtools": "The developer's own machine and loop: shell, dotfiles, regex, navigation.",
    "engineering": "Writing and changing production code: refactoring, debugging, testing, APIs.",
    "finance": "Personal money: budgets, portfolios, retirement.",
    "homelab": "Self-hosted infrastructure at home.",
    "knowledge": "Personal and team knowledge bases: notes, wikis, structured bases.",
    "learning": "Learning and teaching: retention, course and curriculum design.",
    "meta": "Skills about this repository's own artefacts.",
    "office": "Producing documents in office formats: Word, Excel, PowerPoint, Sheets.",
    "presentation": "Slides and live delivery.",
    "productivity": "Email, meetings, and personal organisation.",
    "research": "Finding and verifying what is true: literature, citations, papers, surveys.",
    "security": "Finding and fixing vulnerabilities before someone else does.",
    "workflow": "How work itself is organised: planning, specs, autonomous execution.",
    "writing": "Prose for a reader: docs, blogs, newsletters, copy.",
}


def read_version() -> str:
    """Semver for the published plugins, from the latest git tag.

    MANIFEST.json's `version` is the *schema* version of that file (currently
    1), not a release number: publishing it would ship every plugin as "1".
    The release tag is the real version, and gen-release.py is what moves it.
    """
    import subprocess
    try:
        tag = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0", "--match", "v*"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        ).stdout.strip()
    except OSError:
        tag = ""
    if re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        return tag[1:]
    return "0.1.0"


def categories() -> list[tuple[str, list[Path]]]:
    out = []
    for cat in sorted(p for p in SKILLS.iterdir() if p.is_dir()):
        skills = sorted(s for s in cat.iterdir() if s.is_dir() and (s / "SKILL.md").is_file())
        if skills:
            out.append((cat.name, skills))
    return out


def build() -> dict:
    version = read_version()
    plugins = []
    for cat, skills in categories():
        blurb = CATEGORY_BLURB.get(cat, f"{cat} skills.")
        plugins.append({
            "name": f"ai-computer-{cat}",
            "source": "./",
            "description": f"{blurb} {len(skills)} skill{'s' if len(skills) != 1 else ''}.",
            "version": version,
            "author": {"name": "Hazem Hagrass"},
            "homepage": f"https://github.com/{OWNER}/{REPO}/tree/main/skills/{cat}",
            "license": "MIT",
            "keywords": [cat, "skills", "agent"],
            "skills": [f"./skills/{cat}/{s.name}" for s in skills],
        })

    return {
        "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
        "name": "ai-computer",
        "owner": {"name": "Hazem Hagrass", "url": f"https://github.com/{OWNER}"},
        "metadata": {
            "description": (
                "Agent skills for engineering, security, data, writing and personal "
                "workflows. Every skill is validated and security-scanned in CI."
            ),
            "version": version,
        },
        "plugins": plugins,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify the committed manifest is current")
    args = ap.parse_args()

    data = build()
    text = json.dumps(data, indent=2) + "\n"

    if args.check:
        if not OUT.is_file():
            print("marketplace.json is missing; run scripts/gen-marketplace.py", file=sys.stderr)
            return 1
        if OUT.read_text() != text:
            print("marketplace.json is stale; run scripts/gen-marketplace.py", file=sys.stderr)
            return 1
        print(f"marketplace manifest current: {len(data['plugins'])} plugins")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    total = sum(len(p["skills"]) for p in data["plugins"])
    print(f"wrote {OUT.relative_to(ROOT)}: {len(data['plugins'])} plugins, {total} skills")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

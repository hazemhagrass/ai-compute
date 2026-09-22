#!/usr/bin/env python3
"""Regenerate skills/MANIFEST.json: the content fingerprint every consumer pins.

Each skill records the sha256 of its SKILL.md (the version contract) plus the
frontmatter version if the skill declares one. CI runs this with --check: a
stale manifest fails the run, so a merged change that forgot to regen is a
build failure, not a silent drift.
"""
import hashlib, json, re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
manifest_path = REPO / "skills" / "MANIFEST.json"

skills = {}
bad = []
for f in sorted((REPO / "skills").rglob("SKILL.md")):
    rel = str(f.parent.relative_to(REPO / "skills"))
    t = f.read_text()
    sha = hashlib.sha256(t.encode()).hexdigest()[:12]
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    ver = None
    if m:
        vm = re.search(r"^version:\s*([\w.]+)\s*$", m.group(1), re.M)
        if vm:
            ver = vm.group(1)
    skills[rel] = {"sha": sha, **({"version": ver} if ver else {})}

data = {"version": 1, "skills": skills}
new_text = json.dumps(data, indent=2, sort_keys=True) + "\n"

if "--check" in sys.argv:
    old = manifest_path.read_text() if manifest_path.exists() else ""
    if old != new_text:
        print("MANIFEST.json is stale. Run: python3 scripts/gen-manifest.py")
        sys.exit(1)
    print(f"manifest ok: {len(skills)} skills")
else:
    manifest_path.write_text(new_text)
    print(f"manifest: {len(skills)} skills")
sys.exit(0)

#!/usr/bin/env python3
"""Block filler prose and unsourced authority claims in skill content.

The failure mode for a skill library is not a broken file, it is a file that
reads like every SEO post on the topic. Two things separate a skill worth
installing from filler:

  1. No invented authority. "Studies show" with no study, "73% of recruiters"
     with no source. These are the most common tells in web-sourced advice.
  2. No hollow phrasing. "Delve into", "game-changer", "in today's fast-paced
     world" carry no information.

Context matters, so the scanner strips before matching:
  - fenced code blocks (a Bad: example may legitimately contain filler)
  - inline `code` spans and link URLs (doc titles are cited verbatim)

Run: python3 scripts/scan-filler.py [--check]
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

SKILLS = ROOT / "skills"

# Hollow phrasing. Each carries no information a reader could act on.
FILLER = [
    (r"\bdelve[sd]? into\b", "delve into"),
    (r"\bgame[- ]chang(er|ing)\b", "game-changer"),
    (r"\bin today's [a-z-]+ (world|landscape|era)\b", "in today's ... world"),
    (r"\bit'?s (important|crucial|essential) to note\b", "it is important to note"),
    (r"\bat the end of the day\b", "at the end of the day"),
    (r"\bunlock(ing)? the (power|potential)\b", "unlock the power"),
    (r"\bharness(ing)? the (power|potential)\b", "harness the power"),
    (r"\btakes? (it )?to the next level\b", "to the next level"),
    (r"\bleverag(e|es|ing) (the|a|an|your|our|their|its|this|these|those)\b",
     "leverage (verb) -- use a real verb"),
    (r"\bin conclusion\b", "in conclusion"),
    (r"\bwhen it comes to\b", "when it comes to"),
]

# Authority with no source attached. The pattern is the claim shape, not the
# topic: a number or a "studies show" with nothing a reader could check.
AUTHORITY = [
    (r"\bstudies (show|have shown|suggest|indicate)\b", "studies show (no study named)"),
    (r"\bresearch (shows|has shown|suggests|indicates)\b", "research shows (no source)"),
    (r"\bexperts? (agree|say|recommend)\b", "experts agree (no expert named)"),
    (r"\bit is (widely )?known that\b", "it is known that"),
    (r"\bstatistics show\b", "statistics show (no source)"),
    (r"\b\d{1,3}(\.\d+)?% of (recruiters|hiring managers|users|developers|people|readers)\b",
     "percentage claim about a population (no source)"),
]


def strip_context(text: str) -> str:
    """Remove spans where filler is legitimate.

    A skill teaching what NOT to write needs the bad phrasing in its Bad:
    example, and a citation may quote a doc titled "Best Practices" verbatim.
    Neither is the skill's own prose, so neither should fail the build.
    """
    # fenced code blocks
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    # inline code spans
    text = re.sub(r"`[^`]*`", "", text)
    # link targets and link text (cited titles)
    text = re.sub(r"\[[^\]]*\]\([^)]*\)", "", text)
    # bare URLs
    text = re.sub(r"<?https?://\S+>?", "", text)
    return text


def scan(path: pathlib.Path):
    raw = path.read_text(encoding="utf-8")
    body = strip_context(raw)
    hits = []
    for pattern, label in FILLER:
        for m in re.finditer(pattern, body, re.I):
            hits.append(("filler", label, m.group(0)))
    for pattern, label in AUTHORITY:
        for m in re.finditer(pattern, body, re.I):
            hits.append(("authority", label, m.group(0)))
    return hits


def main() -> int:
    files = sorted(SKILLS.rglob("*.md"))
    findings = []
    for f in files:
        rel = f.relative_to(ROOT)
        for kind, label, text in scan(f):
            findings.append((str(rel), kind, label, text))

    if not findings:
        print(f"prose scan clean: {len(files)} markdown file(s)")
        return 0

    print(f"prose scan: {len(findings)} finding(s)\n")
    for rel, kind, label, text in findings:
        print(f"  {rel}: {kind} ({label}): {text.strip()[:70]}")
    print()
    print("Filler carries no information: cut it or replace it with the")
    print("specific claim it is standing in for. An authority claim needs a")
    print("named, checkable source, or it should not be made at all.")
    print("Legitimate uses inside code fences, inline spans, or cited link")
    print("titles are already ignored by the scanner.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

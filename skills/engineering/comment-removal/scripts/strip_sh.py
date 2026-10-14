"""Strip whole-line # comments from shell scripts.

Only lines whose first non-blank character is # are touched, so $#, ${x#y} and
# inside words are never in scope. Heredoc bodies, shebangs and tool directives
are left alone. Verification: the surviving line sequence must be byte-identical
to the original's non-comment lines, and bash -n must accept the result.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

KEEP = ("#!", "# shellcheck", "# vim:", "# -*-", "# shellspec", "# bats")
HEREDOC = re.compile(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?")


def strip_text(text):
    lines = text.split("\n")
    out = []
    removed = 0
    heredoc = None
    for line in lines:
        if heredoc is not None:
            out.append(line)
            if line.strip() == heredoc:
                heredoc = None
            continue
        m = HEREDOC.search(line)
        stripped = line.lstrip()
        if stripped.startswith("#") and not any(stripped.startswith(k) for k in KEEP):
            removed += 1
            continue
        out.append(line)
        if m and not stripped.startswith("#"):
            heredoc = m.group(1)
    result = "\n".join(out)
    while "\n\n\n" in result:
        result = result.replace("\n\n\n", "\n\n")
    return result, removed


def survivors(text):
    return [l for l in text.split("\n") if l.strip() and not l.lstrip().startswith("#")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    for f in args.files:
        p = Path(f)
        text = p.read_text()
        result, removed = strip_text(text)
        if result == text:
            print(f"  {f}: unchanged")
            continue
        if survivors(text) != survivors(result):
            print(f"  {f}: SKIPPED, surviving code changed")
            continue
        check = subprocess.run(["bash", "-n"], input=result, text=True, capture_output=True)
        if check.returncode != 0:
            print(f"  {f}: SKIPPED, bash -n failed: {check.stderr.strip()[:120]}")
            continue
        print(f"  {f}: {removed} comment lines removed")
        if args.apply:
            p.write_text(result)


if __name__ == "__main__":
    sys.exit(main())

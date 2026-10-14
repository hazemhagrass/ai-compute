"""Strip whole-line # comments from Dockerfile and YAML config files.

Only lines whose first non-blank character is # are removed. Parser/tool
directives that change behaviour are kept (# syntax=, # escape=, # check=,
# shellcheck, # yamllint, # yaml-language-server). Lines inside YAML block
scalars and Dockerfile heredocs are content, not comments, so they are skipped.

Verification:
  YAML     -> yaml.safe_load(before) must equal yaml.safe_load(after)
  other    -> the surviving line sequence must be identical to the original's
              non-comment lines
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

KEEP = ("#!", "# syntax=", "# syntax ", "# escape=", "# check=", "# shellcheck", "# yamllint", "# yaml-language-server")
HEREDOC = re.compile(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?")
BLOCK = re.compile(r"[|>][0-9]*[-+]?\s*(#.*)?$")


def indent_of(line):
    return len(line) - len(line.lstrip(" "))


def strip_text(text):
    lines = text.split("\n")
    out = []
    removed = 0
    heredoc = None
    block_indent = None
    for line in lines:
        if heredoc is not None:
            out.append(line)
            if line.strip() == heredoc:
                heredoc = None
            continue
        if block_indent is not None:
            if line.strip() and indent_of(line) <= block_indent:
                block_indent = None
            else:
                out.append(line)
                continue
        stripped = line.lstrip()
        if stripped.startswith("#"):
            if any(stripped.startswith(k) for k in KEEP):
                out.append(line)
            else:
                removed += 1
            continue
        out.append(line)
        m = HEREDOC.search(line)
        if m and not stripped.startswith("#"):
            heredoc = m.group(1)
        if BLOCK.search(line):
            block_indent = indent_of(line)
    result = "\n".join(out)
    while "\n\n\n" in result:
        result = result.replace("\n\n\n", "\n\n")
    result = result.lstrip("\n")
    if text.endswith("\n") and not result.endswith("\n"):
        result += "\n"
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
        if p.suffix in (".yml", ".yaml"):
            try:
                ok = yaml.safe_load(text) == yaml.safe_load(result)
            except yaml.YAMLError as exc:
                ok = False
                print(f"  {f}: parse error after strip: {exc}")
        else:
            ok = survivors(text) == survivors(result)
        if not ok:
            print(f"  {f}: SKIPPED, verification failed")
            continue
        print(f"  {f}: {removed} comment lines removed, verified")
        if args.apply:
            p.write_text(result)


if __name__ == "__main__":
    sys.exit(main())

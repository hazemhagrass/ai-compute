"""Strip # comments from Python files.

Docstrings are kept: two scripts in this repo read __doc__ (argparse help and a
usage print), so a docstring can be functional. Comments are removed by exact
tokenize() ranges, and every edit is verified by re-parsing: the AST must be
identical (docstrings included) and the code token stream must be unchanged.
"""

import argparse
import ast
import io
import sys
import tokenize
from pathlib import Path

PROTECT = (
    "type: ignore",
    "type: ",
    "noqa",
    "pragma",
    "fmt: off",
    "fmt: on",
    "isort:",
    "pylint:",
    "ruff:",
    "mypy:",
    "doctest:",
    "nosec",
    "shellcheck",
    "-*- coding",
    "coding:",
    "!/usr/bin",
    "!/bin/",
)

SKIP_DIRS = {"node_modules", ".next", "dist", "out", "coverage", ".venv", "venv", "__pycache__", ".git"}

def collect_comments(text):
    """Comment ranges as exact (start, end) line/column offsets in text."""
    out = []
    readline = io.StringIO(text).readline
    try:
        for tok in tokenize.generate_tokens(readline):
            if tok.type != tokenize.COMMENT:
                continue
            if any(p in tok.string for p in PROTECT):
                continue
            out.append(tok.start)
    except tokenize.TokenError:
        return None
    lines = text.splitlines(keepends=True)
    offsets = []
    for row, col in out:
        offsets.append(sum(len(l) for l in lines[: row - 1]) + col)
    return offsets

def code_tokens(text):
    """Token stream with trivia removed, for equality checking."""
    readline = io.StringIO(text).readline
    skip = {tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING}
    return [(t.type, t.string) for t in tokenize.generate_tokens(readline) if t.type not in skip]

def strip_text(text):
    offsets = collect_comments(text)
    if offsets is None or not offsets:
        return text, 0, True
    lines = text.split("\n")
    cuts = []
    for pos in offsets:
        row = text.count("\n", 0, pos) + 1
        col = pos - (text.rfind("\n", 0, pos) + 1)
        cuts.append((row - 1, col))
    per_line = {}
    for row, col in cuts:
        per_line[row] = min(per_line.get(row, col), col)

    out = []
    removed = 0
    for i, line in enumerate(lines):
        if i in per_line:
            stripped = line[: per_line[i]].rstrip()
            if stripped:
                out.append(stripped)
            elif line.strip():
                removed += 1
            continue
        out.append(line)

    result = "\n".join(out)
    while "\n\n\n" in result:
        result = result.replace("\n\n\n", "\n\n")
    result = result.lstrip("\n")
    if not result.endswith("\n"):
        result += "\n"
    try:
        ok = ast.dump(ast.parse(text)) == ast.dump(ast.parse(result)) and code_tokens(text) == code_tokens(result)
    except SyntaxError:
        ok = False
    return result, removed, ok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    files = []
    for p in Path(args.root).rglob("*.py"):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        files.append(p)

    changed = files_removed = 0
    failures = []
    for p in sorted(files):
        text = p.read_text()
        result, removed, ok = strip_text(text)
        if result == text:
            continue
        if not ok:
            failures.append(str(p))
            continue
        changed += 1
        files_removed += removed
        if args.apply:
            p.write_text(result)
        else:
            print(f"  {p} ({removed} lines)")
    print(f"{'APPLIED' if args.apply else 'DRY RUN'}: {changed}/{len(files)} files, {files_removed} comment lines removed")
    if failures:
        print("SKIPPED (verification failed):")
        for f in failures:
            print(f"  {f}")

if __name__ == "__main__":
    sys.exit(main())

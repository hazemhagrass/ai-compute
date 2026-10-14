---
name: comment-removal
description: "Use when removing comments from a codebase en masse. Strip with parser-verified edits and keep functional directives."
---

# Comment Removal

Removing comments is a mechanical edit with an exact guarantee available: the
code that runs is byte-identical afterwards, because a parser says so. The risk
is never the deletion itself, it is a tool that claims to delete comments and
quietly edits code.

## Collect comments from the parser, never a bare lexer

- Enumerate every `//` and `/*` occurrence in the text, then drop the ones that
  fall inside parser-derived literal ranges: strings, template literals, regex
  literals, JSX text.
- A bare `ts.createScanner` walk over source text swallows everything from a
  backtick to the next backtick, so every comment after the first template
  literal is invisible. The symptom is one file reporting a comment count far
  below what `grep -c '//'` finds, and a directive that goes unprotected.
- `ts.getLeadingCommentRanges` is not a substitute: it returns nothing for
  comments at nested positions inside JSX, which is exactly where disable
  directives sit.
- A `//` inside a URL string, a regex, or JSX text is content. Only the parser
  knows which ranges are content, so never scan free text for comment markers.

## Prove the edit is comment-only before writing

- Compare the parser-derived significant-token stream before and after, and
  leave any file that fails untouched. Report failures instead of forcing them.
- Normalize JSX text in that stream (collapse whitespace runs, drop
  whitespace-only nodes), otherwise rendered-equivalent merges fail the check
  and you start "fixing" files that were already correct.
- Merge overlapping or touching cut ranges before rebuilding the file. A JSX
  comment wrapper overlaps the comment inside it, and a builder that assumes
  disjoint ranges emits a stray brace into the output.
- Keep JSX comment wrappers that sit next to non-empty JSX text: removing one
  merges the neighbouring text nodes and changes rendered whitespace.
- Close with the strongest check on the diff itself: strip
  `git show HEAD:<file>` and require the result to be byte-identical to the
  working file. That proves the change set is comment removal and nothing else.

## Keep what the toolchain executes

- Keep `eslint-disable` and `eslint-enable`, `@ts-expect-error`, `@ts-ignore`,
  `@ts-nocheck`, `@vitest-environment`, `@jest-environment`, `prettier-ignore`,
  `v8 ignore`, `istanbul ignore`, `c8 ignore`, `@__PURE__`,
  `webpackChunkName`, `webpackIgnore` and `/// <reference>` lines. They are
  instructions to tools, not prose for humans.
- Keep shebangs, Dockerfile parser directives (`# syntax=`, `# escape=`,
  `# check=`), and lint directives (`# shellcheck`, `# yamllint`,
  `# yaml-language-server`).
- Do not fight generated files. `next-env.d.ts` regains its banner on every
  `next typegen` or build; either leave it or strip it from a postbuild step.

## Use each language's own parser

- Python: take exact comment ranges from `tokenize`, then verify with
  `ast.dump` equality plus a code-token comparison. Keep docstrings, because
  `__doc__` is functional wherever a CLI passes it to argparse, a script prints
  it, or doctests run out of it.
- Shell, Dockerfile, YAML: remove only lines whose first non-blank character is
  `#`, so `$#`, `${x#y}` and a `#` inside a word stay out of scope. Skip heredoc
  bodies and YAML block scalars, which are content rather than comments.
- Verify shell with `bash -n` and YAML with `yaml.safe_load` data equality.
  Leave `run: |` bodies alone unless you also re-check the embedded shell, since
  a comment inside a block scalar is data to YAML.

## Finish with whitespace and the real gates

- Drop a line that becomes whitespace-only instead of leaving a blank run,
  collapse three or more newlines to two, trim leading blank lines, keep the
  trailing newline.
- Run the repo gates after the pass (typecheck, lint, tests, build) and report
  the counts, not the impression.
- Say what is being lost before deleting anything: comments carry the *why* (an
  SSRF limit, a workaround tied to one bug, an ordering constraint). Code
  recovers *what*; the reason does not come back. Move the load-bearing ones
  into the commit message or an ADR first.

## Scripts

- `scripts/strip_code_comments.cjs` collects and strips TS, TSX and JS, and
  exports `collectComments`, `cutRanges`, `strip`, `tokens`, `mergeRanges`.
- `scripts/strip-comments.cjs` walks a tree, dry run by default, `--apply` to
  write, `--list` to show what would change. It needs the TypeScript compiler
  on `NODE_PATH`: `NODE_PATH=<project>/node_modules node scripts/strip-comments.cjs <root>`.
- `scripts/prove_comment_only.cjs` proves a diff is comment-only against HEAD.
- `scripts/strip_py.py`, `scripts/strip_sh.py` and `scripts/strip_cfg.py` cover
  Python, shell, and Dockerfile or YAML.

## See also

- `../refactoring-safety-checks/SKILL.md` for verifying a refactor preserves
  behaviour.
- `../code-review/SKILL.md` for reviewing the resulting diff.

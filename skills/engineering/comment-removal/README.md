# Comment Removal

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Strip every comment from a codebase while proving that not one byte of executable code changed, and keep the directives that tools actually read.

## What it does

Deleting comments is easy to do badly. The failure modes are silent: a scanner that mis-reads template literals, a `//` inside a URL string treated as a comment, a JSX comment wrapper whose removal merges two text nodes, a directive deleted along with the prose around it. This skill collects comments from real parsers, verifies every edit against the code token stream, and reports what it refused to touch.

- **Parser-driven collection.** Comments are found by enumerating `//` and `/*` occurrences and excluding the ranges any parser calls a literal (string, template, regex, JSX text). A bare lexer gets template literals wrong and hides every comment after the first backtick.
- **Proof before write.** Each file's significant-token stream is compared before and after. A file that fails is left exactly as it was and reported by name.
- **Diff-level proof.** `prove_comment_only.cjs` strips the committed version of each changed file and requires a byte-identical match with the working tree, which shows the whole change set is comment removal.
- **Functional directives survive.** `eslint-disable`, `@ts-expect-error`, `prettier-ignore`, `v8 ignore`, `@__PURE__`, `/// <reference>`, shebangs, Dockerfile parser directives, `# shellcheck`.
- **Language-appropriate handling.** TypeScript and JavaScript through the TypeScript compiler, Python through `tokenize` with AST equality, shell, Dockerfile and YAML through whole-line rules with `bash -n` and `yaml.safe_load` checks.
- **Whitespace cleanup.** Lines that were only a comment disappear instead of leaving blank runs, so the stripped file reads as if it was written that way.

## When to use this

Load this skill when:

- You are asked to remove comments across a repo, a package, or a language subtree.
- You inherited code with commented-out blocks and want them gone without touching behaviour.
- You need evidence, not assurances, that an automated cleanup changed nothing but comments.
- You are stripping one language and want the directives list for it before you start.

Do not load it for trimming a single stray comment, and do not run it on a directory you have not committed or copied first.

## Quick start

```bash
NODE_PATH=<project>/node_modules node scripts/strip-comments.cjs <root>
NODE_PATH=<project>/node_modules node scripts/strip-comments.cjs --list <root>
NODE_PATH=<project>/node_modules node scripts/strip-comments.cjs --apply <root>

python3 scripts/strip_py.py <root>
python3 scripts/strip_py.py <root> --apply
python3 scripts/strip_sh.py <files...> [--apply]
python3 scripts/strip_cfg.py Dockerfile docker-compose.yml .github/workflows/*.yml [--apply]

node scripts/prove_comment_only.cjs <repo> <path-prefix>
```

Every script verifies before writing and skips a file that fails, so a dry run over the whole tree is cheap and tells you the exact damage list. `--apply` writes only what already passed verification.

## Key concepts

- **Candidate plus exclusion.** Find the markers, subtract the parser's literal ranges. This survives template literals, regex literals, and interpolations, all of which defeat naive scanners.
- **Significant-token equality.** Two files are equivalent for this purpose when their parser token streams match after whitespace and JSX-text normalization. That is the guarantee that gets reported, not a diff review.
- **Protected ranges.** Comments matching an execution directive or a generated-file banner are kept and listed, so you can see why a file still has a comment after the pass.
- **JSX text adjacency.** A comment wrapper between two text nodes is skipped, because dropping it merges the nodes and changes rendered whitespace.
- **Docstrings are not comments.** In Python they are strings, and `__doc__` reaches argparse help text, printed usage, and doctests. The Python pass keeps them.
- **Generated files stay generated.** A file that a tool rewrites keeps coming back with its banner; treat that as a build step, not a cleanup target.

## Common pitfalls

- **Stripping before committing.** Always have the pre-strip tree in git or in a copy: it is what you compare against and what you revert to.
- **Trusting a scanner.** If the comment count from a tool disagrees with `grep -c '//'`, the tool is wrong, not the grep.
- **Removing directives.** An `eslint-disable-next-line` deleted as prose turns a green lint run into a failing one, which is why directives are matched before anything is cut.
- **Assuming comments are worthless.** Comments carry the reason a constraint exists. Code recovers what it does, never why. Move the load-bearing reasons into the commit message or an ADR before deleting them.
- **Skipping the gates.** Token equality proves the syntax, not the system. Run typecheck, lint, tests and build afterwards and report the counts.
- **YAML block scalars.** In `run: |` blocks the lines are data, so a `#` there is content. Verification drops the file if data changes.

## See also

- `../refactoring-safety-checks/SKILL.md` for the general procedure behind behaviour-preserving edits.
- `../code-review/SKILL.md` for reviewing the resulting diff.

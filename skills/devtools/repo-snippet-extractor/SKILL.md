---
name: repo-snippet-extractor
description: Use when a doc embeds code from a repo. Extract snippets by anchor, verify them in CI so they never drift.
---

Pull code examples out of real, compiled, tested source files instead of typing
them into markdown by hand. Every snippet in a doc points at a named region of a
file that the build already checks, and a CI job fails when the doc copy and the
source region disagree.

## When to use

- A README, tutorial, or docs site shows code that also exists in the repo
- A published example broke after a rename, a signature change, or a new required argument
- You are about to paste a function body into markdown
- A docs reviewer cannot tell whether an example still compiles
- Not for: prose-only docs, shell transcripts of one-off commands, or code that
  deliberately shows a broken pattern with no runnable counterpart

## Rules

- Extract from a file the test suite or the compiler already covers, because an
  example that nothing runs is a guess with syntax highlighting.
- Anchor by name, never by line number. `#charge` survives an insertion above
  it; `L14-L22` silently shifts to the wrong lines.
- Put the anchor comment in the source language's own comment syntax
  (`# snip:start charge`, `// snip:start charge`), so it never breaks a build.
- Keep the extracted text in the doc, not a build-time include, because a
  reader on GitHub, npm, or PyPI sees raw markdown with no build step.
- Run the extractor in check mode in CI and fail the job on drift. An extractor
  that only runs when someone remembers is not a guarantee.
- Name anchors after the concept the doc teaches (`retry-policy`), not the
  symbol (`_do_retry_v2`), so a rename does not invalidate the doc's own text.
- Extract whole callable units. A snippet that starts mid-function forces the
  reader to reconstruct the indentation and the enclosing signature.
- Dedent the region on extraction. A method extracted from a class arrives with
  four leading spaces and reads as broken code.
- Keep imports in the snippet when the reader needs them to run it, either by
  putting them inside the anchored region or by anchoring a second `#imports`
  region shown above it.
- Never hand-edit inside a snippet fence. The next `--write` overwrites it, so
  an edit that matters belongs in the source file.
- Cap a snippet at roughly 25 lines. Past that, split the source function or
  link to the file, because nobody reads a 90-line example.
- Redact nothing after extraction. If the source holds a real key, the bug is
  in the source, and a redaction step teaches the doc to lie.

## Workflow

1. Find or create the runnable source. If the doc's example does not exist as
   tested code, write it into `examples/` and add a test before writing the doc.
2. Mark the region in that file:

   ```python
   # snip:start charge
   def charge(client: httpx.Client, amount_cents: int) -> str:
       resp = client.post("/v1/charges", json={"amount": amount_cents}, timeout=10)
       resp.raise_for_status()
       return resp.json()["id"]
   # snip:end charge
   ```

3. Reference it from the doc with an empty fence:

   ````markdown
   <!-- snip: src/pay.py#charge -->
   ```python
   ```
   ````

4. Fill every fence: `python3 scripts/snip.py --write`.
5. Verify: `python3 scripts/snip.py --check` exits 0 and prints nothing.
6. Wire the check into CI next to lint, so a source change that outdates a doc
   fails the same pull request that caused it.

A ~40-line extractor is enough, and README.md carries a complete working one:
it rewrites the body of each fence tagged with `<!-- snip: PATH#ANCHOR -->`,
and in `--check` mode prints every drifted `doc: path#anchor` and exits 1.

## Choosing the mechanism

Use the plainest tool that gives a CI failure on drift.

| Situation | Mechanism |
| --- | --- |
| Markdown in a repo, any language | Anchor comments plus an extractor script, committed output |
| Rust crate docs | `#[doc = include_str!(...)]` plus doctests, which `cargo test` already runs |
| Python package docs | Sphinx `literalinclude` with `:start-after:`/`:end-before:` |
| Docusaurus or MDX site | A remark plugin reading the same anchor comments |
| Go module | Example functions in `_test.go`, rendered by pkg.go.dev |

Prefer the language's native mechanism when one exists, because it runs inside a
test command people already invoke. Fall back to the script when the doc must
render correctly as plain markdown on GitHub.

## Counter-examples

Vague: keep the docs in sync with the code.
Actionable: every fence in `docs/` carries a `<!-- snip: -->` tag and
`snip.py --check` runs in CI; drift fails the build.

Vague: reference the code instead of copying it.
Actionable: anchor `# snip:start charge` in `src/pay.py`, tag the fence
`<!-- snip: src/pay.py#charge -->`, commit the extracted body.

Vague: make sure examples work.
Actionable: the extracted region lives in a file covered by `pytest tests/`, so
a signature change breaks a test before it reaches the doc.

## Anti-patterns

**Line-range extraction.**
Bad: `<!-- snip: src/pay.py#L14-L22 -->`
Good: `<!-- snip: src/pay.py#charge -->`
Reason: adding one import above shifts every range in the file, and nothing
reports it because the extraction still succeeds.

**Build-time includes with no committed output.**
Bad: an MDX `<CodeFrom file="src/pay.py" />` that only resolves on the docs site
Good: committed snippet text kept fresh by a checked extractor
Reason: GitHub, PyPI, and npm render the raw file, so the reader sees a tag
instead of code.

**Extracting from a scratch file.**
Bad: anchors in `examples/demo.py`, excluded from lint and tests
Good: `examples/` on the test path, with a test that imports and runs it
Reason: an uncovered example rots exactly as fast as a hand-typed one, and now
it also looks authoritative.

**Anchors nested inside each other.**
Bad: `snip:start full` wrapping `snip:start inner`
Good: two sibling regions, or one region plus a second file
Reason: a naive extractor emits the inner marker lines into the doc, and a
strict one silently truncates at the first `snip:end`.

**Trimming the snippet to fit.**
Bad: deleting the error branch from the extracted text so it reads cleanly
Good: restructuring the source function until the honest extraction is short
Reason: any edit inside the fence is erased by the next write, and a reader who
copies the trimmed version ships code with no error handling.

**Duplicating an anchor name across files.**
Bad: `snip:start config` in three modules
Good: `snip:start client-config`, `snip:start server-config`
Reason: the doc tag carries a path, but a human searching the repo for the
anchor finds the wrong region and edits it.

**Skipping the check in CI because "the writer will rerun it".**
Bad: a make target nobody invokes
Good: the same `--check` command in the lint job
Reason: drift is introduced by the person changing the code, who is not reading
the docs at that moment.

**Snippets of output instead of source.**
Bad: a fenced block of a CLI's help text, typed by hand
Good: anchor the test that asserts that help text, or generate the block from
`--help` in the same script
Reason: flag text changes more often than function signatures, and nothing
tests a paragraph.

## See also

- README.md: a complete extractor script plus a worked drift-to-green run.

# Repo Snippet Extractor

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Embed code in docs by extracting it from real source files at named anchors, then fail CI when the doc copy and the source disagree.

## What it does

A code example typed into markdown is a fork of your codebase that nothing compiles, nothing tests, and nobody reruns. It is correct on the day it is written and wrong on the day someone adds a required argument. This skill replaces hand-typed examples with extraction: the doc names a region of a real file, a script copies that region into the fence, and a check job compares the two on every pull request.

Three things make it work:

- **Named anchors, not line numbers.** `# snip:start charge` moves with the code. `#L14-L22` silently drifts the moment anyone adds an import.
- **Committed output.** The extracted text lives in the markdown file, so GitHub, npm, and PyPI render real code with no build step.
- **A check mode that exits non-zero.** Drift is introduced by whoever changes the source, and it has to fail their build, not the docs writer's memory.

## When to use this

Reach for this skill when:

- A README or tutorial shows code that also exists in the repo
- A published example broke after a rename or a signature change
- You are about to paste a function body into markdown
- A reviewer cannot tell whether a doc example still compiles
- A docs site and a quickstart show the same snippet in two slightly different forms

Skip it when:

- The doc has no code, or only shell transcripts of one-off commands
- The snippet deliberately shows a broken pattern with no runnable counterpart
- Your language already runs doc examples as tests (Rust doctests, Go examples, Python doctest); use that instead, it is strictly better

## Quick start

A complete run, from drifted doc to green check.

**Step 1. Mark the region in the source file.** The comment is in the file's own language, so nothing breaks:

```python
# src/pay.py
import httpx

def unrelated():
    pass

# snip:start charge
def charge(client: httpx.Client, amount_cents: int) -> str:
    resp = client.post("/v1/charges", json={"amount": amount_cents}, timeout=10)
    resp.raise_for_status()
    return resp.json()["id"]
# snip:end charge
```

**Step 2. Tag the fence in the doc.** The body can be empty or stale, it will be overwritten:

````markdown
# Payments

<!-- snip: src/pay.py#charge -->
```python
stale content
```
````

**Step 3. Drop in the extractor** as `scripts/snip.py`:

```python
#!/usr/bin/env python3
# Usage: python3 scripts/snip.py --check | python3 scripts/snip.py --write
# Replaces every fenced block in docs marked with <!-- snip: PATH#ANCHOR --> by
# the anchored region of that source file.
import re, sys, textwrap, pathlib

DOC_RE = re.compile(
    r"(<!-- snip: (?P<src>[^#\s]+)#(?P<anchor>\S+) -->\n```(?P<lang>[\w-]*)\n)"
    r"(?P<body>.*?)(?P<close>```)",
    re.S,
)

def region(src: pathlib.Path, anchor: str) -> str:
    start = re.compile(rf"snip:start {re.escape(anchor)}\b")
    end = re.compile(rf"snip:end {re.escape(anchor)}\b")
    out, inside = [], False
    for line in src.read_text().splitlines():
        if end.search(line):
            inside = False
        elif inside:
            out.append(line)
        elif start.search(line):
            inside = True
    if not out:
        raise SystemExit(f"error: anchor {anchor!r} not found in {src}")
    return textwrap.dedent("\n".join(out)).strip("\n") + "\n"

def main(write: bool) -> int:
    drift = 0
    for doc in pathlib.Path(".").rglob("*.md"):
        text = doc.read_text()
        def sub(m):
            nonlocal drift
            body = region(pathlib.Path(m["src"]), m["anchor"])
            if body != m["body"]:
                drift += 1
                print(f"drift: {doc}: {m['src']}#{m['anchor']}")
            return m[1] + body + m["close"]
        new = DOC_RE.sub(sub, text)
        if write and new != text:
            doc.write_text(new)
    return 1 if drift and not write else 0

if __name__ == "__main__":
    sys.exit(main(write="--write" in sys.argv))
```

**Step 4. Run it.** Check mode reports drift and exits 1:

```console
$ python3 scripts/snip.py --check
drift: doc.md: src/pay.py#charge
$ echo $?
1
```

Write mode fixes it, and the recheck is silent:

```console
$ python3 scripts/snip.py --write
drift: doc.md: src/pay.py#charge
$ python3 scripts/snip.py --check
$ echo $?
0
```

`doc.md` now holds the real function, dedented, with the anchor comments stripped:

````markdown
# Payments

<!-- snip: src/pay.py#charge -->
```python
def charge(client: httpx.Client, amount_cents: int) -> str:
    resp = client.post("/v1/charges", json={"amount": amount_cents}, timeout=10)
    resp.raise_for_status()
    return resp.json()["id"]
```
````

**Step 5. Gate it in CI**, in the same job as lint so it fails the pull request that caused it:

```yaml
- name: Docs snippets in sync
  run: python3 scripts/snip.py --check
```

## Key concepts

**Anchor**: a named region delimited by `snip:start NAME` and `snip:end NAME` comments in the source language. Names the concept the doc teaches (`retry-policy`), not the symbol (`_do_retry_v2`), so renaming the function does not invalidate the surrounding prose.

**Drift**: the doc's copy no longer equals the extracted region. It is not detectable by reading the doc; only a byte comparison finds it, which is why check mode is the whole point.

**Check vs write**: `--write` is the author's command, `--check` is CI's. Never run `--write` in CI, because a job that silently repairs docs hides the fact that an example changed meaning.

**Committed output**: the extracted text is stored in markdown, unlike a build-time include. Costs a slightly noisy diff, buys correct rendering everywhere markdown is read raw.

**Source coverage**: the extracted file must be on the test or compile path. Extraction guarantees the doc matches the source; only tests guarantee the source is right. Both are needed.

**Dedent**: a region taken from inside a class or function arrives indented. Stripping the common prefix is what makes a method extract as copy-pasteable code.

## Common pitfalls

**Extracting by line range.**
Bad: `<!-- snip: src/pay.py#L14-L22 -->`
Good: `<!-- snip: src/pay.py#charge -->`
Reason: one added import shifts every range, and extraction still succeeds, so nothing reports the now-wrong snippet.

**Build-time includes with no committed text.**
Bad: `<CodeFrom file="src/pay.py" />` resolved only by the docs site
Good: committed snippet text refreshed by a checked extractor
Reason: GitHub, PyPI, and npm render raw markdown, so a reader outside the docs site sees a tag where the code should be.

**Anchoring a scratch file.**
Bad: anchors in `examples/demo.py`, excluded from lint and tests
Good: `examples/` on the test path with a test that imports and runs it
Reason: an untested example rots as fast as a hand-typed one, and now it carries the authority of being extracted.

**Nesting anchors.**
Bad: `snip:start full` wrapping `snip:start inner`
Good: two sibling regions, or one region plus a helper file
Reason: a naive extractor emits the inner marker lines into the doc; a strict one truncates at the first `snip:end`.

**Editing inside the fence.**
Bad: deleting the error branch from the extracted block so the example reads cleanly
Good: restructuring the source until an honest extraction is short
Reason: the next `--write` erases the edit, and a reader who copied it in the meantime ships code with no error handling.

**Reusing an anchor name across files.**
Bad: `snip:start config` in three modules
Good: `client-config`, `server-config`, `test-config`
Reason: the doc tag disambiguates by path, but a human grepping for the anchor lands in the wrong file and edits it.

**Running `--write` in CI.**
Bad: a job that rewrites docs and commits the result
Good: `--check` that fails the build
Reason: auto-repair hides a changed example from review, which is precisely the change a reviewer needs to see.

**Snippets longer than a screen.**
Bad: a 90-line anchored region covering a whole module
Good: anchor the 15-line core and link to the file for the rest
Reason: readers skim examples; past roughly 25 lines the snippet stops teaching and starts intimidating.

**Anchors placed in a language with no line comments at that spot.**
Bad: a `<!-- -->` marker inside a JSON fixture
Good: extract from a `.jsonc`/`.ts` source, or keep the marker in a sidecar manifest
Reason: an invalid comment breaks the parser that was supposed to validate the example.

**Redacting after extraction.**
Bad: a post-processing step that swaps a real key for `sk-...`
Good: fix the source to use an env var
Reason: a redaction step means a live secret is sitting in a tracked file, and the doc now teaches a pattern the code does not follow.

**Forgetting imports.**
Bad: a snippet using `httpx.Client` with no import in sight
Good: a second anchored `#imports` region shown above it
Reason: the smallest possible snippet is not the most useful one; the reader has to be able to run it.

## See also

- [technical-writing](../../writing/technical-writing/README.md) - what the prose around the snippet should say
- [technical-writing](../../writing/technical-writing) - generating the doc that these snippets land in
- [test-strategy](../../engineering/test-strategy/README.md) - making the extracted source actually covered
- [ci-cd-debugging](../../devops/ci-cd-debugging/README.md) - wiring the check job and diagnosing its failures

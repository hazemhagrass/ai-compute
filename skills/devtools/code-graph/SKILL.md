---
name: code-graph
description: Use when navigating a codebase too big to grep. Builds and queries a real dependency graph.
---

Grep answers "where does this string appear". A code graph answers "what breaks if I
change this". On a codebase past a few hundred files, the second question is the one
that matters, and no amount of similarity search produces a reliable answer to it.

Build the graph from a parser, store it as data, query it with traversal, and verify
every answer against the source before acting on it.

## When to build a graph

Build one when at least two of these are true:

- The repository has more than ~300 source files or ~50k lines.
- You are about to change a widely used symbol and need the blast radius.
- You are onboarding to code nobody on the call wrote.
- Grep for a symbol returns more than ~40 hits.
- The question is structural: cycles, layering violations, dead code, God objects.

Do not build one when a single `rg` answers the question, when the repo is small
enough to read, or when the question is about behaviour at runtime rather than
structure. A graph is a cache, and a cache you build for one question is waste.

## The three layers

Build only the layers the question needs. Each one costs more than the last.

| Layer | Nodes | Edges | Answers |
|---|---|---|---|
| **Module** | files, packages | imports, requires | cycles, layering, coupling, "what depends on this package" |
| **Symbol** | functions, classes, methods, types | defined-in, references | "where is this really used", dead code, API surface |
| **Call** | functions, methods | calls, overrides, implements | blast radius, entry-point reachability, recursion |

Module graphs are cheap and near-exact. Call graphs are expensive and always
incomplete, because dynamic dispatch exists. Never present a call graph as if it
were complete (see *Unresolved edges are data*).

## Extraction: use a parser, never a regex

Pick the extractor by language. Every one of these reads a real syntax tree or a
compiler index:

```bash
# JS / TS: module graph
madge --json --extensions ts,tsx,js,jsx src > .codegraph/modules.json
madge --circular --extensions ts,tsx src          # cycles, exits non-zero if any
depcruise --output-type json src > .codegraph/depcruise.json

# JS / TS: symbol + call layer via a compiler index
scip-typescript index --output .codegraph/index.scip
scip print --json .codegraph/index.scip > .codegraph/scip.json

# Python
pydeps <pkg> --show-deps --no-output > .codegraph/modules.json
pyan3 $(git ls-files '*.py') --dot --colored > .codegraph/calls.dot
scip-python index --output .codegraph/index.scip   # when you need references

# Go
go list -deps -json ./... > .codegraph/pkgs.json
go mod graph > .codegraph/modgraph.txt

# Java / JVM
jdeps -verbose:class -dotoutput .codegraph build/libs/app.jar

# Rust
cargo tree --edges normal --prefix depth
cargo modules structure --bin <name>

# Any language, symbol layer only
ctags -R --output-format=json --fields=+neKlSz -f .codegraph/tags.json .
```

When no tool covers the language, use `tree-sitter` with the grammar's `tags.scm`
query rather than writing a regex extractor. A regex extractor silently misses
re-exports, aliased imports, decorators and multiline signatures, and you will not
find out until an answer is wrong.

Two structural signals do not come from a parser and are worth adding:

```bash
# Temporal coupling: files that change together are coupled even without an import
git log --format='%H' --name-only --since='18 months ago'
```

## Storage

Store the graph as queryable data in `.codegraph/` at the repo root. SQLite is the
right default: it survives a graph bigger than memory and gives recursive traversal
for free.

```sql
CREATE TABLE nodes (
  id     TEXT PRIMARY KEY,   -- 'src/billing/invoice.ts::InvoiceService.charge'
  kind   TEXT NOT NULL,      -- file | module | class | function | method | unresolved
  path   TEXT,               -- repo-relative, POSIX separators, never absolute
  name   TEXT,
  line   INTEGER,
  lang   TEXT
);
CREATE TABLE edges (
  src    TEXT NOT NULL REFERENCES nodes(id),
  dst    TEXT NOT NULL REFERENCES nodes(id),
  kind   TEXT NOT NULL,      -- imports | calls | references | implements | overrides
  path   TEXT, line INTEGER, -- where the edge was observed
  confidence TEXT NOT NULL DEFAULT 'exact'  -- exact | inferred | unresolved
);
CREATE INDEX edges_dst ON edges(dst, kind);
CREATE TABLE manifest (commit_sha TEXT, built_at TEXT, tool TEXT, layers TEXT);
```

Rules that keep the store usable:

- **Node ids are `relative/path::Symbol.member`.** Absolute paths break the moment
  anyone else clones the repo, and a bare symbol name collides across files.
- **Store data, not pictures.** A `.svg` or `.png` is a rendering of one slice at
  one moment. Render on demand from the data; never treat the image as the graph.
- **Gitignore `.codegraph/`.** It is a build artefact derived from the tree. Commit
  the build command, not the output.
- **Record the commit in `manifest`.** Every answer depends on it.

## Staleness is a correctness bug

A graph built two hundred commits ago answers confidently and wrongly, which is
worse than having no graph.

Before answering any query:

```bash
built=$(sqlite3 .codegraph/graph.db 'SELECT commit_sha FROM manifest')
git merge-base --is-ancestor "$built" HEAD || echo "STALE: rebuild required"
git diff --name-only "$built"..HEAD -- '*.ts' '*.py' | head
```

If files in the graph's language changed since `built`, rebuild before answering, or
state the staleness in the answer. Keep it fresh automatically:

- A pre-push hook or a CI job that rebuilds and uploads the artefact.
- Incremental rebuild where the tool supports it: re-extract only the files in
  `git diff --name-only`, delete their outgoing edges, reinsert.

## Querying

Traversal is the point. These are the queries worth having ready.

**Blast radius (reverse reachability, bounded depth).** What calls this, transitively:

```sql
WITH RECURSIVE impact(id, depth) AS (
  SELECT :target, 0
  UNION
  SELECT e.src, impact.depth + 1
  FROM edges e JOIN impact ON e.dst = impact.id
  WHERE impact.depth < 4 AND e.kind IN ('calls', 'references')
)
SELECT depth, id FROM impact WHERE depth > 0 ORDER BY depth, id;
```

Bound the depth. Unbounded reverse reachability in a connected codebase returns
most of the repo and tells you nothing.

**Import cycles:**

```bash
madge --circular --extensions ts,tsx src
```

**Dead code candidates.** Symbols with no inbound edges, minus the real roots
(exported API, CLI entry points, test files, framework-invoked handlers, anything
reached by reflection). Never delete on this list alone; it is a shortlist to
verify, not a verdict.

```sql
SELECT n.id FROM nodes n
LEFT JOIN edges e ON e.dst = n.id
WHERE e.src IS NULL AND n.kind IN ('function','method','class')
  AND n.path NOT LIKE '%test%';
```

**Change hot spots.** Highest fan-in nodes are where an incident will start:

```sql
SELECT dst, COUNT(*) AS fan_in FROM edges GROUP BY dst ORDER BY fan_in DESC LIMIT 20;
```

**Layering violations.** Assert the architecture instead of describing it, and run
the assertion in CI:

```sql
SELECT e.src, e.dst FROM edges e
WHERE e.src LIKE 'src/domain/%' AND e.dst LIKE 'src/infra/%';
-- expected: zero rows. Any row is a violation with a file and a line.
```

## Unresolved edges are data

Every call graph is missing edges. Dynamic dispatch, dependency injection,
reflection, string-keyed registries, event buses, decorators and `eval` all break
static resolution.

Record what you could not resolve as a node of kind `unresolved` with
`confidence='unresolved'`, and surface the count with every traversal answer.
Dropping the unresolved call site turns "I could not see through this" into "nothing
calls this", which is how a graph-driven deletion takes production down.

```
Blast radius of InvoiceService.charge: 14 direct callers, 31 transitive (depth <= 4).
3 unresolved call sites reach this symbol through the handler registry in
src/bus/registry.ts:88. Review those by hand.
```

## Verify before you act

The graph is an index, not a source of truth. Before you report a finding or change
code on the strength of it, open the actual lines.

```bash
sqlite3 .codegraph/graph.db "SELECT path, line FROM edges WHERE dst = 'src/billing/invoice.ts::charge'"
# then read each hit
rg -n 'charge' src/api/checkout.ts
```

An answer that cites a file and a line someone can open is checkable. An answer that
cites "the graph" is not.

## Output format

```
Graph: 1,204 files, 8,930 symbols, 24,117 edges
Built at a1b3f9c (HEAD, current), layers: module + symbol + call

Question: what breaks if InvoiceService.charge changes signature?

Direct callers (4):
  src/api/checkout.ts:142        POST /checkout handler
  src/api/retry.ts:33            nightly retry job
  src/jobs/dunning.ts:91         dunning worker
  test/invoice.test.ts:210       unit test

Transitive, depth <= 3 (31 symbols across 12 files). Highest risk:
  src/api/checkout.ts            public HTTP surface, no other caller path
  src/jobs/dunning.ts            runs unattended, failures are silent

Unresolved (2): src/bus/registry.ts:88 dispatches by string key. Grep 'charge' there.

Suggested order: change the signature, then the 4 direct callers, then re-run
the graph build and re-query before touching anything transitive.
```

## Visualise a slice, never the whole thing

A rendering of 1,200 nodes is a hairball and communicates nothing. Render only a
bounded slice, and only when a human needs to see the shape:

```bash
# 2 hops around one symbol, rendered
sqlite3 .codegraph/graph.db < queries/neighbourhood.sql > slice.dot
dot -Tsvg slice.dot -o slice.svg
```

Keep any rendered graph under roughly 50 nodes. Above that, cluster by directory and
render the cluster graph instead.

## What NOT to do

- Do not build the graph with regex over source text. Use a parser or a compiler index.
- Do not answer from a graph whose commit is not an ancestor of `HEAD`.
- Do not report a call graph as complete. Report the unresolved count alongside it.
- Do not delete code because the graph shows zero inbound edges. Check entry points,
  reflection, framework registration and public API first.
- Do not commit `.codegraph/` output. Commit the command that rebuilds it.
- Do not render more than about 50 nodes in one image.
- Do not build all three layers by default. Build the cheapest layer that answers
  the question asked.
- Do not use absolute paths in node ids.

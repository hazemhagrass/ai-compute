# code-graph

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Builds a real dependency graph of a codebase (imports, symbols, calls) so structural questions get traversal answers instead of a pile of grep hits.

## What it does

`code-graph` turns a repository into queryable data and then queries it.

1. **Decides whether a graph is worth building.** Two of: more than ~300 files, a widely used symbol about to change, unfamiliar code, a grep returning 40+ hits, or a genuinely structural question (cycles, layering, dead code).
2. **Extracts with a parser, never a regex.** `madge` and `dependency-cruiser` for JS/TS modules, `scip-typescript` and `scip-python` for symbol and reference layers, `pydeps` and `pyan3` for Python, `go list -deps` for Go, `jdeps` for the JVM, `cargo modules` for Rust, `tree-sitter` tags queries for anything else.
3. **Builds only the layer the question needs.** Module (files and imports, cheap and near-exact), symbol (definitions and references), call (who calls whom, expensive and always incomplete).
4. **Stores it in SQLite** under `.codegraph/`, with node ids of the form `relative/path::Symbol.member`, an edge `confidence` column, and a `manifest` row recording the commit the graph was built at.
5. **Checks staleness before every answer.** If the manifest commit is not an ancestor of `HEAD` and files in the relevant language changed, it rebuilds or states the staleness.
6. **Answers by traversal.** Bounded reverse reachability for blast radius, cycle detection, fan-in ranking for hot spots, zero-inbound-edge shortlists for dead code, and SQL assertions for layering rules.
7. **Reports unresolved edges as a first-class number**, because dynamic dispatch, DI containers, reflection and string-keyed registries are invisible to static extraction.
8. **Cites files and lines** so the answer can be opened and checked.

## When to use this

Use it when:

- You are about to change a function, type, or endpoint that a lot of code depends on and you need the blast radius before you start.
- You inherited a codebase and need its real shape rather than the shape in the architecture diagram.
- You suspect an import cycle, a layering violation (domain reaching into infrastructure), or a God module.
- You are hunting dead code and want a shortlist grounded in edges rather than intuition.
- An AI assistant keeps giving plausible-sounding but wrong answers about a large repo, because similarity search over file chunks has no notion of "depends on".

Do not use it when:

- A single `rg` answers the question. Building a graph for one lookup is pure overhead.
- The repository is small enough to read end to end.
- The question is about runtime behaviour (why is this slow, why did this throw) rather than structure. Use a profiler or a debugger.

## Quick start

A TypeScript service, 1,200 files. The task is changing the signature of `InvoiceService.charge`, and grep for `charge` returns 137 hits across tests, comments, and unrelated payment code.

Build the module and symbol layers:

```bash
mkdir -p .codegraph
madge --json --extensions ts,tsx src > .codegraph/modules.json
scip-typescript index --output .codegraph/index.scip
scip print --json .codegraph/index.scip > .codegraph/scip.json
node scripts/load-graph.mjs   # normalises both into .codegraph/graph.db
```

Confirm the graph matches the working tree before trusting it:

```bash
built=$(sqlite3 .codegraph/graph.db 'SELECT commit_sha FROM manifest')
git merge-base --is-ancestor "$built" HEAD && echo fresh
```

Query the blast radius:

```sql
WITH RECURSIVE impact(id, depth) AS (
  SELECT 'src/billing/invoice.ts::InvoiceService.charge', 0
  UNION
  SELECT e.src, impact.depth + 1
  FROM edges e JOIN impact ON e.dst = impact.id
  WHERE impact.depth < 3 AND e.kind IN ('calls', 'references')
)
SELECT depth, id FROM impact WHERE depth > 0 ORDER BY depth, id;
```

The answer:

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

137 grep hits collapsed to 4 call sites you must edit, 2 you must inspect by hand, and a named risk (the dunning worker fails silently). The last step before editing is opening `src/api/checkout.ts:142` and confirming the graph was right.

## Key concepts

### The graph is an index, not an oracle

Every answer is a hypothesis that a parser produced. Open the file and the line before you act on it. An answer that cites `src/api/checkout.ts:142` can be checked in five seconds; an answer that cites "the graph" cannot be checked at all, and an unverifiable answer about a change to production code is worth less than no answer.

### Build the cheapest layer that answers the question

Module graphs are fast, near-exact, and settle most architectural questions: cycles, coupling, layering. Symbol graphs cost a compiler index. Call graphs cost the most and are the least complete. Building all three because the tooling offers all three wastes minutes on every rebuild and buries the answer you wanted in noise.

### Unresolved edges are data, not omissions

Dynamic dispatch, DI containers, reflection, decorators, event buses, and string-keyed registries are invisible to static analysis. Recording them as `confidence='unresolved'` nodes and reporting the count with every traversal is the difference between "I could not see through this" and "nothing calls this". The second sentence is how a graph-driven deletion takes production down.

### Staleness is a correctness bug, not hygiene

A graph built 200 commits ago answers confidently and wrongly. Checking `git merge-base --is-ancestor` against the manifest commit costs milliseconds and is the single highest-value guard in the workflow. A stale graph is more dangerous than no graph, because it carries the authority of a tool.

### Store data, render slices

The graph is rows in a table. A `.svg` is one slice at one moment, and a rendering of 1,200 nodes is a hairball nobody can read. Render two hops around a symbol, keep it under about 50 nodes, and cluster by directory when it grows past that.

### Node ids must be portable

`relative/path::Symbol.member` survives a clone on another machine and disambiguates two classes with the same name in different files. An absolute path breaks for everyone but you, and a bare symbol name silently merges unrelated nodes, which corrupts every traversal that passes through them.

### Architecture rules belong in CI as assertions

"The domain layer must not import infrastructure" is a sentence in a document that nobody runs. The same rule as a SQL query that must return zero rows is a build failure with a file and a line attached. Graphs make architecture testable, and an untested rule decays.

### Temporal coupling complements static edges

Two files with no import between them that always change together are coupled anyway, usually through a shared implicit contract. `git log --name-only` surfaces that; the parser never will. It is the one signal worth adding that does not come from a syntax tree.

## Common pitfalls

### Extracting edges with a regex

Bad:

```bash
rg "^import .* from '(.*)'" -or '$1' src/**/*.ts > imports.txt
```

Good:

```bash
madge --json --extensions ts,tsx src > .codegraph/modules.json
```

The regex misses re-exports, aliased and multiline imports, dynamic `import()`, and type-only imports, and it happily matches import statements inside comments and strings. The misses are silent, so the first time you learn the graph is wrong is when an answer built on it is wrong.

### Answering from a stale graph

Bad:

```
Nothing calls parseLegacyReceipt. Safe to delete.
```

Good:

```
Graph built at 9f2c1de, which is 214 commits behind HEAD; 87 .ts files changed since.
Rebuilding before answering.
```

The confident version was true in February. The caller was added in March.

### Treating zero inbound edges as dead code

Bad:

```
Dead code (12 symbols, no callers):
  src/handlers/webhook.ts::handleStripeEvent
  ...
```

Good:

```
Dead code candidates (12 symbols, no static inbound edges). Verify each:
  src/handlers/webhook.ts::handleStripeEvent
    REACHED: registered by string key in src/bus/registry.ts:88. Not dead.
  src/util/formatLegacyDate.ts::formatLegacyDate
    No entry point, no export, no reflection. Safe to remove.
```

Framework-invoked handlers, public API exports, CLI entry points and reflection all produce zero static inbound edges. The list is a shortlist to check, never a verdict.

### Unbounded reverse reachability

Bad:

```sql
WITH RECURSIVE impact(id) AS (
  SELECT :target
  UNION SELECT e.src FROM edges e JOIN impact ON e.dst = impact.id
) SELECT * FROM impact;   -- returns 6,200 of 8,930 symbols
```

Good:

```sql
WHERE impact.depth < 4
```

In a connected codebase, everything reaches everything eventually. A result set containing most of the repository is indistinguishable from no result. Depth 3 or 4 is where the answer is still actionable.

### Committing the graph

Bad:

```bash
git add .codegraph/graph.db .codegraph/graph.svg
```

Good:

```bash
echo '.codegraph/' >> .gitignore
# commit instead: the Makefile target or CI job that rebuilds it
```

A committed graph is a binary that goes stale on the next merge and produces diff noise on every rebuild. Commit the command, not its output.

### Rendering the whole graph

Bad: `dot -Tsvg all-1204-nodes.dot -o architecture.svg`, then squinting at a black rectangle.

Good: two hops around the symbol in question, under 50 nodes, or a cluster graph of directories when the question is genuinely about the whole system.

### Reporting a call graph as complete

Bad:

```
InvoiceService.charge has exactly 4 callers.
```

Good:

```
InvoiceService.charge has 4 statically resolved callers, plus 2 unresolved
dispatch sites (src/bus/registry.ts:88) that may reach it.
```

The word "exactly" is a claim static analysis cannot support in any language with dynamic dispatch.

### Building a graph for a question grep already answers

Bad: fifteen minutes of `scip-typescript index` to find where a config constant is defined.

Good: `rg -n 'MAX_RETRIES' src/`.

The graph is a cache. A cache built for one lookup has negative value.

## See also

Sibling skills in `skills/devtools/`:

- [`regex-builder`](../regex-builder/SKILL.md) - for the grep that answers the question without a graph, and for the extraction queries a graph still cannot cover.
- [`env-doctor`](../env-doctor/SKILL.md) - graph extractors need working toolchains (`scip-typescript`, `pyan3`, `jdeps`); this is what to run when one fails to install.
- [`git-workflow`](../git-workflow/SKILL.md) - the staleness check, the pre-push rebuild hook, and the `git log --name-only` temporal coupling signal.

Elsewhere in the repo:

- [`refactoring`](../../engineering/refactoring/SKILL.md) - the blast radius is the input to a safe refactor; this is what to do with it.
- [`debugging`](../../engineering/debugging/SKILL.md) - for questions about runtime behaviour, where a static graph stops being the right tool.
- [`architecture-review`](../../engineering/architecture-review/SKILL.md) - layering violations found by graph assertions belong in the review.
- [`performance-profiling`](../../engineering/performance-profiling/SKILL.md) - a dynamic call graph from a profiler is the complement to the static one, and it sees the dispatch this skill marks unresolved.
- [`code-review`](../../engineering/code-review/SKILL.md) - reviewing a change to a high fan-in node deserves more scrutiny than the diff size suggests.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) - for turning a verified graph slice into architecture documentation that is true.

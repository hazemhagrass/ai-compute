# Performance Profiling

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

A measurement-first workflow for making slow systems fast: set a target number, benchmark, profile, fix the single biggest contributor, re-measure, stop.

## What it does

This skill replaces guess-and-optimise with an ordered loop that terminates:

1. Write down the exit condition as a number tied to a user-visible action.
2. Build a reproducible benchmark BEFORE the first edit, so "before" is a fact.
3. Profile the running system under realistic input and rank contributors.
4. Compute the theoretical ceiling of the planned fix; discard fixes that cannot reach the target.
5. Land one change, re-profile (the ranking reshuffles), repeat.
6. Stop the moment the benchmark clears the target.

It also carries the diagnostic material you need along the way: profiler and load-generator commands for Python, Node, Linux and HTTP endpoints; percentile SQL; the five culprits that explain most real slowness (N+1, missing index, unbounded result set, serial awaits, re-fetch in a render path); Postgres plan reading; frontend bundle/waterfall/re-render triage; and rules for when a cache is allowed.

## When to use this

Concrete triggers:

- A user or stakeholder says "the app got slow" and nobody has a number yet.
- A page, endpoint, job or build exceeds an SLO and you need to find out why.
- You are about to add a cache, an index, a worker pool or a `memo()` to fix a slowdown you have not yet measured.
- A dashboard mean looks fine but users complain, which usually means the tail (p99) is the problem.
- Latency went up right after a data migration or a traffic increase.
- A CI build or test suite has crept past the point where people avoid running it.
- Someone proposes a rewrite "for performance" without a profile.

Do NOT use this for: correctness bugs that merely manifest as timeouts (debug those first), or capacity planning where the answer is provisioning rather than code.

## Quick start

Scenario: `/api/search` feels slow. Target agreed with the team: **p95 under 300ms at 50 rps**.

### 1. Record the baseline before touching anything

```bash
oha -z 30s -c 50 'https://staging.example.com/api/search?q=shoes'
# Latency distribution:
#   50%  410ms
#   95%  1890ms
#   99%  3120ms
#   requests: 3640
```

Baseline p95 is 1890ms. Target is 300ms, so you need a 6.3x win. Save this output; it is the only thing that can later prove the fix worked.

### 2. Profile the live process, do not read code and guess

```bash
py-spy record --pid "$(pgrep -f 'gunicorn.*search')" --duration 30 --output flame.svg
```

The flame graph shows 71 percent of wall time inside `psycopg2` `execute`, called from `SearchView.serialize`, not from the ranking code everyone suspected.

### 3. Confirm the shape of the problem

```python
from django.db import connection, reset_queries
reset_queries()
client.get("/api/search?q=shoes")
print(len(connection.queries))   # 251 queries for 250 results  -> N+1
```

251 queries for 250 rows is the textbook signature.

### 4. Check the ceiling before committing to the fix

Queries are 71 percent of wall time. Removing them entirely caps the win at `1 / (1 - 0.71)` = 3.4x, which lands p95 around 550ms. That does NOT reach 300ms. So plan for two changes, not one, and keep the second culprit in view.

### 5. Land the first change

```python
# before: one query per result row
qs = Product.objects.filter(name__icontains=q)[:250]

# after: eager load the related rows in one round trip
qs = (Product.objects
      .filter(name__icontains=q)
      .select_related("brand")
      .prefetch_related("variants")[:250])
```

### 6. Re-measure, then re-profile

```bash
oha -z 30s -c 50 'https://staging.example.com/api/search?q=shoes'
#   95%  520ms      (was 1890ms)
```

As predicted. Re-profile: the remaining hot spot is now a single `Seq Scan` from the `icontains` filter.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM products WHERE name ILIKE '%shoes%' LIMIT 250;
-- Seq Scan on products (actual rows=1200000) Rows Removed by Filter: 1199750

CREATE INDEX CONCURRENTLY products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);
```

Confirm the index is actually used, because guessed indexes frequently are not:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM products WHERE name ILIKE '%shoes%' LIMIT 250;
-- want: Bitmap Index Scan on products_name_trgm_idx

SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes WHERE relname = 'products';
-- idx_scan = 0 means dead weight: drop it
```

### 7. Final measurement, then stop

```bash
oha -z 30s -c 50 'https://staging.example.com/api/search?q=shoes'
#   50%   88ms
#   95%  240ms   <- target cleared
#   99%  410ms
#   requests: 14980
```

p95 is 240ms against a 300ms target. Stop here. The flame graph still shows ugly frames; they are no longer your problem.

### 8. Pin the number so it cannot regress silently

```python
def test_search_speed(benchmark, client):
    assert benchmark(client.search, "shoes").count > 0
```

## Key concepts

**Target first.** Without a written number ("search p95 under 300ms at 50 rps"), optimisation never terminates, because every profile shows something imperfect.

**Attach the target to a user action.** An internal function can get 10x faster while the page stays exactly as slow.

**Amdahl's ceiling.** A fix's best possible win is bounded by the fraction of wall time it touches. Cutting 90 percent off a step that is 2 percent of runtime buys 1.8 percent overall. Compute the ceiling before you start coding.

**Optimising the wrong thing is not neutral.** The speedup is invisible, but the cache, the hand-unrolled loop and the denormalised column stay in the codebase and cost every future reader.

**Latency vs throughput are opposite problems.** Latency (one request's wall time) improves by removing serial work: parallel awaits, prefetch, fewer round trips. Throughput (requests per second) improves by reducing work per request and raising utilisation: batching, pools, more workers. Batching helps throughput and hurts latency. Name which one you are fixing before editing.

**Percentiles, never the mean.** The mean is arithmetic over a long-tailed distribution, so it hides the users who are suffering. High p50 with tight spread is a code problem; fine p50 with a blown p99 is contention or resource starvation. Always report the sample count, since a p99 over 40 requests is noise.

**The five usual culprits**, in order of frequency: N+1 queries, missing index, unbounded result set (use keyset pagination, not `OFFSET`), serial loop of awaits, and re-fetching inside a render path. Check these before deep profiling.

**Cache last.** A cache over a problem you do not understand converts a visible performance bug into an intermittent correctness bug.

## Common pitfalls

**Optimising from intuition instead of a profile**

```python
# BAD: "string concatenation in the loop must be the problem"
parts = []
for row in rows:
    parts.append(row.name)
out = "".join(parts)      # 0.3 percent of runtime; user sees nothing
```

```python
# GOOD: profile first, then fix what the profile ranked #1
# py-spy showed 71 percent in DB execute -> fix the N+1, ignore the string code
qs = Product.objects.select_related("brand").prefetch_related("variants")
```

**No before-number, so the result is unfalsifiable**

```bash
# BAD
# (edit code) -> "yeah, feels snappier now" -> ship
```

```bash
# GOOD: pinned inputs, warmup discarded, repeated runs, recorded output
hyperfine --warmup 3 --runs 10 './build.sh' | tee bench-before.txt
```

**Reporting the mean**

```sql
-- BAD: hides the tail entirely
SELECT avg(duration_ms) FROM request_log WHERE route = '/api/search';
```

```sql
-- GOOD: percentiles plus sample count
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99,
  count(*) AS n
FROM request_log
WHERE route = '/api/search' AND created_at > now() - interval '1 hour';
```

**Serial awaits over independent I/O**

```python
# BAD: n * latency
results = [await fetch(u) for u in urls]
```

```python
# GOOD: about max(latency), bounded so you do not DoS the backend
sem = asyncio.Semaphore(10)
async def guarded(u):
    async with sem:
        return await fetch(u)
results = await asyncio.gather(*(guarded(u) for u in urls))
```

**Guessing the index and never checking the plan**

```sql
-- BAD: wrong column order, so the plan ignores it and writes pay forever
CREATE INDEX ON orders (created_at, customer_id);
```

```sql
-- GOOD: equality column first, then range/sort, and verify it is hit
CREATE INDEX CONCURRENTLY orders_customer_created_idx
  ON orders (customer_id, created_at DESC);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;
-- must show: Index Scan using orders_customer_created_idx
```

**Sprinkling `memo` at a re-render storm**

```jsx
// BAD: treats the symptom; the prop identity still changes every render
const Row = memo(({ item, onPick }) => <li onClick={onPick}>{item.name}</li>);
<Row item={item} onPick={() => pick(item.id)} />
```

```jsx
// GOOD: fix the identity that caused the re-render
const onPick = useCallback((id) => pick(id), [pick]);
<Row item={item} onPick={onPick} />
```

**Caching before diagnosing**

```python
# BAD: a 60s TTL over an unexplained slowdown -> stale reads + stampede on expiry
@cache(ttl=60)
def get_dashboard(user_id): ...
```

```python
# GOOD: remove the work first; if a cache is still needed, write down
# key (tenant + user + locale), TTL, invalidation trigger, single-flight on miss
def get_dashboard(user_id):
    return Dashboard.objects.select_related("org").get(user_id=user_id)
```

**Profiling in dev and shipping to prod.** Dev has warm caches, tiny datasets and no network hops. Profile in staging with production-shaped data, or sample the live process with `py-spy` / `perf` / `--cpu-prof`.

## See also

- `SKILL.md` in this directory: the full rule set and the pre-ship checklist.
- `skills/engineering/systematic-debugging`: use when the problem is wrong behaviour, not slow behaviour.
- `skills/engineering/database-migrations`: adding an index to a large live table safely.
- Tools referenced here: `py-spy`, `perf`, `node --cpu-prof`, `clinic`, `oha`, `wrk`, `hyperfine`, `pytest-benchmark`, `pg_stat_statements`, `lighthouse`, `source-map-explorer`.

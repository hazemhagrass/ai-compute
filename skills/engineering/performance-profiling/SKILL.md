---
name: performance-profiling
description: "Use when something is slow. Measure first, fix the biggest contributor, stop at a stated target."
---

# Performance Profiling

Slowness is a measurement problem before it is a code problem. Work in this
order: define "fast enough", build a repeatable benchmark, profile, fix the
largest contributor, re-measure, stop.

## Define The Target Before You Start

- Write the exit condition down first: "search p95 under 300ms at 50 rps" or
  "cold page load LCP under 2.5s on a 4x throttled CPU". Without a number, work
  never ends: every profile shows something imperfect, so optimisation becomes
  infinite and the codebase pays interest on every clever change.
- Attach the target to a user-visible action, not an internal function: a
  function can get 10x faster while the page stays slow.
- Stop the moment the benchmark clears the target, even if the profile still
  shows ugly frames. Remaining time goes to correctness, which compounds.

## Measure First, Always

- Never optimise from intuition. Profile the running system under realistic
  input: the true bottleneck routinely sits somewhere nobody suspected (a
  logging serialiser, a DNS lookup, a JSON decode), and the code you assumed was
  hot is often 1 percent of runtime.
- Optimising the wrong thing is not neutral: the speedup is invisible, but the
  added complexity (a cache, a manual loop, a denormalised column) stays in the
  codebase permanently and costs every future reader.
- Profile where it is actually slow. Dev profiles mislead: prod has network
  hops, cold caches, noisy neighbours, real data volume.

```bash
# python: deterministic profile, sorted by cumulative time
python -m cProfile -s cumtime app.py 2>&1 | head -40

# python: sampling profiler on a live process (no restart, low overhead)
py-spy record --pid 4821 --duration 30 --output flame.svg

# node: CPU profile of a run
node --cpu-prof --cpu-prof-dir=./prof server.js   # open .cpuprofile in DevTools
npx clinic flame -- node server.js

# any linux process: where is the CPU going
perf record -F 99 -p 4821 -g -- sleep 30 && perf report
```

## Build A Reproducible Benchmark Before Changing Anything

- Create the benchmark BEFORE the first edit. Without a stable before-number,
  "it feels faster" is unfalsifiable and regressions land silently.
- Pin the inputs: fixed dataset, fixed seed, fixed concurrency, warm-up runs
  discarded. A benchmark that varies 40 percent run to run cannot detect a 20
  percent win.
- Run it at least 5 times and compare distributions, not single runs.

```bash
# HTTP endpoint, fixed duration and concurrency
oha -z 30s -c 50 https://staging.example.com/api/search?q=shoes
wrk -t4 -c50 -d30s --latency https://staging.example.com/api/search

# CLI or script wall time, repeated with warmup
hyperfine --warmup 3 --runs 10 './build.sh'

# micro-benchmark in-process (python)
python -m timeit -n 100 -r 5 -s "import app" "app.render(payload)"
```

```python
# pytest-benchmark keeps the number in CI so regressions fail the build
def test_search_speed(benchmark, client):
    assert benchmark(client.search, "shoes").count > 0
```

## Fix The Biggest Contributor First

- Rank by total contribution to wall time, then fix the top item. Amdahl's law
  is unforgiving: cutting 90 percent off a step that is 2 percent of runtime
  buys 1.8 percent overall, which no user will ever notice.
- Compute the ceiling before starting: if a step is 30 percent of runtime,
  removing it entirely caps the win at 1.43x, and if that does not reach the
  target, go find a bigger contributor.
- Re-profile after every landed change. The ranking reshuffles once the top item
  shrinks, and the next fix is usually not the one you planned.

## Latency And Throughput Are Different Problems

- Name which one you are fixing before touching code: they call for opposite
  moves, and applying the wrong one makes the other worse.
- Latency (one request's wall time) improves by removing serial work:
  parallelise awaits, prefetch, drop round trips, shrink payloads.
- Throughput (requests per second) improves by reducing work per request and
  raising utilisation: batching, connection pools, more workers.
- Batching helps throughput and hurts latency; extra concurrency helps latency
  and can crush throughput (context switching, pool exhaustion). Measure both
  before and after, so you see what you traded.

## Measure p95 And p99, Never The Mean

- Report percentiles. The mean is arithmetic over a long-tailed distribution, so
  it hides exactly the users who are suffering: 95 fast requests drown out 5
  timeouts, and the dashboard stays green while people leave.
- Watch p99 for tail causes (GC pauses, cold caches, lock contention, retries)
  and p50 for structural cost: a high p50 with tight spread is a code problem, a
  fine p50 with a blown p99 is contention or resource starvation. Always report
  the sample count too, since a p99 over 40 requests is noise.

```sql
-- percentile latency from a request log table
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99,
  count(*) AS n
FROM request_log
WHERE route = '/api/search' AND created_at > now() - interval '1 hour';
```

## The Usual Culprits, In Order Of Frequency

Check these five before deep profiling: they explain most real slowness.

1. **N+1 queries.** One query per row in a loop. Detect: count queries per
   request and compare against result size. If 50 rows produce 51 queries, that
   is it. Fix with a join or eager load.
   ```python
   # django: count queries issued during one request
   from django.db import connection, reset_queries
   reset_queries(); view(request)
   print(len(connection.queries))   # grows with row count == N+1
   # fix: Order.objects.select_related("customer").prefetch_related("items")
   ```
2. **Missing index.** A query whose cost grows linearly with table size. Detect:
   `EXPLAIN ANALYZE` shows `Seq Scan` plus a large `rows removed by filter`.
3. **Unbounded result set.** A query or API with no LIMIT that was fine at 1k
   rows and is fatal at 1M. Detect: correlate latency with table growth, and
   grep user-facing queries lacking `LIMIT`. Fix with keyset pagination
   (`WHERE id > $last ORDER BY id LIMIT 100`), not `OFFSET`, whose cost rises
   with the offset.
4. **Serial loop of awaits.** Independent I/O executed one at a time. Detect:
   request duration is roughly `n * single_call_time`. Fix by gathering.
   ```python
   # slow: serial, n * latency
   results = [await fetch(u) for u in urls]
   # fast: concurrent, about max(latency), bounded so you do not DoS the backend
   sem = asyncio.Semaphore(10)
   async def guarded(u):
       async with sem: return await fetch(u)
   results = await asyncio.gather(*(guarded(u) for u in urls))
   ```
5. **Re-fetching in a render path.** Data fetched inside a component or template
   that runs on every render or every row. Detect: React DevTools Profiler shows
   a fetch-triggered render loop, or the network tab shows the same URL repeated.
   Fix: hoist the fetch above the render, or use a request-scoped cache.

## Database: Read The Plan, Do Not Guess The Index

- Always run `EXPLAIN (ANALYZE, BUFFERS)` on the real query with real parameters
  before adding an index. Guessed indexes frequently go unused (wrong column
  order, wrong operator class, function applied to the column), and each unused
  index still costs write throughput and disk forever.
- Confirm the index is actually used after creating it: the plan must show
  `Index Scan` or `Bitmap Index Scan` naming your index, not `Seq Scan`.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;
-- want: Index Scan using orders_customer_created_idx
-- bad:  Seq Scan on orders (actual rows=1200000) + Rows Removed by Filter: 1199980

CREATE INDEX CONCURRENTLY orders_customer_created_idx ON orders (customer_id, created_at DESC);

-- is the index actually being hit? idx_scan = 0 means dead weight
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = 'orders';

-- the slowest statements overall, aggregated
SELECT calls, mean_exec_time, total_exec_time, query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

- Order composite index columns equality-first, then range/sort: `(customer_id,
  created_at)` serves the query above, `(created_at, customer_id)` does not. A
  predicate wrapped in a function (`WHERE lower(email) = $1`) skips a plain
  index, so index the expression or stop wrapping the column.

## Frontend: Bundle, Waterfall, Re-Renders

- **Bundle size**: ship less JavaScript, since parse and execute cost dominates
  on mid-range phones. Find the top offender with a bundle analyser (usually a
  date, icon, or charting library imported wholesale), then split or drop it.
  ```bash
  npx vite-bundle-visualizer          # vite
  ANALYZE=true npx next build         # next
  npx source-map-explorer 'dist/assets/*.js'
  ```
- **Waterfall requests**: chained dependent loads serialise the page. Find them
  in DevTools Network sorted by start time (staircase shapes are the bug), fix
  with preload hints, parallel fetches, or moving the join server-side.
- **Re-render storms**: a component re-rendering dozens of times per interaction
  burns the main thread. Find with React DevTools Profiler ("Highlight updates"
  plus the ranked chart) and fix the cause (new object/array/function identity
  passed as a prop, context too broad), not the symptom (sprinkled `memo`).
- Measure the user-facing metrics, not framework internals: LCP, INP, CLS via
  `npx lighthouse <url> --preset=desktop` or the web-vitals library in the field.

## Cache Last, Never First

- Add a cache only after you know why the code is slow and have exhausted
  cheaper fixes (index, batching, removing work). A cache over a problem you do
  not understand converts a visible performance bug into an intermittent
  correctness bug: stale reads, thundering herds on expiry, bugs that reproduce
  only after the TTL.
- If a cache is warranted, write down up front: exact key (including
  tenant/user/locale), TTL, invalidation trigger, and miss behaviour under load
  (single-flight, not a stampede).
- Prefer caches with cheap correctness: request-scoped memo, HTTP ETags, CDN for
  static assets. Prefer a correct slow answer to a fast wrong one, always.

## Checklist

- [ ] Target number written down, tied to a user action.
- [ ] Reproducible benchmark run before any edit.
- [ ] Profile from a realistic environment, top contributors ranked.
- [ ] Theoretical ceiling of the planned fix reaches the target.
- [ ] Latency vs throughput named explicitly.
- [ ] p50/p95/p99 plus sample count reported, not the mean.
- [ ] Five usual culprits checked; any new index confirmed used in the plan.
- [ ] No cache added before the root cause was understood.
- [ ] Re-measured after the change, stopped at the target.

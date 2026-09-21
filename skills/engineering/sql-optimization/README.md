# SQL Optimization

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

A skill for turning a slow SQL query fast by reading its execution plan, fixing the one real bottleneck, and proving the fix with before/after timings.

## What it does

Walks a five-step loop instead of guessing:

1. Measure the baseline timing.
2. Run `EXPLAIN` (or `EXPLAIN ANALYZE`) to see what the database actually does.
3. Identify the bottleneck: sequential scan, non-sargable predicate, bad join order, filesort, N+1.
4. Apply exactly ONE fix (index, query rewrite, or schema change).
5. Measure again and compare.

The skill covers eight named bottleneck classes (missing index, function on an indexed column, `SELECT *`, N+1, expensive join order, `OR` defeating indexes, `COUNT(*)` on huge tables, `DISTINCT` masking a duplicate-producing join), plus a field guide to PostgreSQL and MySQL `EXPLAIN` output and ten optimization rules.

## When to use this

Concrete triggers:

- A query takes more than 100ms and you need it under 10ms.
- `EXPLAIN` shows `Seq Scan` (PostgreSQL) or `type: ALL` (MySQL) on a table with more than ~100k rows.
- APM traces attribute request latency to database time, not app or network time.
- The slow query log or `pg_stat_statements` flags a query by total time.
- You added an index and nothing got faster (the predicate is probably non-sargable).
- Application logs show hundreds of near-identical queries differing only in one id (N+1).
- A list endpoint gets slower the deeper the page number goes (OFFSET pagination).

Skip it when:

- The query is already under 10ms.
- The table has fewer than 1000 rows, where a scan is already the fast path.
- The bottleneck is network latency or serialization, not query execution.
- You are designing a schema from scratch rather than fixing a query.

## Quick start

A dashboard endpoint lists pending orders for one customer. It takes 840ms.

**Step 1: baseline and plan (PostgreSQL)**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.total, o.created_at
FROM orders o
WHERE o.user_id = 42
  AND o.status = 'pending'
  AND DATE(o.created_at) >= '2026-09-01'
ORDER BY o.created_at DESC
LIMIT 20;
```

```
Limit  (cost=48210.55..48210.60 rows=20 width=24)
        (actual time=836.114..836.121 rows=20 loops=1)
  ->  Sort  (cost=48210.55..48213.92 rows=1348 width=24)
            (actual time=836.112..836.116 rows=20 loops=1)
        Sort Key: o.created_at DESC
        Sort Method: top-N heapsort  Memory: 27kB
        ->  Seq Scan on orders o  (cost=0.00..48174.00 rows=1348 width=24)
                                  (actual time=0.402..834.901 rows=1211 loops=1)
              Filter: ((user_id = 42) AND (status = 'pending')
                       AND (date(created_at) >= '2026-09-01'::date))
              Rows Removed by Filter: 1998789
  Buffers: shared hit=812 read=27362
Planning Time: 0.194 ms
Execution Time: 836.203 ms
```

Two problems are visible: a `Seq Scan` discarding 1,998,789 rows, and `date(created_at)` wrapping the column so no index on `created_at` could be used anyway.

**Step 2: fix the predicate first (free, no write cost)**

```sql
-- DATE(created_at) >= '2026-09-01'  becomes a bare range
WHERE o.user_id = 42
  AND o.status = 'pending'
  AND o.created_at >= '2026-09-01'
```

**Step 3: add one composite index matching equality columns then the sort column**

```sql
CREATE INDEX idx_orders_user_status_created
ON orders (user_id, status, created_at DESC);
```

**Step 4: re-measure**

```
Limit  (cost=0.43..38.91 rows=20 width=24)
        (actual time=0.048..0.121 rows=20 loops=1)
  ->  Index Scan using idx_orders_user_status_created on orders o
        (cost=0.43..2593.77 rows=1348 width=24)
        (actual time=0.046..0.114 rows=20 loops=1)
        Index Cond: ((user_id = 42) AND (status = 'pending')
                     AND (created_at >= '2026-09-01'::date))
  Buffers: shared hit=24
Planning Time: 0.211 ms
Execution Time: 0.163 ms
```

836ms to 0.16ms. The `Sort` node is gone because the index already stores `created_at DESC`, and buffer reads dropped from 27,362 to 24.

**Step 5: optionally run the bundled analyzer to confirm nothing else is flagged**

```bash
psql -c "EXPLAIN (ANALYZE) SELECT ..." > /tmp/plan.txt
python3 scripts/analyze-explain.py postgres /tmp/plan.txt
```

## Key concepts

- **Sargable predicate.** A `WHERE` condition the index can seek on. The indexed column must appear bare on one side: `created_at >= '2026-09-01'` is sargable, `DATE(created_at) >= '2026-09-01'` is not.
- **Scan types, worst to best.** PostgreSQL: `Seq Scan` < `Bitmap Heap Scan` < `Index Scan` < `Index Only Scan`. MySQL: `type: ALL` < `index` < `range` < `ref` < `const`.
- **Covering index.** An index holding every column the query reads, so the engine never touches the table. PostgreSQL `INCLUDE (...)` produces `Index Only Scan`; MySQL reports `Extra: Using index`.
- **Composite index column order.** `(a, b)` is not `(b, a)`. Equality-filtered columns first, then the range or `ORDER BY` column. An index on `(user_id, status, created_at)` serves a filter on `user_id` alone, but an index on `(status, created_at)` does not.
- **Estimated vs actual rows.** `cost=` is a relative planner estimate, `actual time=` is real milliseconds. A large gap between estimated and actual rows means stale statistics: run `ANALYZE`.
- **Write cost of indexes.** Every index slows `INSERT`, `UPDATE`, and `DELETE`. Prefer a free query rewrite over a new index when both work.
- **Filesort / temp table.** MySQL `Using filesort` or `Using temporary` means the sort or grouping is not index-backed; a composite index covering `ORDER BY` removes it.

## Bundled tools

### `scripts/analyze-explain.py`

A dependency-free Python 3 CLI that parses saved `EXPLAIN` output and prints issues plus index suggestions. Supports PostgreSQL, MySQL, and SQLite.

```bash
# PostgreSQL: text-format plan
psql mydb -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 42;" \
  > /tmp/pg-plan.txt
python3 scripts/analyze-explain.py postgres /tmp/pg-plan.txt

# MySQL: JSON-format plan (required for this mode)
mysql -e "EXPLAIN FORMAT=JSON SELECT * FROM orders WHERE user_id = 42;" \
  --raw --skip-column-names > /tmp/mysql-plan.json
python3 scripts/analyze-explain.py mysql /tmp/mysql-plan.json

# SQLite
sqlite3 app.db "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE user_id = 42;" \
  > /tmp/sqlite-plan.txt
python3 scripts/analyze-explain.py sqlite /tmp/sqlite-plan.txt
```

Sample output:

```
PostgreSQL EXPLAIN Analysis
============================================================

Found 2 potential issues

Issues found:
  1. Sequential scan on 'orders' - no index used
  2. Row estimate way off: 1348 estimated vs 1211 actual

Suggestions:
  1. Consider adding an index on 'orders' for the WHERE clause columns
  2. Run ANALYZE on this table to update statistics
```

What each backend detects:

| Backend | Flags |
| --- | --- |
| postgres | `Seq Scan` per table, external (on-disk) sorts, nested loops over 1000 estimated rows, estimate/actual row skew |
| mysql | `access_type: ALL` with rows examined, `using_filesort`, `using_temporary_table` |
| sqlite | `SCAN TABLE`, `USE TEMP B-TREE` for `ORDER BY` |

Invoked with no arguments (or fewer than two) it prints its usage docstring and exits 1. An unknown backend name exits 1 with the supported list. The MySQL mode requires valid JSON, so use `FORMAT=JSON`, not the default tabular `EXPLAIN`.

Treat the output as a triage shortlist, not a verdict: it reads the plan text only, so it cannot know table sizes, write volume, or query frequency.

### `references/anti-patterns.md`

A 15-entry catalogue of SQL mistakes, each with the anti-pattern, why it hurts, and a working fix. Load it when the plan looks fine but the query is still slow, or during code review of new SQL.

Covered: `SELECT *`, N+1 queries, `OR` blocking index use, leading-wildcard `LIKE`, functions on indexed columns, `NOT IN` with NULLs, implicit type conversion, `OFFSET` pagination, `COUNT(*)` on huge tables, missing composite indexes, `DISTINCT` masking bad joins, querying inside JSON columns, correlated subqueries in the `SELECT` list, `UPDATE` without `WHERE`, and unindexed foreign keys. It closes with a quick-wins checklist and per-engine tooling (`pg_stat_statements`, `auto_explain`, slow query log, `pt-query-digest`, `.eqp on`).

## Common pitfalls

**Wrapping the indexed column in a function**

```sql
-- Bad: index on created_at is unusable
SELECT * FROM orders WHERE DATE(created_at) = '2026-09-21';

-- Good: half-open range keeps the column bare
SELECT * FROM orders
WHERE created_at >= '2026-09-21' AND created_at < '2026-09-22';
```

**Guessing the composite index order**

```sql
-- Bad: range column first, so status can only be filtered after the seek
CREATE INDEX idx_bad ON orders (created_at, status);

-- Good: equality column first, range/sort column last
CREATE INDEX idx_good ON orders (status, created_at);
```

**Counting rows just to test existence**

```sql
-- Bad: scans every matching row
SELECT COUNT(*) FROM orders WHERE user_id = 42;  -- then compare > 0

-- Good: stops at the first hit
SELECT EXISTS (SELECT 1 FROM orders WHERE user_id = 42);
```

**Deep OFFSET pagination**

```sql
-- Bad: reads 10,050 rows and discards 10,000
SELECT id, name FROM products ORDER BY id LIMIT 50 OFFSET 10000;

-- Good: keyset pagination from the last id of the previous page
SELECT id, name FROM products WHERE id > 10000 ORDER BY id LIMIT 50;
```

**Mismatched literal types**

```sql
-- Bad: user_id is VARCHAR, so every row gets cast (full scan)
SELECT * FROM users WHERE user_id = 12345;

-- Good: match the column type
SELECT * FROM users WHERE user_id = '12345';
```

**Benchmarking on a dev database**

```sql
-- Bad: 200 rows locally, the planner picks Seq Scan and it looks instant
-- Good: test against production-scale data (a restored snapshot or staging clone),
--       and always use EXPLAIN ANALYZE, not wall-clock time on a warm cache
```

**Fixing more than one thing at once**

```sql
-- Bad: add three indexes and rewrite the query, then measure once
-- Good: one change, one measurement, so you know which change paid off
--       (and can drop the indexes that did not)
```

## See also

- `SKILL.md` in this directory: the full optimization loop, the eight bottleneck classes, and the `EXPLAIN` field guide for PostgreSQL and MySQL.
- `references/anti-patterns.md`: the 15 anti-patterns with fixes.
- `scripts/analyze-explain.py`: automated plan triage for postgres, mysql, and sqlite.
- PostgreSQL docs: "Using EXPLAIN" and the `pg_stat_statements` extension.
- MySQL docs: "Optimizing Queries with EXPLAIN" and `EXPLAIN FORMAT=JSON`.

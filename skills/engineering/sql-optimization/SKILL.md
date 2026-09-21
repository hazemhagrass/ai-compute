---
name: sql-optimization
description: Use when a query is slow. Find the bottleneck with EXPLAIN, fix indexes, rewrite the query.
---

Turn a slow query fast by reading the execution plan, identifying the bottleneck (missing index, full table scan, expensive function), applying the minimal fix, and verifying with real timings.

## The optimization loop

1. **Measure first** - get the baseline timing
2. **Explain the plan** - see what the database is actually doing
3. **Identify the bottleneck** - full scan? missing index? expensive join?
4. **Apply ONE fix** - index, rewrite, or schema change
5. **Measure again** - did it help? by how much?

Never optimize without measuring. Your intuition about "slow" is wrong more often than right.

## Common bottlenecks and fixes

### 1. Full table scan (missing index)

**Symptom:** EXPLAIN shows `Seq Scan` (Postgres) or `type: ALL` (MySQL) on a large table

```sql
-- PostgreSQL
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 42;

-- Look for:
-- Seq Scan on orders (cost=0.00..10000.00 rows=1 width=100)
--   Filter: (user_id = 42)

-- MySQL
EXPLAIN
SELECT * FROM orders WHERE user_id = 42;

-- Look for:
-- type: ALL  <-- full table scan
-- rows: 500000  <-- reading every row
```

**Fix:** Add an index on the filter column

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Re-run EXPLAIN - should now show Index Scan
-- Seq Scan -> Index Scan = 100x-1000x faster on large tables
```

**When NOT to index:**
- Table has <1000 rows (scan is already fast)
- Column has very low cardinality (e.g., boolean, status with 2-3 values)
- The query is rarely run

### 2. Function on indexed column (non-sargable predicate)

**Symptom:** Query has `WHERE LOWER(email) = ...` or `WHERE DATE(created_at) = ...` - index isn't used

```sql
-- Bad: function prevents index use
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
-- EXPLAIN shows Seq Scan even if email is indexed

-- Good: use the index directly
SELECT * FROM users WHERE email = 'user@example.com';
-- Or for case-insensitive match:
SELECT * FROM users WHERE email ILIKE 'user@example.com';  -- Postgres
-- MySQL: columns are case-insensitive by default unless BINARY
```

**Fix for date ranges:**
```sql
-- Bad
SELECT * FROM orders WHERE DATE(created_at) = '2026-09-21';

-- Good: rewrite as a range so the index on created_at works
SELECT * FROM orders 
WHERE created_at >= '2026-09-21' 
  AND created_at < '2026-09-22';
```

**Rule:** Never wrap an indexed column in a function in the WHERE clause. Rewrite the condition so the bare column is on the left.

### 3. SELECT * pulling unnecessary columns

**Symptom:** Query fetches 20 columns but only uses 2

```sql
-- Bad: pulls 1 MB of data per row
SELECT * FROM products WHERE category_id = 5;

-- Good: only fetch what you need
SELECT id, name, price FROM products WHERE category_id = 5;
```

**Why it matters:**
- Smaller result set = less network transfer
- Covering index possible (index contains all needed columns, no table lookup)

**Covering index example (Postgres):**
```sql
CREATE INDEX idx_products_category_covering 
ON products(category_id) INCLUDE (id, name, price);

-- Now the query can be satisfied entirely from the index (Index Only Scan)
```

### 4. N+1 query problem

**Symptom:** Logs show hundreds of queries like `SELECT * FROM orders WHERE user_id = 1`, then `user_id = 2`, etc.

```sql
-- Bad: one query per user
for user_id in user_ids:
    query("SELECT * FROM orders WHERE user_id = ?", user_id)

-- Good: one query total
user_ids_list = ','.join(map(str, user_ids))
query(f"SELECT * FROM orders WHERE user_id IN ({user_ids_list})")
```

**Even better:** Use a JOIN instead of IN if you're fetching users too

```sql
SELECT u.id, u.name, o.id AS order_id, o.total
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.id IN (1, 2, 3, ...);
```

### 5. Expensive JOIN order

**Symptom:** EXPLAIN shows joining 1M rows to 1M rows, then filtering

```sql
-- Bad: joins everything, then filters
SELECT o.id, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending';

-- Better: filter first (if orders has an index on status)
SELECT o.id, u.name
FROM (SELECT id, user_id FROM orders WHERE status = 'pending') o
JOIN users u ON u.id = o.user_id;
```

**Most databases optimize this automatically**, but if EXPLAIN shows the join happening before the filter, try rewriting it.

**Composite index for filter + join:**
```sql
CREATE INDEX idx_orders_status_user 
ON orders(status, user_id);
```

### 6. OR kills indexes

**Symptom:** `WHERE a = 1 OR b = 2` does a full scan even if both columns are indexed

```sql
-- Bad
SELECT * FROM products WHERE category_id = 5 OR brand_id = 10;
-- Usually does a Seq Scan

-- Good: rewrite as UNION
SELECT * FROM products WHERE category_id = 5
UNION
SELECT * FROM products WHERE brand_id = 10;
-- Each half uses its index
```

**Alternative:** Composite index if the OR is on related columns
```sql
CREATE INDEX idx_products_cat_brand ON products(category_id, brand_id);
```

### 7. COUNT(*) on huge tables

**Symptom:** `SELECT COUNT(*) FROM orders` takes 30 seconds

```sql
-- Postgres: COUNT(*) always does a seq scan (MVCC design)
-- MySQL: COUNT(*) on InnoDB is slow without WHERE

-- Fix for "approximate count" (Postgres):
SELECT reltuples::bigint AS estimate 
FROM pg_class 
WHERE relname = 'orders';
-- Fast but not exact (updated by VACUUM/ANALYZE)

-- Fix for "exact count of a subset":
-- Maintain a counter in a separate table
CREATE TABLE order_counts (status TEXT, count INT);
-- Update with triggers or app logic
```

### 8. DISTINCT hides performance issues

**Symptom:** Query uses DISTINCT to de-dupe results, but it's slow

```sql
-- Bad: DISTINCT sorts the entire result set
SELECT DISTINCT user_id FROM orders WHERE status = 'shipped';

-- Better: fix the query so duplicates don't appear
-- (Often the real issue is a JOIN producing duplicates)
```

**When DISTINCT is actually needed:**
```sql
-- Use GROUP BY instead (often faster and more explicit)
SELECT user_id FROM orders WHERE status = 'shipped' GROUP BY user_id;
```

## Reading EXPLAIN output

### PostgreSQL
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

Key fields:
- **Seq Scan** = reading every row (slow on large tables)
- **Index Scan** = using an index (good)
- **Index Only Scan** = everything in the index, no table lookup (best)
- **cost=0.00..10000.00** = estimated cost (not time; relative)
- **actual time=0.123..45.678** = real milliseconds (with ANALYZE)
- **rows=500000** = how many rows this step processed

### MySQL
```sql
EXPLAIN SELECT ...;
```

Key fields:
- **type: ALL** = full table scan (bad)
- **type: index** = index scan (better)
- **type: ref** = index lookup (good)
- **type: const** = single row lookup (best)
- **rows: 500000** = estimated rows read
- **Extra: Using where** = filter applied after reading rows
- **Extra: Using index** = covering index (best)
- **Extra: Using filesort** = expensive sort operation

## Optimization rules

1. **Measure before and after.** Use `EXPLAIN ANALYZE` (Postgres) or `EXPLAIN` + actual runtime (MySQL). Don't guess.

2. **Index the WHERE columns.** If you filter on `user_id`, index it. If you filter on `user_id` AND `status`, create a composite index `(user_id, status)`.

3. **Index order matters for composites.** `(a, b)` is not the same as `(b, a)`. Put the most selective (highest cardinality) column first, or the column used in equality filters first.

4. **One index per query is usually enough.** Postgres can combine indexes (bitmap scan) but it's often slower than one good composite index.

5. **Don't index everything.** Each index slows down writes (INSERT/UPDATE/DELETE). Only index columns you actually filter or sort by.

6. **Rewrite before adding indexes.** Sometimes the query is just badly written. Fixing `WHERE DATE(created_at) = '2026-09-21'` to a range is free; adding a functional index costs write performance.

7. **LIMIT + ORDER BY needs an index on the ORDER BY column.** Otherwise the DB sorts the entire table and throws away most rows.

8. **Avoid SELECT *.** Fetch only the columns you need. Enables covering indexes and reduces I/O.

9. **Use EXISTS instead of COUNT when checking existence.**
   ```sql
   -- Bad
   if (SELECT COUNT(*) FROM orders WHERE user_id = 42) > 0 { ... }
   
   -- Good
   if (SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = 42 LIMIT 1)) { ... }
   ```

10. **Parameterize queries.** Use bind variables so the DB can reuse the query plan. `WHERE user_id = $1`, not `WHERE user_id = 42`.

## Anti-patterns

- ❌ Adding an index without measuring (might not help, costs write performance)
- ❌ Using LIKE with a leading wildcard (`LIKE '%foo'` can't use an index)
- ❌ Filtering in application code instead of SQL (fetching 100k rows and filtering to 10 in Python)
- ❌ Running production queries on a dev DB with 100 rows (performance is completely different)
- ❌ Optimizing queries that run once a day (optimize the ones that run 1000x/sec first)

## When to use this skill

Use this skill when:
- A query takes >100ms and you need it under 10ms
- EXPLAIN shows a Seq Scan or type: ALL on a large table
- The app is slow because of database queries (use APM traces to confirm)
- Adding indexes didn't help (the query might be non-sargable)

Skip this skill when:
- The query is already fast (<10ms)
- The table is tiny (<1000 rows)
- The bottleneck is network latency, not query time
- You're designing a schema from scratch (different skill)

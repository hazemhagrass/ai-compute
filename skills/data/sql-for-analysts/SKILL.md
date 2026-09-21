---
name: sql-for-analysts
description: Use when writing analytical SQL. Get the number right: NULL semantics, join fan-out, grain, windows, half-open dates, reconciliation.
---

Analytical SQL fails quietly. A query that returns a plausible number in 40ms is far more dangerous than one that errors. This skill is about correctness: the grain of your rows, what NULL does to your predicates, and what a join does to your SUM. For making a correct query fast, use `skills/engineering/sql-optimization` instead.

## The first question: what is one row?

Before writing a SELECT, state the grain out loud: "one row per order", "one row per customer per month". Every join and every GROUP BY either preserves that grain or changes it. Most wrong numbers are a grain change nobody noticed.

- **Write the intended grain as a comment above the query, then prove it.** `SELECT COUNT(*), COUNT(DISTINCT order_id) FROM ...` must return the same two numbers if the grain is one row per order.
- **Check the grain again after every join you add.** A join is the only cheap way to silently multiply rows.

## NULL semantics

NULL means "unknown", not "empty". Comparisons against unknown are unknown, and WHERE keeps only rows that are true.

- **Never compare to NULL with `=` or `<>`; use `IS NULL` / `IS NOT NULL`.** `NULL = NULL` evaluates to NULL, not true.

```sql
-- Bad: returns zero rows even when region is NULL for some customers
SELECT * FROM customers WHERE region = NULL;

-- Good
SELECT * FROM customers WHERE region IS NULL;
```

- **Remember that `<>` silently drops NULL rows.** Asking for "everything not EU" excludes customers whose region is unknown, so your parts stop summing to the whole.

```sql
-- Bad: a customer with region NULL appears in neither bucket
SELECT COUNT(*) FROM customers WHERE region <> 'EU';

-- Good: decide explicitly what unknown means here
SELECT COUNT(*) FROM customers WHERE region IS DISTINCT FROM 'EU';
-- Portable form: WHERE region <> 'EU' OR region IS NULL
```

- **Never use `NOT IN` against a list or subquery that can contain NULL.** One NULL makes the whole predicate unknown for every row, so the query returns zero rows and looks like a clean "no exceptions" result. Verified: with a NULL in the list, `NOT IN` returned 0 rows where 1 was correct.

```sql
-- Bad: returns zero rows if any customers.id is NULL
SELECT * FROM orders
WHERE customer_id NOT IN (SELECT id FROM customers);

-- Good: NOT EXISTS handles NULL correctly and needs no guard
SELECT * FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id);
```

- **Use `COUNT(*)` for rows and `COUNT(col)` for populated values, and never confuse them.** `COUNT(col)` skips NULLs. On a three-row table with one non-null discount, `COUNT(*)` returned 3 and `COUNT(discount)` returned 1.
- **Know that `SUM`, `AVG`, `MIN` and `MAX` also skip NULLs**, so `AVG(col)` divides by the non-null count, not the row count. If you want zeros in the denominator, say so: `SUM(col) / COUNT(*)` or `AVG(COALESCE(col, 0))`.
- **Wrap nullable columns in `COALESCE` before arithmetic.** Any NULL in an expression poisons the whole expression, including string concatenation.

```sql
-- Bad: net is NULL for every order with no discount
SELECT amount - discount AS net FROM orders;

-- Good
SELECT amount - COALESCE(discount, 0) AS net FROM orders;
```

- **Distinguish `SUM` returning NULL from `SUM` returning 0.** On an empty filter, `SUM(amount)` is NULL while `COUNT(*)` is 0. Use `COALESCE(SUM(amount), 0)` whenever the result feeds a division or a dashboard tile.

## Join fan-out: the number one source of wrong totals

Joining a one-to-many relation duplicates the left row once per match, and any aggregate over the left side is then multiplied.

```sql
-- Bad: orders.amount is counted once per line item
SELECT SUM(o.amount) AS revenue
FROM orders o
JOIN order_items i ON i.order_id = o.id;
```

Verified on a fixture whose true revenue was 600: the query above returned 700. Adding a second one-to-many join (payments) pushed it to 900.

- **Aggregate each one-to-many branch to the parent grain first, then join.** This is the only structurally safe fix when two or more branches fan out.

```sql
-- Good: each subquery is already one row per order
SELECT
    SUM(o.amount)                    AS revenue,
    SUM(COALESCE(i.units, 0))        AS units,
    SUM(COALESCE(p.paid,  0))        AS collected
FROM orders o
LEFT JOIN (SELECT order_id, SUM(qty)  AS units FROM order_items GROUP BY order_id) i
       ON i.order_id = o.id
LEFT JOIN (SELECT order_id, SUM(paid) AS paid  FROM payments    GROUP BY order_id) p
       ON p.order_id = o.id;
```

The corrected query returned 600, matching the standalone `SELECT SUM(amount) FROM orders`.

- **Never patch fan-out with `SUM(DISTINCT col)`.** It happens to work only when every duplicated value is distinct; two orders of the same amount collapse into one and the total goes down instead of up. `COUNT(DISTINCT id)` is safe because ids are unique; `SUM(DISTINCT amount)` is not.
- **Use a correlated scalar subquery or `EXISTS` when you only need a flag or a single derived value**, so the child table never enters the FROM list at all.

```sql
-- Good: no fan-out possible
SELECT o.id, o.amount,
       EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id) AS was_refunded
FROM orders o;
```

## INNER vs LEFT changes the denominator

- **Choose the join type by asking which population the metric is over.** INNER silently restricts the population to rows that have a match, which is usually the wrong denominator for a rate or an average.

```sql
-- Bad: "average revenue per customer" over customers who ordered
SELECT AVG(total) FROM (
    SELECT c.id, SUM(o.amount) AS total
    FROM customers c JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id) t;

-- Good: every customer counts, non-buyers contribute zero
SELECT AVG(total) FROM (
    SELECT c.id, COALESCE(SUM(o.amount), 0) AS total
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id) t;
```

On the fixture, the INNER version covered 2 customers and the LEFT version 3. Same data, different metric.

- **Always `COALESCE` the aggregate on the outer side of a LEFT JOIN.** Without it the non-matching rows contribute NULL, and `AVG` skips them, undoing the LEFT JOIN you just wrote.

## Filtering a LEFT JOIN in WHERE makes it an INNER JOIN

Any WHERE predicate on the right table (other than `IS NULL`) rejects the NULL-extended rows the LEFT JOIN just produced.

```sql
-- Bad: this is an INNER JOIN wearing a LEFT JOIN costume
SELECT c.id, o.amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.amount > 150;

-- Good: the filter belongs to the join, not to the result
SELECT c.id, o.amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.amount > 150;
```

Verified: the WHERE form returned 2 rows, the ON form returned 3 (every customer preserved).

- **Put right-table conditions in `ON`; keep left-table conditions in `WHERE`.** The one legitimate right-table WHERE predicate is the anti-join test `WHERE o.id IS NULL`, which finds customers with no orders.

## GROUP BY and the bare column trap

- **Put every non-aggregated select column in the GROUP BY**, or wrap it in an aggregate. Postgres and standard SQL reject a bare column; SQLite and older MySQL accept it and return an arbitrary row from the group.

```sql
-- Bad: SQLite returned amount 100 for a customer whose max was 200
SELECT customer_id, amount, SUM(amount) FROM orders GROUP BY customer_id;

-- Good: say which value you mean
SELECT customer_id, MAX(amount) AS largest, SUM(amount) AS total
FROM orders GROUP BY customer_id;
```

- **Use `WHERE` to filter rows and `HAVING` to filter groups.** `HAVING` runs after aggregation, so putting a row predicate there scans more data and, with an aggregate, means something entirely different.
- **Group by the surrogate key, not the display name.** Two distinct customers named "Acme" merge into one group if you group by name.
- **Avoid `GROUP BY 1, 2` in anything durable.** Reordering the select list silently regroups the query.

## Window functions vs GROUP BY

GROUP BY collapses rows; a window function keeps every row and attaches the group result to it. Verified: on 4 rows with 3 distinct scores, GROUP BY returned 3 rows and `AVG(s) OVER ()` returned 4.

- **Use GROUP BY when the output grain is the group.** Use a window when you need the detail row alongside its group aggregate (share of total, rank within group, difference from group mean).

```sql
-- Bad: aggregate then join back to recover the detail rows
SELECT o.*, t.total
FROM orders o
JOIN (SELECT customer_id, SUM(amount) AS total FROM orders GROUP BY customer_id) t
  ON t.customer_id = o.customer_id;

-- Good: one pass, no join, no fan-out risk
SELECT o.*,
       SUM(amount) OVER (PARTITION BY customer_id) AS customer_total,
       amount * 1.0 / SUM(amount) OVER (PARTITION BY customer_id) AS share
FROM orders o;
```

- **Nest an aggregate inside a window to get a percent of total in one query.** `SUM(SUM(amount)) OVER ()` alongside `GROUP BY customer_id` gives each group total and the grand total together.
- **Remember windows run after WHERE and after GROUP BY, but before ORDER BY and LIMIT.** You cannot filter on a window result in the same WHERE; wrap it in a subquery or CTE and filter outside.

```sql
-- Bad: rn does not exist yet at WHERE time
SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ts DESC) AS rn
FROM orders WHERE rn = 1;

-- Good: the deduplication idiom
SELECT * FROM (
    SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ts DESC) AS rn
    FROM orders o) t
WHERE rn = 1;
```

## Ranking and running totals

- **Pick the ranking function by what ties should do.** Verified on scores 10, 10, 9, 8:

| function | output | use it for |
| --- | --- | --- |
| `ROW_NUMBER()` | 1, 2, 3, 4 | deduplication, "pick one row per key"; ties broken arbitrarily |
| `RANK()` | 1, 1, 3, 4 | leaderboards where tied entrants share a place and the next place is skipped |
| `DENSE_RANK()` | 1, 1, 2, 3 | "top 3 distinct values", where you want no gaps |

- **Add a tiebreaker to every `ROW_NUMBER` ORDER BY.** With ties, which row wins is arbitrary and can change between runs; `ORDER BY ts DESC, id DESC` is reproducible.
- **Always write an explicit frame for a running total.** The default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which includes all peer rows tied on the ORDER BY key, so tied rows all show the same end-of-group total rather than a stepwise accumulation. Verified: two rows tied on the sort key both showed 300 instead of 100 and 300.

```sql
-- Bad: ties jump the running total
SELECT ts, SUM(amount) OVER (ORDER BY ts) AS running FROM orders;

-- Good: one row at a time, deterministically ordered
SELECT ts, SUM(amount) OVER (ORDER BY ts, id
       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
FROM orders;
```

## Dates and time zones

- **Use half-open intervals `>= start AND < next_start`, never `BETWEEN`, for timestamps.** `BETWEEN '2026-01-01' AND '2026-01-31'` compares against midnight and drops everything that happened during the last day. Verified: `BETWEEN` matched 1 row, the half-open form matched the correct 2.

```sql
-- Bad: loses 23 hours 59 minutes of the final day
WHERE ts BETWEEN '2026-01-01' AND '2026-01-31'

-- Good
WHERE ts >= '2026-01-01' AND ts < '2026-02-01'
```

- **Convert to the reporting time zone before truncating, not after.** Truncating a UTC timestamp buckets a business day that starts at 09:00 local into the wrong day for anyone west of Greenwich.

```sql
-- Bad: UTC days, labelled as if they were local days
SELECT date_trunc('day', ts) AS d, COUNT(*) FROM orders GROUP BY 1;

-- Good (Postgres): shift, then truncate
SELECT date_trunc('day', ts AT TIME ZONE 'America/New_York') AS d, COUNT(*)
FROM orders GROUP BY 1;
```

- **Store timestamps in UTC and name the zone in the column or the query.** A column called `created_at` with no zone is a bug waiting for a daylight-saving transition.
- **Join to a calendar table for time series with gaps.** Grouping the fact table alone produces no row for a day with zero events, and the chart then draws a straight line across the outage instead of a hole.

## CTEs

- **Use CTEs to name each grain change.** One CTE per stage (`daily_orders`, `per_customer`, `final`) makes the grain auditable and each stage independently runnable.
- **Know that a CTE is sometimes an optimisation fence.** Postgres materialises a CTE when it is referenced more than once or marked `MATERIALIZED`, so a predicate in the outer query is not pushed down into it. If a CTE-based query is slow, add `NOT MATERIALIZED` or inline it, then see `skills/engineering/sql-optimization`.
- **Never reference a CTE twice expecting it to be evaluated twice with fresh data.** It is a single snapshot, and with a volatile function such as `random()` the two references may or may not agree depending on materialisation.
- **Prefer a CTE over a repeated subquery**, because copy-pasted subqueries drift apart when only one copy gets edited.

## Sampling

- **Never validate a metric on `LIMIT 100` without `ORDER BY`.** Row order is undefined, so the sample is whatever the storage layer hands back first, typically the oldest or the most recently written rows, and never representative.
- **Sample entities, not rows, when the metric is per entity.** Sampling order rows biases towards customers with many orders; sample customer ids first, then pull all their rows.

```sql
-- Bad: biased towards heavy users, and not reproducible
SELECT * FROM orders ORDER BY random() LIMIT 1000;

-- Good: deterministic hash sample of 1% of customers, all their orders
SELECT o.* FROM orders o
WHERE MOD(ABS(HASHTEXT(o.customer_id::text)), 100) = 0;
```

- **Scale a sampled total back up explicitly and label it an estimate.** A 1% sample of revenue is not revenue, and nobody downstream will remember that it was multiplied by 100.

## Reconcile before you publish

- **Check every result against a known total before anyone sees it.** One row in a sum that should match an invoice, a month that matches last month's published report, or a row count that matches the source table.

```sql
-- Reconciliation: this must return 0
SELECT (SELECT SUM(amount) FROM orders)
     - (SELECT SUM(revenue) FROM my_reported_query);
```

- **Compare the row count before and after each join.** If it moved and you did not intend it to, you found a fan-out.
- **Check that the parts sum to the whole after every GROUP BY.** `SUM` of the group totals must equal the ungrouped total; if it does not, a NULL key or a WHERE predicate ate rows.
- **State the denominator next to every rate you publish.** "3.1% conversion" is unreviewable; "3.1% (412 of 13,290 sessions)" lets a reader catch a wrong population instantly.

## Anti-patterns

- Using `SELECT DISTINCT` to make duplicates go away instead of finding the join that created them.
- Putting a right-table filter in the WHERE clause of a LEFT JOIN.
- Trusting a query because it ran fast and returned a plausible number.
- Integer division: `COUNT(x) / COUNT(*)` returns 0 in Postgres. Multiply by `1.0` first.
- Reporting a number from a query nobody else has read, when the cost of being wrong is a decision.

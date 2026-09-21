# SQL for Analysts

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="sql-for-analysts robot" width="200">
</div>

A skill for writing analytical SQL that returns the right number, covering NULL semantics, join fan-out, grain control, window functions, half-open date ranges, and reconciliation before publishing.

## What it does

A slow query announces itself. A wrong query does not. This skill names the specific mechanisms that turn a correct-looking query into a wrong number, and gives the fix for each:

- **NULL semantics**: why `= NULL` matches nothing, why `<> 'EU'` drops the unknown-region rows, and why `NOT IN` against a nullable subquery returns zero rows and looks like a clean result.
- **Counting**: `COUNT(*)` counts rows, `COUNT(col)` counts populated values, and `AVG` divides by the second one.
- **Join fan-out**: how a one-to-many join multiplies the parent's `SUM`, why two fanning branches multiply it twice, and the aggregate-before-join pattern that fixes it structurally.
- **Join type as denominator**: INNER restricts the population, LEFT preserves it, and an uncoalesced aggregate on a LEFT JOIN quietly reverts to INNER behaviour.
- **The LEFT JOIN WHERE trap**: any right-table predicate in WHERE downgrades the join to INNER; it belongs in ON.
- **Grain and GROUP BY**: stating the intended grain, proving it, and the bare-column select that returns an arbitrary row on permissive engines.
- **Windows vs GROUP BY**: collapse or keep the detail rows, percent of total without a self-join, and the ROW_NUMBER deduplication idiom.
- **Ranking**: ROW_NUMBER vs RANK vs DENSE_RANK on ties, and why every ROW_NUMBER needs a tiebreaker.
- **Running totals**: the default RANGE frame includes tied peers, so ties jump the total unless you write ROWS explicitly.
- **Dates**: half-open intervals instead of BETWEEN, truncating after the time zone shift, and calendar tables for gap-free series.
- **CTEs**: naming each grain change for auditability, and when materialisation blocks predicate pushdown.
- **Sampling**: sampling entities rather than rows, and never validating on an unordered LIMIT.
- **Reconciliation**: matching against a known total, tracking row counts across joins, and publishing the denominator with every rate.

## When to use this

Concrete triggers:

- A total changed after someone added a join, and the join was supposed to be "just for a label".
- A revenue figure from SQL does not match the figure from the source system or last month's report.
- A `NOT IN` exclusion returned nothing and you took that as good news.
- A rate looks too high or too low and you are not sure which population is in the denominator.
- A LEFT JOIN result has the same row count as the INNER version.
- A daily chart shows a spike or a missing day near a month boundary or a daylight-saving change.
- A running total plateaus across rows that share a timestamp.
- A "top 10" list has 12 entries, or 8.
- The output feeds a dashboard, a board deck, an invoice, or anyone's decision.

Skip it when:

- The query is already correct and merely slow: use `skills/engineering/sql-optimization`.
- You are designing tables rather than querying them: use `skills/engineering/database-design`.
- The work is a throwaway `SELECT *` to look at a few rows.

## Quick start

Goal: revenue and units per region per month, with each region's share of the monthly total. Orders fan out to line items and to payments, so both branches must be collapsed before joining.

**Step 1: state the grain and prove the base table**

```sql
-- Intended grain of the final result: one row per region per month.
SELECT COUNT(*) AS rows, COUNT(DISTINCT id) AS orders FROM orders;
-- These two numbers must be equal, or orders is not one row per order.
```

**Step 2: collapse each one-to-many branch to the order grain**

```sql
WITH items_per_order AS (
    SELECT order_id, SUM(qty) AS units
    FROM order_items
    GROUP BY order_id
),
payments_per_order AS (
    SELECT order_id, SUM(paid) AS paid
    FROM payments
    GROUP BY order_id
),
```

**Step 3: join at the order grain, half-open date filter, right-table filter in ON**

```sql
order_facts AS (
    SELECT
        o.id,
        o.amount,
        COALESCE(i.units, 0) AS units,
        COALESCE(p.paid,  0) AS paid,
        COALESCE(c.region, 'unknown') AS region,
        date_trunc('month', o.ts AT TIME ZONE 'America/New_York') AS month
    FROM orders o
    LEFT JOIN customers          c ON c.id = o.customer_id
    LEFT JOIN items_per_order    i ON i.order_id = o.id
    LEFT JOIN payments_per_order p ON p.order_id = o.id
    WHERE o.ts >= '2026-01-01' AND o.ts < '2026-04-01'
      AND o.status <> 'cancelled'
),
```

**Step 4: aggregate to the target grain, add the share with a window**

```sql
by_region_month AS (
    SELECT
        month,
        region,
        COUNT(*)            AS orders,
        SUM(amount)         AS revenue,
        SUM(units)          AS units,
        SUM(paid)           AS collected
    FROM order_facts
    GROUP BY month, region
)
SELECT
    month,
    region,
    orders,
    revenue,
    units,
    revenue * 1.0 / SUM(revenue) OVER (PARTITION BY month) AS share_of_month,
    RANK() OVER (PARTITION BY month ORDER BY revenue DESC)  AS region_rank
FROM by_region_month
ORDER BY month, revenue DESC;
```

**Step 5: reconcile before publishing**

```sql
-- Must return 0. If it does not, a join changed the grain.
SELECT
    (SELECT SUM(amount) FROM orders
      WHERE ts >= '2026-01-01' AND ts < '2026-04-01' AND status <> 'cancelled')
  - (SELECT SUM(revenue) FROM by_region_month);
```

If step 5 is non-zero, the bug is real and you found it before the reader did.

## Key concepts

- **Grain.** What one row represents. Every join and GROUP BY either preserves it or changes it, and an unnoticed change is the most common cause of a wrong total.
- **Three-valued logic.** SQL predicates return true, false, or unknown. WHERE keeps only true, so any comparison touching NULL removes the row from both sides of a supposedly exhaustive split.
- **Fan-out.** A join to a one-to-many child duplicates the parent row once per child, multiplying every parent-side aggregate. Two fanning branches multiply by the product of both counts.
- **Aggregate before join.** Collapsing each child to the parent grain in a subquery or CTE removes the possibility of fan-out rather than compensating for it.
- **Join type as population.** INNER defines the denominator as "rows with a match". LEFT defines it as "all rows on the left". Choose it from the metric definition, not from habit.
- **ON vs WHERE.** ON decides which rows pair up; WHERE filters the result after pairing, including the NULL-extended rows a LEFT JOIN produced.
- **Window frame.** The default `RANGE ... CURRENT ROW` includes every row tied on the ORDER BY key. `ROWS ... CURRENT ROW` includes exactly the rows up to this one, which is what a running total means.
- **Half-open interval.** `>= start AND < next_start` covers a period exactly once with no gap and no overlap, and needs no end-of-day timestamp arithmetic.
- **Materialisation fence.** A CTE evaluated once and reused is a snapshot; predicates from the outer query may not be pushed into it, which is a correctness feature and a performance cost.
- **Reconciliation.** An independent computation of a known quantity that must match. Without one, the only test of a query is whether it looked right.

## Common pitfalls

**NOT IN over a nullable column**

```sql
-- Bad: one NULL in the subquery makes the result empty
WHERE customer_id NOT IN (SELECT id FROM customers)

-- Good
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = orders.customer_id)
```

Reason: `x NOT IN (1, NULL)` is unknown for every x, so no row passes.

**Fan-out from a one-to-many join**

```sql
-- Bad: amount counted once per line item
SELECT SUM(o.amount) FROM orders o JOIN order_items i ON i.order_id = o.id;

-- Good
SELECT SUM(o.amount) FROM orders o
LEFT JOIN (SELECT order_id FROM order_items GROUP BY order_id) i ON i.order_id = o.id;
```

Reason: the join multiplies the parent row, and SUM has no way to know.

**Right-table filter in WHERE**

```sql
-- Bad: silently an INNER JOIN
LEFT JOIN orders o ON o.customer_id = c.id WHERE o.amount > 150

-- Good
LEFT JOIN orders o ON o.customer_id = c.id AND o.amount > 150
```

Reason: the NULL-extended rows fail any WHERE comparison and are discarded.

**Uncoalesced aggregate on a LEFT JOIN**

```sql
-- Bad: non-buyers contribute NULL and AVG skips them
SELECT AVG(t.total) FROM (SELECT c.id, SUM(o.amount) AS total ...) t;

-- Good
SELECT AVG(t.total) FROM (SELECT c.id, COALESCE(SUM(o.amount), 0) AS total ...) t;
```

Reason: AVG divides by the non-null count, restoring the INNER JOIN denominator.

**COUNT of a nullable column**

```sql
-- Bad: reports 1 when there are 3 orders
SELECT COUNT(discount) FROM orders;

-- Good
SELECT COUNT(*) AS orders, COUNT(discount) AS with_discount FROM orders;
```

Reason: `COUNT(col)` counts non-null values, not rows.

**Bare column in the select list**

```sql
-- Bad: SQLite returns an arbitrary amount; Postgres errors
SELECT customer_id, amount, SUM(amount) FROM orders GROUP BY customer_id;

-- Good
SELECT customer_id, MAX(amount) AS largest, SUM(amount) AS total
FROM orders GROUP BY customer_id;
```

Reason: with many amounts per group, "the amount" is not defined.

**BETWEEN on timestamps**

```sql
-- Bad: drops everything after midnight on the last day
WHERE ts BETWEEN '2026-01-01' AND '2026-01-31'

-- Good
WHERE ts >= '2026-01-01' AND ts < '2026-02-01'
```

Reason: the bare date literal is midnight, so the final day is almost entirely excluded.

**Running total with the default frame**

```sql
-- Bad: rows tied on ts all show the end-of-tie total
SUM(amount) OVER (ORDER BY ts)

-- Good
SUM(amount) OVER (ORDER BY ts, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
```

Reason: the default RANGE frame includes all peers tied on the ORDER BY key.

**ROW_NUMBER where RANK was meant**

```sql
-- Bad: two people tied for first, one of them arbitrarily gets place 2
ROW_NUMBER() OVER (ORDER BY score DESC)

-- Good
RANK() OVER (ORDER BY score DESC)
```

Reason: ROW_NUMBER never ties, so it invents an ordering the data does not support.

**Truncating before the time zone shift**

```sql
-- Bad: UTC days labelled as local days
date_trunc('day', ts)

-- Good
date_trunc('day', ts AT TIME ZONE 'America/New_York')
```

Reason: evening events land in the next UTC day and move revenue between buckets.

**DISTINCT as a duplicate patch**

```sql
-- Bad
SELECT DISTINCT o.id, o.amount FROM orders o JOIN order_items i ON i.order_id = o.id;

-- Good: remove the fan-out instead of hiding it
SELECT o.id, o.amount FROM orders o
WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);
```

Reason: DISTINCT hides the duplication from your eyes but not from `SUM`.

**Publishing without reconciling**

```sql
-- Bad: ship the query output
-- Good: prove the delta is zero first
SELECT (SELECT SUM(amount) FROM orders) - (SELECT SUM(revenue) FROM reported);
```

Reason: a query that returns quickly and looks plausible is not evidence of anything.

## See also

- `SKILL.md` in this directory: the full rule set with paired bad and good examples for each area.
- `skills/engineering/sql-optimization`: once the query is correct and needs to be fast, EXPLAIN plans, indexes, and rewrites.
- `skills/engineering/database-design`: constraints and keys that make fan-out impossible at the schema level.
- `skills/data/python-pandas-analysis`: the same correctness failures (merge cardinality, dropped NULL keys, silent row loss) in a dataframe.
- `skills/office/pivot-tables`: when the summary belongs in a spreadsheet and the grain question follows you there.
- `skills/research/truth-first`: stating the denominator, the population, and the uncertainty alongside every published figure.

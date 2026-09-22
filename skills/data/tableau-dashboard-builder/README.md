# Tableau Dashboard Builder

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="tableau-dashboard-builder robot" width="200">
</div>

A skill for the Tableau craft that decides whether a dashboard is trusted: correct aggregation, Level of Detail expressions, the filter order of operations, data source design that does not inflate measures, and a reconciliation step before anything is published.

## What it does

Tableau dashboards rarely fail loudly. They fail with a number that is plausible,
wrong, and unflagged. This skill names each mechanism and gives the fix:

- **Green and blue.** Why discrete versus continuous is a display property
  independent of dimension versus measure, and how it changes the chart drawn
  from the same field.
- **Aggregation.** Why `AVG(row-level ratio)` is the wrong margin and
  `SUM(numerator) / SUM(denominator)` is the right one, with a worked two-row
  example where the two differ.
- **Level of Detail expressions.** FIXED, INCLUDE, and EXCLUDE, the specific
  problem each one solves, where each sits relative to filters, and when a LOD is
  the wrong tool entirely.
- **Three computation tools.** A table comparing basic aggregates, LOD
  expressions, and table calculations by where they run and what they can see.
- **Filter order of operations.** The full pipeline, why a Top N filter beside a
  region filter returns the wrong list, and how a context filter fixes it.
- **Data source design.** Relationships versus physical joins versus blending, and
  the join fan-out that silently multiplies a revenue total.
- **Extracts versus live.** The freshness and performance tradeoff, extract
  shrinking, and the incremental refresh trap.
- **Parameters and actions.** Dynamic titles built from state, and when a
  highlight action beats a filter action.
- **Performance.** The Performance Recorder, mark counts, and high-cardinality
  quick filters.
- **Publishing and row-level security.** Group permissions, published data
  sources, and the entitlements-table pattern enforced at the data source.
- **Reconciliation.** Proving the headline number against source by a second path
  before anyone sees it.

Chart form, encoding, axis honesty, and colour are deliberately not covered here;
they belong to `skills/data/data-visualization-principles` and are treated as
normative.

## When to use this

Concrete triggers:

- A Tableau view is about to be published where someone who did not build it will
  act on the number.
- A percentage, margin, or rate on a dashboard does not match the source system.
- A total looks roughly double or triple what it should be.
- A Top N filter returns fewer items than N, or the wrong items.
- You are writing a calculated field and are unsure whether it needs FIXED,
  INCLUDE, EXCLUDE, a table calculation, or nothing at all.
- A table calculation changed its answer after you reordered pills.
- A dashboard takes seconds to respond to every click.
- You are choosing between an extract and a live connection.
- You are about to grant access to a published data source and different users
  must see different rows.
- Two dashboards built from the same source disagree.

Skip it when:

- The exploration is throwaway and will never be published.
- The question is which chart to draw or how to colour it (use
  `skills/data/data-visualization-principles`).
- The deliverable is a spreadsheet rather than a published view (use
  `skills/office/excel-dashboards`).

## Quick start

Four steps, in order.

**Step 1: state the grain of the data source**

Write one sentence in the data source description: "one row per order line". Then
prove it before building anything, because every measure depends on it:

```text
COUNT([Orders])      vs      COUNTD([Order ID])
```

Equal means one row per order. Divergence you did not intend means fan-out, and
every SUM on the dashboard is already inflated.

**Step 2: write ratios as a ratio of sums**

```text
// Wrong: a row-level ratio that Tableau must then average
[Profit] / [Sales]

// Right: aggregate first, divide second, guard the denominator
IF SUM([Sales]) = 0 THEN NULL
ELSE SUM([Profit]) / SUM([Sales])
END
```

**Step 3: pick the right level-of-detail tool**

```text
// Per-customer total that must not move as the view slices
{ FIXED [Customer] : SUM([Sales]) }

// Average order size when the view is sliced only by region
AVG({ INCLUDE [Order ID] : SUM([Sales]) })

// Each category's share of its region total
SUM([Sales]) / SUM({ EXCLUDE [Category] : SUM([Sales]) })
```

If the answer depends on the arrangement of marks already in the view (running
total, rank, year-over-year), it is a table calculation instead, and its Compute
Using must be set to Specific Dimensions by name.

**Step 4: reconcile before publishing**

```sql
SELECT SUM(profit) / SUM(sales) AS margin
FROM   orders
WHERE  order_date >= '2024-01-01'
AND    region = 'West';
```

Match every filter the dashboard applies, including data source and context
filters. If the check disagrees with the view, the view is wrong until proven
otherwise.

## Key concepts

- **Discrete vs continuous (blue vs green).** Discrete fields create headers and
  panes; continuous fields create axes. Independent of whether the field is a
  dimension or a measure.
- **Level of detail of a view.** The combination of dimensions present in the
  view. Every basic aggregate is computed once per combination, which is why
  adding a pill changes every number on the sheet.
- **Ratio of sums.** Aggregating numerator and denominator separately, then
  dividing. Weights each record by its size; the average of row ratios does not.
- **FIXED.** An aggregate at a declared grain, ignoring the view's dimensions and
  computed before dimension filters. For per-entity properties.
- **INCLUDE.** The view's dimensions plus extra ones, aggregated finer and then
  rolled up. For "average of sums" style measures.
- **EXCLUDE.** The view's dimensions minus some, giving a coarser total. For
  percent-of-parent denominators.
- **Table calculation.** Computed on the query result, over the marks in the view.
  Running totals, rank, percent difference, moving averages.
- **Compute Using.** The partitioning and addressing that a table calculation
  walks. Defaults re-point silently when pills move; always set it explicitly.
- **Order of operations.** Extract, data source, context, FIXED, dimension,
  INCLUDE/EXCLUDE, measure, table calculation filters, in that order.
- **Context filter.** A filter promoted to run first, creating a temporary subset
  so that Top N and FIXED expressions see only the scoped data.
- **Join fan-out.** A join to a finer-grained table duplicating rows, silently
  multiplying every measure from the coarser side.
- **Relationship.** The logical-layer link that keeps tables at their own grain
  and lets Tableau choose the join per viz. The safe default.
- **Blending.** Aggregating two separate sources independently and joining the
  aggregates on linking dimensions. Last resort, for sources that cannot share a
  connection.
- **Extract.** A columnar snapshot Tableau owns. Fast and stale. Live is fresh and
  pays the source's latency on every click.
- **Entitlements table.** A user-to-value mapping related to the fact table and
  enforced with a data source filter, which is how row-level security is actually
  implemented.

## Common pitfalls

**Averaging a ratio**

```text
AVG([Profit] / [Sales])                       // Bad: unweighted, wrong
SUM([Profit]) / SUM([Sales])                  // Good: ratio of sums
```

Reason: a 100 order and a 900 order count equally in the average.

**SUM on a measure that is already a rate**

```text
SUM([Conversion Rate])                        // Bad: sums percentages
SUM([Conversions]) / SUM([Sessions])          // Good: recompute from parts
```

Reason: rates do not add; only their numerators and denominators do.

**FIXED where the value should follow the filters**

```text
{ FIXED [Customer] : SUM([Sales]) }           // Bad: ignores the region filter
// Good: add the region filter to Context, or use INCLUDE instead
```

Reason: FIXED is evaluated before dimension filters in the pipeline.

**LOD left unaggregated in a coarser view**

```text
{ FIXED [Customer] : SUM([Sales]) }           // Bad: many values per cell
AVG({ FIXED [Customer] : SUM([Sales]) })      // Good: state the roll-up
```

Reason: the view must collapse the LOD somehow; say which way.

**Top N with a scoping filter**

```text
Filters: Region = West, Top 10 Customers      // Bad: top 10 computed globally
Filters: Region = West (Add to Context), Top 10 Customers   // Good
```

Reason: two dimension filters are evaluated independently, then intersected.

**Default Compute Using on a table calculation**

```text
Compute Using: Table (Across)                 // Bad: re-points when pills move
Compute Using: Specific Dimensions > Order Date   // Good: named, stable
```

Reason: the number changes with no warning when the view is rearranged.

**Join fan-out**

```text
Inner join Orders to monthly Targets on Order ID    // Bad: 3x every order line
Relationship between Orders and Targets             // Good: grains preserved
```

Reason: duplicated rows multiply every measure from the coarser table.

**Blending where a relationship would do**

```text
Two data sources blended on Region             // Bad: aggregate-only, nulls
One connection, tables related in the logical layer    // Good
```

Reason: the secondary source can contribute only aggregated values.

**Unfiltered extract**

```text
Extract: all columns, all history, full refresh nightly    // Bad
Extract: hidden unused fields, extract filter on date range    // Good
```

Reason: extract size drives refresh time and every query on top of it.

**High-cardinality quick filter**

```text
Quick filter: Customer Name, multi-select list    // Bad: queries 50k members
Parameter or wildcard match, or a narrowing hierarchy    // Good
```

Reason: the filter must fetch the field's domain before the view renders.

**Security as a sheet filter**

```text
Filter on the worksheet: Region = USERNAME()-derived    // Bad: removable
Data source filter with an entitlements table           // Good: travels
```

Reason: anyone who can web-edit or download the workbook can drop a sheet filter.

**Shipping without reconciliation**

```text
Publish, then wait for someone to question the number    // Bad
Recompute the KPI from source with matching filters first    // Good
```

Reason: the first wrong number a reader catches discredits every other one.

## See also

- `SKILL.md` in this directory: the full rule set, the order-of-operations
  pipeline, the LOD sections, and the reconciliation checklist.
- `skills/data/data-visualization-principles`: normative for chart form, encoding
  choice, zero baselines, dual axes, and colour. Pick the mark type there.
- `skills/office/excel-dashboards`: the spreadsheet equivalent, including the
  three-layer workbook, slicer wiring, and KPI cards.
- `skills/data/sql-for-analysts`: writing the reconciliation query that proves the
  headline number, and the NULL and join semantics behind fan-out.
- `skills/data/python-pandas-analysis`: validating merges and row counts before
  the data ever reaches Tableau.
- `skills/engineering/sql-optimization`: when the Performance Recorder shows the
  time is going to query execution rather than rendering.
- `skills/engineering/database-design`: the source schema and grain decisions that
  make a dashboard easy or impossible to build correctly.

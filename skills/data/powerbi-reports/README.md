# Power BI Reports

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="powerbi-reports robot" width="200">
</div>

A skill for the Power BI decisions that determine whether the number on the
canvas is right: star schema instead of a flat export, single-direction
relationships, a marked date table, measures instead of stored calculated
columns, and the filter-context rules behind every `CALCULATE`.

## What it does

A Power BI report fails quietly. It renders fast, looks finished, and reports a
plausible number that nobody can reproduce. This skill names each mechanism and
gives the fix:

- **Star schema.** Facts (one row per event, keys plus additive numbers) versus
  dimensions (one row per thing, unique key, descriptive text), and the four
  specific ways a single flat table breaks -- duplicate slicer values, missing
  zero-activity members, nothing cross-filtering, collapsed compression.
- **Relationships.** Why one-to-many single-direction is the default, and how one
  bidirectional relationship creates an ambiguous filter path the engine resolves
  by rules you cannot see on the canvas.
- **Date tables.** Why auto date/time is a trap, the DAX to build a real date
  dimension, and why marking it as a date table is not optional.
- **Measures vs calculated columns.** The most common silent-wrongness bug in the
  tool: a stored margin percentage summed into nonsense, a "share of total" whose
  denominator froze at refresh.
- **Filter context and row context.** What each one is, why `SUM` in a calculated
  column returns the grand total on every row, and what context transition does.
- **CALCULATE.** Replace versus intersect, `REMOVEFILTERS` versus `ALL`, and a
  worked percent-of-total that stops adding to 100 when you pick the wrong one.
- **Time intelligence.** Year-to-date, prior year, rolling windows, and the five
  failure modes that shift boundaries without raising an error.
- **Iterators.** When `SUMX` is required, when `SUM` is both correct and far
  cheaper, and which table to iterate.
- **DAX traps.** `DIVIDE` versus `/`, blank that behaves as zero, four counting
  functions that disagree, implicit measures nobody can review.
- **Model size and refresh.** Cardinality rather than row count drives size, and
  how incremental refresh depends on a filter that folds.
- **Publishing and row-level security.** Workspaces versus apps, roles tested in
  both desktop and service, and why RLS does not excuse a leaky detail page.
- **Reconciliation.** Proving each headline number against the source by hand,
  and the ordered list of suspects when it does not match.

## When to use this

Concrete triggers:

- A total on a report does not match the source system.
- A percentage column does not add to 100 once a slicer is applied.
- A slicer shows duplicate values, or omits members that exist.
- A measure ignores a filter it should respect, or respects one it should ignore.
- Year-over-year or year-to-date is wrong only at period boundaries.
- Someone switched a relationship to bidirectional to "make the slicer work".
- A calculated column is about to hold a ratio, percentage, or rate.
- The `.pbix` has grown to gigabytes, or refresh takes hours.
- Incremental refresh is configured and refresh time did not improve.
- Different users must see different rows of the same report.
- A report is about to be published where someone who did not build it will act
  on the number.

Skip it when:

- The exploration is throwaway and nobody will reuse the file.
- The problem is the refresh pipeline rather than the model or the DAX (use
  `skills/office/power-query-etl`).
- The question is which chart to draw or how to colour it (use
  `skills/data/data-visualization-principles`).

## Quick start

Five steps, in order.

**Step 1: split the export into facts and dimensions**

Before any visual, decide the grain of each table in one sentence -- "one row per
order line" -- and move every column you intend to slice, group, or filter by into
a dimension with a unique key. The fact table keeps foreign keys and numbers.

**Step 2: wire relationships one-to-many, single-direction**

Leave every cross-filter direction on Single. If a visual appears to need
bidirectional, scope the change to one measure instead:

```dax
Customers With Sales = CALCULATE( DISTINCTCOUNT( Customer[CustomerKey] ),
    CROSSFILTER( Sales[CustomerKey], Customer[CustomerKey], BOTH ) )
```

**Step 3: build and mark a date table**

Turn off auto date/time in `File > Options > Data Load`, then create a contiguous
date table covering every fact date and mark it with
`Table tools > Mark as date table`:

```dax
Date =
ADDCOLUMNS(
    CALENDAR( DATE( YEAR( MIN( Sales[OrderDate] ) ), 1, 1 ),
              DATE( YEAR( MAX( Sales[OrderDate] ) ), 12, 31 ) ),
    "Year",        YEAR( [Date] ),
    "MonthNumber", MONTH( [Date] ),
    "Month",       FORMAT( [Date], "mmm" ),
    "Quarter",     "Q" & FORMAT( [Date], "q" ),
    "IsFuture",    [Date] > TODAY()
)
```

Sort `Month` by `MonthNumber` or December sorts first alphabetically.

**Step 4: write ratios as measures, never stored columns**

```dax
Sales[MarginPct] = DIVIDE( Sales[Amount] - Sales[Cost], Sales[Amount] )  -- bad
Margin % = DIVIDE( [Total Sales] - [Total Cost], [Total Sales] )         -- good
```

Then state the intended denominator as a sentence and check the percentage column
totals 100 under at least two slicer selections.

**Step 5: reconcile against the source before publishing**

Hand-check revenue for one closed month, each fact table's row count, and the
distinct count of the main entity. Record the figure, source, and period next to
the report so the check is repeatable.

## Key concepts

- **Fact table.** One row per event, additive numbers plus foreign keys. Long and
  narrow.
- **Dimension table.** One row per thing, one unique key, descriptive text and
  hierarchies. Short and wide. Slicers and axes are built here.
- **Conformed dimension.** One Date and one Customer table shared by every fact,
  so two facts can sit on the same axis.
- **Cross-filter direction.** Single means filters travel dimension to fact only.
  Bidirectional lets the fact filter back, which is what creates ambiguity.
- **Ambiguous path.** Two or more routes between tables, so the engine resolves
  by rules invisible on the canvas.
- **Inactive relationship.** A second link between the same tables, activated per
  measure with `USERELATIONSHIP`. The answer to role-playing dates.
- **Marked date table.** A date table Power BI is told to treat as the date
  dimension. Time intelligence is only correct at period edges with the mark.
- **Calculated column.** Evaluated once per row at refresh and stored. Has row
  context, cannot react to a slicer.
- **Measure.** Evaluated at query time, once per cell, under that cell's filter
  context. Stores nothing, responds to every slicer.
- **Filter context.** The filters active at evaluation: row and column headers,
  slicers, page and report filters, cross-highlighting, `CALCULATE` arguments.
- **Row context.** A single row of a table, giving direct access to its values.
  Calculated columns and the inside of every iterator.
- **Context transition.** `CALCULATE`, and every measure reference, converting the
  current row context into an equivalent filter context.
- **KEEPFILTERS.** Makes a `CALCULATE` filter intersect the existing filter
  instead of replacing it.
- **REMOVEFILTERS vs ALL.** Clearing the filters on one table versus clearing
  everything -- the difference between a share that totals 100 and one that does
  not.
- **Iterator.** `SUMX`, `FILTER`, `ADDCOLUMNS`: functions that open a row context
  over a table and evaluate an expression per row.
- **Implicit measure.** An aggregation created by dragging a numeric column onto a
  visual. Unnamed, unreviewable; hide fact numerics to prevent it.
- **Incremental refresh.** Date partitioning of a fact driven by `RangeStart` and
  `RangeEnd`, which only helps if the filter folds to the source.
- **Row-level security.** DAX filters on a model role, members assigned in the
  service, usually a security dimension filtered by `USERPRINCIPALNAME()`.

## Common pitfalls

**One flat table sliced on its own columns**

```text
Sales[ProductName] on the slicer                  // Bad: dupes, missing members
Product[ProductName] on the slicer                // Good: dimension, unique key
```

Reason: `DISTINCTCOUNT` over a repeated fact column counts what sold, not what exists, so zero-activity members vanish.

**Bidirectional cross-filtering to fix a slicer**

```text
Set Sales <-> Customer to Both                    // Bad: ambiguous paths
CROSSFILTER( ..., BOTH ) inside the one measure   // Good: scoped
```

Reason: one bidirectional relationship gives the engine more than one route between tables, and it picks by rules you cannot see.

**Auto date/time left on**

```text
Rely on the hidden date hierarchy per date column  // Bad
One marked Date table related to every fact        // Good
```

Reason: hidden tables cannot be shared, extended, or marked, and a stray 1900 value generates a century of rows.

**A ratio stored as a calculated column**

```dax
Sales[MarginPct] = DIVIDE( Sales[Amount] - Sales[Cost], Sales[Amount] )  -- bad
Margin % = DIVIDE( [Total Sales] - [Total Cost], [Total Sales] )         -- good
```

Reason: the visual sums the stored percentages, which means nothing, and the value cannot react to a slicer.

**SUM inside a calculated column**

```dax
Sales[Wrong] = SUM( Sales[Amount] )                 -- grand total on every row
Sales[Right] = Sales[Quantity] * Sales[UnitPrice]   -- uses row context
```

Reason: row context does not filter; nothing restricts the `SUM`.

**ALL where REMOVEFILTERS on one table was meant**

```dax
Share Bad  = DIVIDE( [Total Sales], CALCULATE( [Total Sales], ALL( Sales ) ) )
Share Good = DIVIDE( [Total Sales],
    CALCULATE( [Total Sales], REMOVEFILTERS( Product ) ) )
```

Reason: `ALL( Sales )` also drops the region slicer, so the column stops adding to 100.

**Plain division**

```dax
Margin = [Profit] / [Sales]                  // Bad: infinity or error at zero
Margin = DIVIDE( [Profit], [Sales] )         // Good: blank, or a stated default
```

Reason: `DIVIDE` handles the zero and blank denominator explicitly.

**Testing zero instead of blank**

```dax
IF( [Total Sales] = 0, "none", ... )         // Bad: also catches missing data
IF( ISBLANK( [Total Sales] ), "none", ... )  // Good: distinguishes the two
```

Reason: blank behaves as 0 in arithmetic and `BLANK() = 0` is true.

**SUMX over the fact table for a precomputable column**

```dax
Revenue = SUMX( Sales, Sales[Quantity] * Sales[UnitPrice] )   // costly per cell
Revenue = SUM( Sales[LineAmount] )                            // Good: folded
```

Reason: a compressed column scan is far cheaper than iterating tens of millions
of rows on every cell.

**Every source column loaded "in case"**

```text
Load the whole table, hide what you do not use    // Bad: cardinality is the cost
Remove columns upstream so the removal folds      // Good
```

Reason: size is driven by column cardinality, not row count -- a GUID or a
second-grain datetime has as many distinct values as rows.

**Incremental refresh on a non-folding query**

```text
RangeStart/RangeEnd filter after a custom step    // Bad: reads the whole source
Partition filter first, folding, half-open bounds // Good
```

Reason: if the filter does not fold, partitioning buys nothing.

**Publishing without reconciliation**

```text
Publish, then wait for a reader to question the number    // Bad
Hand-check one closed month, row counts, distinct entities // Good
```

Reason: the first wrong number a reader catches discredits every other one.

## See also

- `SKILL.md` in this directory: the full rule set, the CALCULATE worked example,
  the time intelligence failure modes, and the reconciliation order of suspects.
- `skills/office/power-query-etl`: normative for the layer upstream of the model -- folding, staging, locale-pinned typing, and parameters.
- `skills/data/data-visualization-principles`: normative for chart form,
  encoding, zero baselines, and colour. A correct measure does not redeem a
  misleading visual.
- `skills/data/tableau-dashboard-builder`: the same problems in the other tool,
  including LOD expressions and the filter order of operations.
- `skills/office/excel-dashboards`: the spreadsheet equivalent, for when the
  deliverable is a workbook rather than a published report.
- `skills/data/sql-for-analysts`: writing the reconciliation query that proves
  the headline number.
- `skills/engineering/database-design`: the source grain and key decisions that
  make a star schema easy or impossible to build.
- `skills/engineering/sql-optimization`: when a DirectQuery model is slow because
  of the query rather than the model.

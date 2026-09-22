---
name: tableau-dashboard-builder
description: "Use when building a Tableau dashboard. Get the aggregation, the LOD expressions, and the filter order of operations right, then reconcile the headline number against source before publishing."
---

# Tableau Dashboard Builder

A Tableau dashboard is trusted or ignored, and what decides it is almost never
the layout: it is whether the numbers survive a spot check. The failures that
cost trust are quiet and none of them raise an error: a ratio averaged instead of
recomputed, a top-N filter applied before the filter meant to scope it, a join
that duplicated rows and doubled revenue.

This skill covers the Tableau-specific craft only. Chart form, encoding, axis
honesty, and colour are owned by `skills/data/data-visualization-principles` and
are normative here. The spreadsheet equivalent is `skills/office/excel-dashboards`.

## 1. Dimensions and measures: the green/blue distinction

Blue is discrete, green is continuous. The colour is not a data type label; it
states what the field does when you drop it on a shelf.

- **Blue (discrete) fields create headers and panes.** Each distinct value becomes
  a cell, and every measure is aggregated once per cell.
- **Green (continuous) fields create axes**, a range rather than a set of labels.
- **Dimension vs measure is the role; discrete vs continuous is the display**, and
  the two are independent. A date can be discrete (`YEAR(Order Date)` as a blue
  header) or continuous (a green axis with real spacing), producing genuinely
  different charts from the same field.
- **Change it deliberately** with right-click, Convert to Discrete or Continuous.
  A line chart with gaps where months had no rows is drawn on discrete dates,
  which show only the months present; continuous dates keep the span.

Every aggregation question downstream is the same one: which dimensions are in
the view, because those define the level of detail Tableau computes at.

## 2. Aggregation: the ratio of sums, not the sum of ratios

The most common wrong number on a Tableau dashboard, and it looks plausible. A
row-level field `[Profit] / [Sales]` computes a ratio per row; drop it in a view
and Tableau must aggregate it, giving `SUM(Row Margin)` or `AVG(Row Margin)`.
Neither is the margin.

```text
Order   Sales   Profit   Row Margin
A         100       10       0.10
B         900      180       0.20

AVG(Row Margin)                 = 0.15     wrong, unweighted
SUM([Profit]) / SUM([Sales])    = 190/1000 = 0.19   correct
```

The average treats a 100 order and a 900 order as equal voters; the ratio of sums
weights each order by its size, which is what "margin" means.

- **Write ratio calculations with the aggregation inside the field**:
  `SUM([Profit]) / SUM([Sales])`, not `[Profit] / [Sales]`.
- **Guard the denominator** with `IF SUM([Sales]) = 0 THEN NULL ELSE
  SUM([Profit]) / SUM([Sales]) END` plus a "no data" caption; a bare null KPI
  reads as broken.
- **Never mix aggregate and row-level references in one calculation.** Tableau
  rejects `SUM([Profit]) / [Sales]` outright: the two live at different levels.
- **Check the default aggregation on every new measure.** A `Conversion Rate`
  field that arrives already as a rate defaults to SUM, which is meaningless.
  Average it only if rows are equally weighted; otherwise recompute it from its
  numerator and denominator.

## 3. Level of Detail expressions

LOD expressions compute an aggregate at a level of detail you name, independent
of the dimensions in the view. Highest-value feature in the product, and the one
most often used where a table calculation or a plain aggregate belongs.

```text
{ FIXED  [Customer] : SUM([Sales]) }     ignores view dimensions entirely
{ INCLUDE [Product] : SUM([Sales]) }     view dimensions PLUS Product
{ EXCLUDE [Region]  : SUM([Sales]) }     view dimensions MINUS Region
```

**FIXED solves: a per-entity value that must not change as the view slices.**
`{FIXED [Customer] : MIN([Order Date])}` gives each customer an acquisition date
you can bin into cohorts, unchanged whether the view slices by region or month.

**INCLUDE solves: aggregating finer than the view, then rolling up.** Average
order size in a view sliced only by region: `AVG({INCLUDE [Order ID] :
SUM([Sales])})`. Without INCLUDE you get the average of line items, a different
and usually smaller number.

**EXCLUDE solves: a coarser total to compare each cell against.** Percent of
region total in a view sliced by region and category:
`SUM([Sales]) / SUM({EXCLUDE [Category] : SUM([Sales])})`; the denominator
collapses category away.

Rules that keep LODs correct:

- **FIXED is computed before dimension filters and unaffected by them.** A FIXED
  customer total does not shrink when you filter to one region; if it must, add
  the filter to Context (section 5) or switch to INCLUDE.
- **FIXED ignores the view; INCLUDE and EXCLUDE are relative to it.** Use FIXED
  when the grain is an absolute property of the entity, INCLUDE or EXCLUDE when
  it is "whatever the view has, plus or minus this".
- **Wrap the LOD in an outer aggregate when the view is coarser than its grain.**
  `{FIXED [Customer]: SUM([Sales])}` in a view sliced by region returns many
  values per cell, so write `AVG(...)` or `SUM(...)` around it.
- **A FIXED expression with no dimension is a grand total**: `{FIXED : SUM([Sales])}`
  is the whole-data sum, a stable percent-of-total denominator.
- **Do not reach for a LOD when a table calculation is the right tool** (next
  section). LODs query the data source and are expensive at high cardinality; a
  running total across rows already in the view is not a database question.

## 4. Table calculations vs LOD vs basic aggregates

| Tool | Computed | Scope | Use for |
| --- | --- | --- | --- |
| Basic aggregate | In the database | View dimensions | Sums, counts, ratio of sums |
| LOD expression | In the database | A grain you declare | Per-entity values, finer or coarser grains |
| Table calculation | On the returned result | Marks in the view | Running total, rank, percent difference, moving average |

- **Use a table calculation only for things that depend on the arrangement of
  marks**: running sums, year-over-year difference, rank, moving averages.
- **Always set Compute Using explicitly.** The default silently re-points when you
  add or reorder a pill, and the number changes with no warning. Prefer Specific
  Dimensions with the partitioning and addressing fields ticked by name.
- **A table calculation only sees what the view returned.** A rank over marks a
  filter removed is a rank over survivors; if the answer needs rows not in the
  view, use a LOD or a source-side query.
- **Prefer the basic aggregate when either would work**: it pushes down to the
  database, so it is fastest and easiest to reconcile.

## 5. Filters and the order of operations

```text
Extract filters
Data source filters
Context filters
FIXED LOD expressions
Dimension filters   (including Top N and condition filters)
INCLUDE / EXCLUDE LODs
Measure filters
Table calculation filters   (hide, do not remove)
```

The failure: you filter to Region = West and add a Top 10 Customers filter. Both
are dimension filters, evaluated independently against the whole data set. The
top 10 is computed globally, then intersected with West, leaving however many of
the global top 10 happen to be in West, possibly three.

- **Fix it by putting the scoping filter into Context** (right-click the pill,
  Add to Context). Context filters run first and create a temporary subset, so
  Top N is computed within West.
- **Context is also how you make a FIXED LOD respect a filter**, since Context
  runs before FIXED.
- **Use Context sparingly.** Each context creates a temporary table; two or three
  is normal, ten is a performance problem.
- **Know which filters remove data and which only hide it.** Dimension and measure
  filters remove rows from the query; a table calculation filter hides marks after
  computation, so totals still include the hidden rows.
- **Prefer a data source filter for rows nobody should ever see** (test accounts,
  cancelled orders); it applies first and cannot be unticked.

## 6. Data source design: joins, relationships, and blending

Join fan-out is the second classic wrong number: a measure that doubles because
rows were duplicated.

```text
Orders            1 row per order line
Order Targets     1 row per order per month (3 rows per order)

Inner join on Order ID  ->  each order line repeats 3 times
SUM([Sales])            ->  3x the real revenue, with no error
```

- **Default to relationships (the noodle in the logical layer), not joins.** They
  keep tables at their own grain and let Tableau choose the join type and level
  per viz, so a measure from the one-side is not multiplied by the many-side.
- **Use a physical join only for one flat table at a single grain**, and verify
  the row count before and after.
- **Test for fan-out immediately**: put `COUNT([Orders])` beside
  `COUNTD([Order ID])`. Unintended divergence means inflated measures.
- **Use blending only when the sources cannot share one connection.** It joins
  separately aggregated results on linking dimensions, so the secondary source
  contributes only aggregates and non-matching members appear as null.
- **Name the source's granularity in its description.** "One row per order line"
  prevents most of the errors above.

## 7. Extracts vs live connections

- **Live** queries the source on every interaction: fresh, but every user click
  is load on a production database. **Extract** is a columnar snapshot Tableau
  owns: far faster, filterable at extract time, offline-capable, stale between
  refreshes.
- **Choose live when the decision depends on data younger than your refresh
  interval** (operational monitoring, same-day inventory). Otherwise extract.
- **Shrink the extract at creation**: hide unused fields, apply extract filters,
  aggregate to the visible dimensions when nothing drills to row level.
- **Use incremental refresh only on append-only data keyed by a monotonic
  column**, with a periodic full refresh alongside it: rows updated in place after
  their key was loaded are never picked up.
- **Show the data timestamp on the dashboard face.** A view with no as-of stamp
  is read as current forever.

## 8. Parameters, dynamic titles, and actions

- **Parameters are a single value typed by the user, not a filter.** They do
  nothing until a calculation, filter, or reference line consumes them: what-if
  inputs, measure swapping, top-N cutoffs, date granularity switches.
- **Write the title from the state**, so a screenshot cannot lie:
  `"Sales by " + [Region Level] + ", top " + STR([Top N Parameter])`.
- **Use dynamic parameters** (value set from a field or on workbook open) so a
  hardcoded default does not silently go stale.
- **Filter actions** pass selected marks into other sheets. Set "Clearing the
  selection will" deliberately: Show all values for a dashboard, Exclude all
  values for a drill-down panel that should start empty.
- **Highlight actions** keep every mark visible and dim the rest. Prefer them when
  the reader needs context, because a filter action destroys the denominator.
- **Name Go to Sheet and Go to URL actions** so the tooltip says where the click
  leads, and **use Set actions for "selected versus everything else"** comparisons
  where membership drives a calculation rather than a filter.

## 9. Performance

- **Start with the Performance Recorder** (Help, Settings and Performance; on
  Server add `:record_performance=yes` to the URL). It shows time per event, so
  optimise the top bar rather than your guess.
- **Count the marks.** Tens of thousands of marks spend their time in rendering,
  and nobody reads that many. Aggregate, filter, or facet.
- **Quick filters on high-cardinality dimensions are expensive.** Replace a
  50,000-item dropdown with a parameter, a wildcard match, or a hierarchy.
- **Set "Only relevant values" knowingly**: it re-queries each filter as others
  change, slower but avoids listing members that return nothing.
- **Reduce the query, not the view.** Hide unused fields, delete unused
  calculations and sheets, push heavy transformation into the source.
- **Prefer few efficient calculations to nested chains**: deeply nested LODs and
  table calculations stacked on LODs cause seconds-per-click.

## 10. Publishing, permissions, and row-level security

- **Publish the data source separately** when more than one workbook uses it. A
  certified source gives one definition of the metric instead of drifting copies.
- **Grant permissions to groups, not users**, on the project so content inherits;
  per-workbook grants drift the moment someone copies the file. **Lock
  permissions to the project** where governance matters.
- **Row-level security: filter in the data, not in the view.** A sheet filter is
  removable by anyone who can web-edit or download the workbook.
- **The standard pattern is an entitlements table** mapping user names to the
  values they may see, related to the fact table, with a data source filter of
  `USERNAME() = [Entitled User]` (`ISMEMBEROF()` for groups) that runs first and
  travels with the published source.
- **Test it by impersonating**, not by reasoning: view the published source as
  another user and confirm the totals change.
- **Decide Download permissions explicitly**: Download Full Data hands over every
  row behind the view.

## 11. Reconcile before you ship

```sql
-- The number the dashboard shows, recomputed independently
SELECT SUM(profit) / SUM(sales) AS margin
FROM   orders
WHERE  order_date >= '2024-01-01'
AND    region = 'West';
```

- **Match the dashboard's filters exactly in the check query**, data source and
  context filters included, or you are comparing two populations.
- **Reconcile one KPI, one chart total, and the grand total.** If parts do not
  sum to the whole, suspect fan-out or a table calculation hiding marks.
- **Compare `COUNT()` against `COUNTD()` on the primary key** as a standing
  fan-out check on a hidden audit sheet.
- **Test the empty, one-row, and all-filters-cleared states.** Layouts collapse
  and ratios divide by zero exactly there.
- **Have someone who did not build it say what the dashboard tells them.** If
  their sentence is not the question you set out to answer, the dashboard is the
  problem, not the reader.

## Anti-patterns

- A row-level ratio field aggregated with SUM or AVG.
- FIXED where the value should follow the view's filters, with no context filter.
- A table calculation left on the default Compute Using after pills were reordered.
- A Top N filter alongside a scoping filter, neither of them in Context.
- Physical joins to a finer-grained table, inflating every measure on the sheet.
- A live connection to production for a dashboard that is refreshed daily, or an
  extract carrying every column and row of the source.
- A dashboard with no visible as-of timestamp.
- Quick filters listing tens of thousands of members.
- Security implemented as a sheet filter rather than on the data source.
- A headline number that has never been recomputed from the source.

## When to use this skill

Use it when a Tableau view will be published where someone who did not build it
will act on it, when two dashboards disagree, when a total looks too large, when
a top-N list looks wrong, or before granting access to a published source.

Skip it for a throwaway exploration you will not publish. Use
`skills/data/data-visualization-principles` for chart form and encoding, and
`skills/office/excel-dashboards` when the deliverable is a workbook.

---
name: powerbi-reports
description: "Use when building a Power BI model. Star schema, relationship cardinality, a real date table, measures over calculated columns, and the DAX contexts that decide whether the number is right."
---

# Power BI Reports

A report that renders fast and looks finished can still be wrong, and nothing on
the canvas says so. Most wrong numbers trace to one of three decisions made in
the first hour: the tables were left flat instead of modelled as a star, a
relationship was made bidirectional to "make the slicer work", or a value was
computed as a calculated column when it had to be a measure.

This skill owns the model and the DAX, not the ETL layer: folding, staging,
locale-pinned typing, and parameters live in `skills/office/power-query-etl` and
are normative here. Chart form, encoding, colour, and axis honesty belong to
`skills/data/data-visualization-principles` -- a misleading visual is not redeemed
by a correct measure behind it.

## 1. The star schema is the whole game

Split the export into facts and dimensions. A **fact table** has one row per
event, numeric and additive, plus foreign keys (sales lines, ledger postings,
state changes): long and narrow. A **dimension table** has one row per thing,
descriptive text and hierarchies, one unique key (Date, Customer, Product): short
and wide. Filters flow from dimensions into facts, so slicers, axes, and legends
are built on dimension columns, never on copies living in the fact table.

A single flat table breaks in ways that look like bugs elsewhere. Slicers show
duplicates and wrong counts, because `DISTINCTCOUNT` over a repeated attribute
counts attributes that happened to sell, not attributes that exist, so products
with zero sales vanish. Nothing cross-filters, since two flat tables cannot
filter each other. And compression collapses: a text column repeated over 40
million fact rows stores 40 million dictionary references instead of the few
thousand a dimension holds.

**Rule:** the fact table carries keys and numbers; a text column you group or
slice by belongs in a dimension. Conform dimensions -- one Date and one Customer
table shared by every fact, not `DateSales` and `DateBudget` -- and do not
snowflake for its own sake: flatten upstream, keep one hop to the fact.

## 2. Relationships: cardinality and cross-filter direction

**Cardinality.** One-to-many is the shape you want: the one side is the
dimension's unique key, the many side is the fact's foreign key. Many-to-many
composite relationships are legal and sometimes correct, but they change how
blanks and totals behave, so they must be deliberate rather than the result of a
duplicate key you did not notice.

**Cross-filter direction.** Single means filters travel dimension to fact only.
Bidirectional lets the fact filter the dimension too, and that starts ambiguity:
with two facts sharing two dimensions, one bidirectional relationship gives the
engine more than one path between tables. It picks a path by rules you did not
write and cannot see on the canvas, so a measure returns a plausible number for a
reason nobody can explain, or the model refuses the next relationship.

**Rule:** every relationship is single-direction unless you can name the visual
that requires otherwise and have compared totals before and after. For
role-playing dates (order, ship, due), use inactive relationships plus
`USERELATIONSHIP`, not three copies of the date table. Rather than switch a
relationship, scope the change to one measure:

```dax
Customers With Sales = CALCULATE( DISTINCTCOUNT( Customer[CustomerKey] ),
    CROSSFILTER( Sales[CustomerKey], Customer[CustomerKey], BOTH ) )
```

## 3. A dedicated date table; auto date/time is a trap

Auto date/time silently creates a hidden date hierarchy table per date column.
It is not shared, not visible, not extendable, and not markable. It bloats the
model (a stray 1900 or 2999 value generates a century of rows), it cannot put
two facts on one comparable axis, and you cannot add `FiscalQuarter` to a table
you cannot see. Turn it off in `File > Options > Data Load` for this file and
for new files, then build the table:

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

Contiguous days, no gaps, covering every fact date, full years if you use
year-to-date logic. Sort `Month` by `MonthNumber` in column tools or December
sorts first alphabetically. Mark it as a date table (`Table tools > Mark as date
table`) on the `Date` column: time intelligence relies on that mark, and without
it numbers are wrong at period edges with nothing erroring. Build the table in
Power Query instead when the model is DirectQuery or needs to fold -- DAX tables
are import-only.

## 4. Measures vs calculated columns

The most common silent-wrongness bug in the tool, because both options compile
and both display a number. A **calculated column** is evaluated once at refresh,
row by row, and stored; it has row context and cannot react to a slicer, because
it was computed before any user existed. A **measure** is evaluated at query
time, once per cell, under that cell's filter context; it stores nothing and
responds to every slicer. So a margin percentage stored as a column and then
summed in a visual gives the sum of row percentages, which means nothing; a stored
"share of total" freezes its denominator at refresh, so filtering leaves the
shares adding to something other than 100; and a high-cardinality calculated
column on a large fact can cost more memory than the columns it came from.

```dax
Sales[MarginPct] = DIVIDE( Sales[Amount] - Sales[Cost], Sales[Amount] )  -- bad
Margin % = DIVIDE( [Total Sales] - [Total Cost], [Total Sales] )         -- good
```

**Rule:** anything you aggregate is a measure. Use a calculated column only for
something you slice, group, or relate by, and prefer computing it in Power Query
so it compresses like a source column. Reference columns as `Table[Column]` and
measures as `[Measure]`, and never let a measure and a column share a name.

## 5. Filter context vs row context

**Filter context** is the set of filters active at evaluation: visual row and
column headers, slicers, page and report filters, cross-highlighting, and
anything `CALCULATE` added. Measures live here. **Row context** is a single row
of a table, giving direct access to that row's values; calculated columns and the
inside of every iterator (`SUMX`, `FILTER`, `ADDCOLUMNS`) live here.

Row context does not filter: inside a calculated column, `SUM(Sales[Amount])`
returns the whole column's total on every row, where
`Sales[Quantity] * Sales[UnitPrice]` correctly uses the row. Context transition
converts one to the other -- `CALCULATE`, and any measure reference (implicitly
wrapped in `CALCULATE`), turns the current row context into an equivalent filter
context, which is why `SUMX( Customer, [Total Sales] )` gives per-customer sales
rather than the grand total repeated. If a value must react to the visual it is
filter context and belongs in a measure; if it is a property of one row it is row
context.

## 6. CALCULATE modifies filter context

`CALCULATE(<expression>, <filter>, ...)` evaluates the expression under a
modified context. Each filter argument **replaces** the existing filter on the
columns it mentions and leaves the rest intact.

```dax
Total Sales       = SUM( Sales[Amount] )
Online Sales      = CALCULATE( [Total Sales], Sales[Channel] = "Online" )
All Product Sales = CALCULATE( [Total Sales], REMOVEFILTERS( Product ) )
Product Share %   = DIVIDE( [Total Sales], [All Product Sales] )
```

Worked example: a matrix with Product on rows and a Region slicer set to EU. In
the Bicycles row, `[Total Sales]` sees `Product = Bicycles` and `Region = EU`;
`[All Product Sales]` drops `Product = Bicycles`, keeps `Region = EU`, and
returns EU sales across all products, so `[Product Share %]` reads "this
product's share of EU sales" and the column totals 100 for any selection. Swap
`REMOVEFILTERS( Product )` for `ALL( Sales )` and the denominator becomes all
sales in all regions: the column stops adding to 100 and the report is quietly
wrong.

**Rule:** to intersect rather than overwrite a filter, wrap it in `KEEPFILTERS`.
Write the intended denominator as a sentence first, then check the percentage
column totals 100 under at least two slicer selections.

## 7. Time intelligence needs a marked date table

```dax
Sales YTD   = TOTALYTD( [Total Sales], 'Date'[Date] )
Sales LY    = CALCULATE( [Total Sales], SAMEPERIODLASTYEAR( 'Date'[Date] ) )
Sales YoY % = DIVIDE( [Total Sales] - [Sales LY], [Sales LY] )
Rolling 3M  = CALCULATE( [Total Sales],
    DATESINPERIOD( 'Date'[Date], MAX( 'Date'[Date] ), -3, MONTH ) )
```

Failure modes, none of which error: no mark or dates taken from the fact table
(boundaries shift, year-end totals off by days of revenue); gaps in the date
table (rolling windows silently shorten); a truncated final year (year-to-date
compares unequal windows); a fiscal year needing the year-end argument, as in
`TOTALYTD( [Total Sales], 'Date'[Date], "06-30" )`; and future dates, which make
the current period compare a full prior year against a partial one -- filter them
out with the `IsFuture` flag. Validate every time intelligence measure against
one hand-checked period before it reaches a report page.

## 8. Iterators: SUMX vs SUM

`SUM` aggregates one stored column; `SUMX` opens a row context over a table,
evaluates an expression per row, and sums the results.

```dax
Revenue       = SUMX( Sales, Sales[Quantity] * Sales[UnitPrice] )   -- needed
Revenue Wrong = SUM( Sales[Quantity] ) * SUM( Sales[UnitPrice] )    -- two totals
Big Customers = COUNTROWS(
    FILTER( VALUES( Customer[CustomerKey] ), [Total Sales] > 10000 ) )
```

Use `SUM` when the column exists: it is a direct scan of a compressed column and
far cheaper. Use `SUMX` for row-level expressions, for weighting
(`SUMX( Sales, Sales[Amount] * RELATED( Product[Weight] ) )`), or to iterate a
dimension so context transition yields a per-entity measure.

**Rule:** do not iterate the fact table for something Power Query could compute
as a column you then `SUM` -- iterating tens of millions of rows per cell is how a
report becomes unusable. Iterate the smallest table that answers the question.

## 9. DAX traps that produce numbers, not errors

**Division.** `/` yields infinity or an error on a zero denominator; `DIVIDE`
returns blank, or the alternative you state -- `DIVIDE( [Profit], [Sales] )` for
blank, `DIVIDE( [Profit], [Sales], 0 )` when zero is the honest story.

**Blank is not zero, except when it is.** Blank behaves as 0 in arithmetic, and
`BLANK() = 0` is true, so `IF( [m] = 0, ... )` also catches missing data -- use
`ISBLANK` to distinguish. Blank measures also drop rows from a visual, usually
helpfully, occasionally hiding the gap you needed to see. And the counting
functions differ: `COUNT` counts non-blank numeric values, `COUNTA` any
non-blank, `COUNTROWS` rows, `DISTINCTCOUNT` distinct values including blank -- a
count of a nullable column is not a count of rows.

**Implicit measures.** Dragging a numeric column onto a visual creates an
aggregation nobody can review: hide fact numeric columns and expose named
measures. And a measure using `ALL` discards page and report filters too,
including the one excluding test accounts.

## 10. Model size and refresh

Compression is driven by column cardinality and sort order, not row count. A
100 million row fact of low-cardinality integer keys can be smaller than a
5 million row table carrying a GUID and a free-text note. So: remove unused
columns upstream so it folds; split datetime into a date key plus, only if needed,
a time key, since second-grain datetime has as many distinct values as rows; drop
keys you never relate on, including a fact's own primary key; reduce numeric
precision the decision does not use; and read column statistics before optimising.

**Incremental refresh** partitions a fact by date so a refresh loads only recent
partitions. It needs two Power Query parameters named exactly `RangeStart` and
`RangeEnd` (datetime) used in a *folding* filter on the partition column, plus a
table policy setting the archive and refresh windows. If the filter does not fold,
every refresh reads the whole source and the partitioning buys nothing. Use
half-open bounds (`>= RangeStart and < RangeEnd`) so no row lands twice.

## 11. Report craft

Bookmarks capture filter, slicer, and visibility state: use them for
view-switching and reset buttons, but uncheck `Data` on a visibility-only
bookmark or it pins stale filters. Drillthrough carries context to a detail page -- add a back button and state which entity is in scope. Tooltip report pages let
a hover show a small chart instead of a number list. Set interactions per visual
pair (cross-filter vs cross-highlight) rather than accepting whatever the first
click produced. And write titles as assertions, dynamic where the visual depends
on a slicer, so a screenshot still says what it shows.

## 12. Publishing, workspaces, and row-level security

Develop in a workspace and publish an app: viewers get the app, not the
workspace. Row-level security is DAX filters on a role in the model with members
assigned in the service -- usually a security dimension related to the fact and
filtered by `[Email] = USERPRINCIPALNAME()`. Test every role with `View as role`
in the desktop file *and* again in the service, because membership resolution
differs. RLS does not excuse a leaky page: a detail table sourced from a table
with no role filter still shows every row. Credentials and gateway settings live
with the dataset, not the file, so a local refresh proves nothing about the
scheduled one -- never ship a dataset whose refresh has not succeeded on schedule
at least once with production credentials.

## 13. Reconcile before publishing

Every headline number gets checked against the source system by hand before
anyone sees it: revenue for one closed month, each fact table's row count, and
the distinct count of the main entity. On a mismatch, suspect in this order: a
filter left on a page or in the filter pane, a relationship that fanned out or is
inactive, an incomplete date table, a measure whose `ALL` or `REMOVEFILTERS`
removed more than intended, a partially failed refresh. Record the reconciliation
(figure, source, period) next to the report so the next person can repeat it
instead of re-deriving your intent.

## Anti-patterns

- One flat table from a spreadsheet export, sliced on its own columns.
- Bidirectional cross-filtering switched on to fix a slicer.
- Auto date/time left enabled and no marked date table.
- Percentages and ratios stored as calculated columns.
- Implicit aggregations dragged straight from fact columns onto visuals.
- `/` instead of `DIVIDE`, and `IF( [m] = 0 )` where `ISBLANK` was meant.
- `SUMX` over the fact table for something Power Query could precompute.
- Every source column loaded "in case we need it later".
- Incremental refresh configured on a query that does not fold.
- A report published with no reconciliation against the source.

## When to use this skill

Use it when a total does not match the source system, when a percentage column
does not add to 100 under a slicer, when a slicer shows duplicates or misses
values, when a measure ignores or over-ignores a filter, when year-over-year is
wrong only at period boundaries, when the file has grown to gigabytes or the
refresh to hours, or before publishing anything someone will decide from. Skip it
for a one-off visual over a small clean table nobody will reuse, and go to
`skills/office/power-query-etl` instead when the problem is the refresh pipeline
rather than the model or the DAX.

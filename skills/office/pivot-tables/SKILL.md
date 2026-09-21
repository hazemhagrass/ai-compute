---
name: pivot-tables
description: Use when summarising data with a pivot table. Get the grand totals right, avoid silent undercounts, stale caches, and averaged averages.
---

Build pivot tables whose numbers survive review. A pivot almost never shows an error dialog: it shows a clean, confident, wrong number. The source range missed the rows added last week, the Count field counted 812 instead of 940 because one cell held "n/a", and the grand total of an average column is not the average of the column above it. Every rule below exists because a pivot shipped a number somebody acted on.

## The working loop

1. **Fix the source first.** One header row, no blanks, no merged cells, no subtotals inside the data.
2. **Convert the source to a Table** (`Ctrl+T`), name it, and build the pivot on the name.
3. **Choose the aggregation deliberately.** Sum, Count, Count of Numbers, Average are four different questions.
4. **Read the grand total out loud.** If it is an average of averages, it is wrong.
5. **Refresh, then reconcile.** Compare one pivot cell against a `SUMIFS` on the raw data before anyone sees it.

## 1. The source must be a real table

A pivot reads a flat, rectangular list. Anything else corrupts it quietly.

```text
Bad source                          Good source
Region  Q1    Q2                    Region  Quarter  Revenue
North   100   120                   North   Q1       100
North   90    110                   North   Q1       90
North total 190 230   <- subtotal   North   Q2       120
(merged "South" header cell)        North   Q2       110
        80    95      <- blank key  South   Q1       80
```

**Rules:**

- **One header row, every column named, no gaps.** A blank header makes Excel invent `Column1` or refuse to build the pivot at all.
- **Never leave a merged cell in the source.** Merging keeps the value in the top-left cell only, so every other row in the merge arrives as blank and lands in a `(blank)` pivot row.
- **Never mix subtotal rows into the data.** The pivot has no idea they are summaries and adds them to the detail, doubling those groups.
- **Never leave a totals row at the bottom of the source.** Same double-count, harder to spot because the grand total merely looks large.
- **One fact per row, long not wide.** Quarters as columns force you to add a field per quarter forever. Quarters as values let one field handle all of them.
- **Delete fully blank rows inside the data.** With a range source, a blank row can truncate auto-detection at that point.

## 2. Build on a Table, never a range

This is the single highest-value rule on the page.

```text
Bad:  PivotTable Source = Sheet1!$A$1:$F$5000
Good: PivotTable Source = tbl_Sales
```

Select any cell in the data, press `Ctrl+T`, tick "My table has headers", then Table Design > Table Name and type `tbl_Sales`. Build the pivot with Insert > PivotTable and type `tbl_Sales` as the source.

Reason: a fixed range is frozen at `$A$1:$F$5000`. Paste 300 new rows and the pivot still reports on 5000 rows, and the totals simply look slightly stale rather than broken. A Table expands automatically as rows are appended, so Refresh always sees the full data set. Inserting a column inside a Table also extends the pivot's field list; inserting one inside a fixed range does not.

If you inherit a range-based pivot, fix it rather than patching the range every month: PivotTable Analyze > Change Data Source, then type the Table name.

## 3. Count vs Count of Numbers

```text
Bad:  drag Amount into Values, Excel picks Count because one cell holds "n/a"
Good: Value Field Settings > Summarize Values By > Sum, and clean the text cell
```

- **Count** counts every non-empty cell, text included.
- **Count of Numbers** (`COUNT`, not `COUNTA`) counts only numeric cells and silently skips `"n/a"`, `"-"`, `"TBC"`, and numbers stored as text.

Reason: a column with 940 rows where 128 hold `"pending"` reports 940 under Count and 812 under Count of Numbers. Both are defensible; neither is labelled; the reader assumes the one that suits them.

**Rules:**

- **If Excel auto-chose Count for a field you expected to Sum, stop and look.** It means the column is not fully numeric. Fix the data instead of overriding the aggregation.
- **Find the offenders before summarising:** in a helper column use `=ISTEXT(D2)` or `=COUNTA(D:D)-COUNT(D:D)` to get the exact number of non-numeric cells.
- **Rename the field to state the aggregation.** Double-click the value header and type `Orders (numeric only)`. "Count of Amount" tells the reader nothing about the 128 skipped rows.
- **Count distinct needs the Data Model.** Tick "Add this data to the Data Model" when inserting the pivot, then Value Field Settings > Distinct Count. Without the model that option does not exist.

## 4. The grand total trap

```text
Region   Avg order
North    100        (2 orders)
South    40         (98 orders)
Grand    41.2       <- NOT (100+40)/2 = 70
```

Excel computes the grand total from the underlying rows, not from the visible subtotals. That is the correct behavior and it is the one people misread.

**Rules:**

- **Never re-average the visible column.** `=AVERAGE(B2:B3)` over a pivot's average column gives an unweighted average that matches nothing.
- **Show the weight next to any average.** Drag the same field in twice: once as Average, once as Count. Without the denominator, a 100 built on 2 rows looks like the 40 built on 98.
- **Prefer Sum plus Sum for a ratio.** For average order value, show `Sum of Revenue` and `Sum of Orders`, then divide with a calculated field (see section 7), because the sum of sums is additive and the average of averages is not.
- **The same applies to percentages, medians, and distinct counts.** None of them roll up by addition. Only Sum, Count, Min, and Max do.

## 5. Show Values As

Right-click any value cell > Show Values As. This is the built-in way to get shares and trends without writing a single formula next to the pivot.

- **% of Grand Total**: each cell over the grand total.
- **% of Column Total** / **% of Row Total**: share within its column or row. Choose based on the question, because "23% of the North column" and "23% of the Europe row" are different claims.
- **% of Parent Row Total**: share within the immediate parent group, the right choice for a nested Region > City layout.
- **Running Total In**: cumulative along a chosen base field, typically Date or Month.
- **% Running Total In**: cumulative share, useful for Pareto ("the top 6 SKUs are 80% of revenue").
- **Difference From**: base field Month, base item `(previous)` gives month-on-month change.
- **% Difference From**: base field Month, base item `(previous)` gives month-on-month growth rate.
- **Rank Largest to Smallest**: ranks within a base field.

**Rules:**

- **Add the field twice.** Drag Revenue into Values twice: leave one as Sum for the absolute number and set the second to `% of Column Total`. A share with no absolute is unreadable.
- **Sort before applying Running Total.** The running total follows the visible order of the base field, so a wrongly sorted month axis produces a meaningless curve.
- **`% Difference From` shows the first period as blank, not zero.** There is no previous period. Do not fill it in.
- **Never hand-write `=B5/$B$12` beside a pivot.** Show Values As survives layout changes, filters, and slicers; the hand-written formula does not.

## 6. Grouping dates

Right-click any date in the pivot > Group > tick Months and Years, then OK.

```text
Bad:  tick Months only, then 2025-03 and 2026-03 collapse into one "Mar" row
Good: tick Years AND Months, giving 2025 > Mar and 2026 > Mar
```

**Rules:**

- **Always include Years when the data spans more than one year.** Month alone aggregates across years without saying so, which is the quietest wrong number a pivot produces.
- **Grouping requires real dates.** If Group is greyed out, the column contains text or one blank. Select it and use Data > Text to Columns > Finish to force conversion, or fix the blank.
- **Auto-grouping is applied on drop in modern Excel.** Dropping a date field into Rows creates Years and Quarters fields you did not ask for, so your field list suddenly shows `Years`, `Quarters`, and `OrderDate`. Turn it off at File > Options > Data > "Disable automatic grouping of Date/Time columns in PivotTables" when you need raw dates.
- **Grouping one pivot regroups every pivot sharing the cache.** Two pivots built from the same source share a cache, so the grouping is not local. If they must differ, build the second with a separate cache or use the Data Model.
- **Use "Number of days" grouping for weeks.** Group > Days > Number of days: 7, and set the start date to a Monday, because the group starts from the earliest date otherwise and your weeks straddle weekends.

## 7. Calculated fields vs calculated items

PivotTable Analyze > Fields, Items, & Sets.

- **Calculated field**: a new column computed from other fields, for example `Margin = Revenue - Cost`.
- **Calculated item**: a new row inside an existing field, for example `Q5 = Q1 + Q2` inside the Quarter field.

```text
Bad:  calculated field  AvgPrice = Price / Qty      (on Average of Price)
Good: calculated field  AvgPrice = Revenue / Qty    (Sum over Sum)
```

Reason: a calculated field operates on the **sum** of each referenced field, whatever aggregation you display. So a field defined on a column you are showing as Average still computes from sums, and the result matches neither the displayed averages nor the true average. If you need a ratio, define it as sum over sum and it is correct at every level including the grand total.

**Rules:**

- **Never build a calculated field on top of an averaged, min, max, or distinct-count field.** It will silently use the sum instead.
- **Calculated items slow the pivot and break the grand total.** The item is added to the field, so the grand total now includes both the parts and your synthetic whole. Prefer a grouping or a helper column in the source.
- **Prefer a helper column in the source Table over a calculated field** when the value is row-level (`=[@Revenue]-[@Cost]`). It is visible, auditable, and aggregates normally.
- **Use Power Pivot measures (DAX) for anything conditional.** Calculated fields cannot do `IF`, cannot ignore filters, and cannot do distinct counts.

## 8. GETPIVOTDATA and cell references

Type `=` then click a pivot cell and Excel writes:

```text
=GETPIVOTDATA("Revenue",$A$3,"Region","North","Quarter","Q1")
```

**Rules:**

- **Keep GETPIVOTDATA, do not fight it.** It looks up by field and item name, so it still returns North/Q1 after you reorder rows, add a field, or collapse a group. A plain `=D7` points at whatever now sits in D7.
- **Turn it off only for filling a formula across a block.** PivotTable Analyze > Options dropdown > untick "Generate GetPivotData", and accept that those references are now positional and fragile.
- **Make the arguments cell references so the formula drags:** `=GETPIVOTDATA("Revenue",$A$3,"Region",$A10,"Quarter",B$9)`.
- **Wrap it when an item may be filtered out:** `=IFERROR(GETPIVOTDATA(...),0)`, because a missing item returns `#REF!` and poisons every total downstream.
- **Never build a report of bare `=D7` references into a pivot.** One collapsed group silently reassigns every number on the report.

## 9. Refresh discipline and stale caches

A pivot reads a cached snapshot, not the sheet. Edit the source and the pivot does not move until you refresh.

**Rules:**

- **Turn on refresh-on-open.** PivotTable Analyze > Options > Data > tick "Refresh data when opening the file". Otherwise a file mailed on Friday shows Tuesday's numbers.
- **Refresh All (`Ctrl+Alt+F5`) before you screenshot, print, or send.** Single Refresh (`Alt+F5`) updates one pivot only.
- **Untick "Save source data with file"** on a big pivot to keep file size down, but only together with refresh-on-open, or the pivot opens empty.
- **Clear deleted items:** PivotTable Analyze > Options > Data > "Number of items to retain per field" set to `None`, then refresh, or filters keep offering items that no longer exist in the data.
- **Never edit values inside the pivot.** They are overwritten at the next refresh with no warning.

## 10. Blank vs zero

`(blank)` and `0` are different claims: "no rows matched" versus "the rows matched and summed to nothing".

**Rules:**

- **Set the empty display explicitly.** Right-click > PivotTable Options > Layout & Format > tick "For empty cells show" and enter `0` only when zero is the true business meaning, otherwise leave it empty.
- **A `(blank)` row label means missing source data,** usually a merged cell or an unfilled key. Fix the source, do not filter the row away.
- **Never use "For empty cells show: 0" ahead of a chart** unless absent months genuinely mean zero, because it turns gaps into a floor line that reads as real data.

## 11. Slicers across pivots

Insert a slicer with PivotTable Analyze > Insert Slicer. To drive several pivots: right-click the slicer > Report Connections, then tick every pivot it should control.

**Rules:**

- **Report Connections only lists pivots sharing the same cache or Data Model.** Two pivots built separately from the same range cannot share a slicer, so build the second with Copy/Paste of the first, or use the Data Model.
- **Use a Timeline for dates** (PivotTable Analyze > Insert Timeline) rather than a slicer with 700 date buttons.
- **Set "Hide items with no data"** in Slicer Settings so a stale item list does not imply data that is not there.

## 12. Power Pivot and the Data Model

For more than one table, do not `VLOOKUP` the columns together.

1. Tick "Add this data to the Data Model" when inserting the pivot.
2. Power Pivot > Manage > Diagram View, drag `Sales[CustomerID]` onto `Customers[CustomerID]`.
3. Build the pivot with fields from both tables and a DAX measure: `Revenue := SUM(Sales[Amount])`.

**Rules:**

- **Each lookup table must be unique on the key,** or the relationship is refused. That refusal is information: your dimension table has duplicates.
- **Always add a dedicated Date table** and mark it with Power Pivot > Design > Mark as Date Table, because time intelligence functions such as `TOTALYTD` require one.
- **Prefer explicit measures over dragging numeric columns in.** A measure is named, reusable, and testable; an implicit aggregation is none of those.
- **Distinct Count belongs here.** `DISTINCTCOUNT(Sales[OrderID])` is correct at every level; the classic pivot's Count is not.

## When a pivot is the wrong tool

- **A single fixed number in a sentence or a cell.** Use `=SUMIFS(tbl[Amount],tbl[Region],"North",tbl[Quarter],"Q1")`. It recalculates live with no refresh step.
- **A layout someone else formats or edits.** `SUMIFS` / `COUNTIFS` / `AVERAGEIFS` sit in a normal grid that never reshapes under them.
- **Millions of rows, or the source lives in a database.** Query it with SQL, or use Power Query (Data > Get Data) and load the aggregate.
- **The output must be diffable or version controlled.** Pivot caches are binary. A script (pandas, SQL) produces a reviewable artifact.
- **Anything conditional, recursive, or multi-step.** Power Query or DAX, not a pivot with six helper columns beside it.

## Anti-patterns

- Building on `Sheet1!$A$1:$F$5000` and re-pointing the range every month.
- Formatting numbers by selecting cells instead of Value Field Settings > Number Format, which is lost on the next refresh.
- Leaving field headers as `Count of Amount2` and `Sum of Amount3`.
- Averaging a pivot's average column to get an overall figure.
- Screenshotting a pivot without refreshing first.
- Writing `=D7/$D$12` beside the pivot instead of using Show Values As.
- Grouping dates by Month with no Year while the data spans two years.
- Keeping the Report Filter dropdown as the only clue that 60% of the data is hidden.

## When to use this skill

Use it when a pivot's total does not match a `SUMIFS` over the same data, when a count came back lower than the row count, when an average looks impossible, when a report went out on stale numbers, or when the pivot must be trusted by someone who will not rebuild it.

Skip it for a single number (use `SUMIFS`), for data that already lives in a database (query it), or for a pipeline that needs review and version control (write a script).

# Pivot Tables

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building pivot tables whose numbers survive review: Table-backed sources, deliberate aggregations, honest grand totals, Show Values As instead of hand-written ratios, and a refresh discipline that stops stale caches reaching the reader.

## What it does

A pivot table rarely errors. It returns a clean number that is wrong, and the layout makes it look authoritative. This skill names each mechanism and gives the exact fix:

- **Source hygiene**: one header row, no merged cells, no subtotals or totals rows inside the data, one fact per row.
- **Table vs range**: why `Sheet1!$A$1:$F$5000` silently ignores every row added since, and why `tbl_Sales` does not.
- **Count vs Count of Numbers**: the undercount that happens when one cell in a numeric column holds `"n/a"`.
- **The grand total trap**: why the grand total of an Average column is not the average of the column above it, and what to show instead.
- **Show Values As**: `% of Grand Total`, `% of Parent Row Total`, `Running Total In`, `% Difference From`, and why each beats a formula typed next to the pivot.
- **Date grouping**: Years plus Months (never Months alone), the greyed-out Group command, and the auto-grouping that invents fields on drop.
- **Calculated fields vs calculated items**: why a calculated field always operates on sums, so defining one over an Average is wrong.
- **GETPIVOTDATA**: why it is a feature, not an annoyance, and why `=D7` into a pivot breaks the first time a group collapses.
- **Refresh and caches**: refresh-on-open, `Ctrl+Alt+F5`, retained deleted items, and shared caches across pivots.
- **Blank vs zero, and slicers**: two different claims conflated by default formatting, plus Report Connections for driving several pivots from one control.
- **Power Pivot and the Data Model**: relationships instead of `VLOOKUP`, DAX measures, and correct distinct counts.
- **When not to pivot**: `SUMIFS`, Power Query, SQL, or a script.

## When to use this

Concrete triggers:

- A pivot total and a `SUMIFS` over the same data disagree.
- The pivot's row count is lower than the source row count and nobody can say why.
- Excel auto-chose Count for a field you expected to Sum.
- An average in the summary looks impossible next to the detail, or a percentage column was re-averaged by hand.
- Numbers added last week are missing from the report, or a file went out on cached numbers from the previous refresh.
- Month totals combine two different years into a single "Mar".
- A report of `=D7` style references broke after someone collapsed a group.
- Two pivots need one slicer and Report Connections shows an empty list.
- Fields from two tables need to appear in one pivot.

Skip it when:

- You need one fixed number in a cell or a sentence (use `SUMIFS`).
- The data already lives in a database (query it, or load an aggregate with Power Query).
- The output must be diffed or version controlled (write a script).

## Quick start

One worked example: a raw sales export becomes a revenue-by-region-and-quarter pivot with shares, growth, and a reconciliation check.

**Step 1: repair the source**

```text
Delete: the totals row at the bottom, every "Region total" row inside the data,
        every fully blank row.
Unmerge: Home > Merge & Center (toggle off), then fill the repeated key down
        with Home > Fill > Down, so every row carries its own Region.
Fill:   every header cell. No blanks, no duplicates.
Layout: one fact per row. Quarters become values in a Quarter column,
        not four separate columns.
```

**Step 2: make it a Table**

```text
Select any cell in the data > Ctrl+T > tick "My table has headers" > OK
Table Design > Table Name: tbl_Sales
```

Reason: the pivot now grows with the data. A fixed range does not, and it fails silently.

**Step 3: check the numeric column is actually numeric**

```text
=COUNTA(tbl_Sales[Amount])-COUNT(tbl_Sales[Amount])
```

Anything above `0` is the exact number of cells that Count of Numbers will skip. Find them with `=ISTEXT([@Amount])` in a helper column and fix them before building.

**Step 4: insert the pivot on the Table name**

```text
Insert > PivotTable > Table/Range: tbl_Sales
Tick "Add this data to the Data Model" (needed for Distinct Count later)
Place on a New Worksheet
```

**Step 5: lay it out**

```text
Rows:    Region, then City   (nested)
Columns: OrderDate           (group it, see step 6)
Values:  Amount              (three times, see step 7)
Filters: leave empty; use a slicer instead, because a filter dropdown
         hides the fact that data is hidden
```

**Step 6: group the dates correctly**

```text
Right-click any date in the pivot > Group > tick Years AND Months > OK
```

Months alone would merge Mar 2025 into Mar 2026 without saying so.

**Step 7: three value fields, each labelled**

```text
Amount #1: Value Field Settings > Sum        > Number Format: #,##0
           Custom Name: Revenue
Amount #2: Value Field Settings > Sum        > Show Values As > % of Column Total
           Custom Name: Share of quarter
Amount #3: Value Field Settings > Sum        > Show Values As > % Difference From
           Base field: OrderDate (Months), Base item: (previous)
           Custom Name: MoM growth
```

Set number formats inside Value Field Settings, never by selecting cells, because cell formatting is discarded on refresh.

**Step 8: add an honest denominator**

```text
Drag OrderID into Values > Value Field Settings > Distinct Count
Custom Name: Orders
```

A share or an average with no order count behind it invites the reader to treat a two-order region as comparable to a two-hundred-order one.

**Step 9: add a slicer wired to every pivot**

```text
PivotTable Analyze > Insert Slicer > Region
Right-click the slicer > Report Connections > tick every pivot
Right-click the slicer > Slicer Settings > tick "Hide items with no data"
```

**Step 10: set refresh behavior**

```text
PivotTable Analyze > Options > Data:
  tick "Refresh data when opening the file"
  "Number of items to retain per field": None
```

**Step 11: reconcile before anyone sees it**

```text
Ctrl+Alt+F5                                  (Refresh All)

In a scratch cell, against the raw Table:
=SUMIFS(tbl_Sales[Amount],tbl_Sales[Region],"North")

Against the pivot:
=GETPIVOTDATA("Revenue",$A$3,"Region","North")

Then:
=ROUND(<pivot>-<sumifs>,2)=0
```

If that last cell is not `TRUE`, the pivot is wrong and you found it before the reader did. The usual cause is a subtotal row still sitting in the source, or a range-based source that never saw the new rows.

## Key concepts

- **Cache, not formula.** A pivot reads a snapshot taken at the last refresh. Editing the source changes nothing on screen until you refresh, which is why a mailed file can show last week's totals with no visual hint.
- **Shared cache.** Pivots created by copying another pivot share one cache. Grouping dates or retaining items in one therefore changes the other, and only cache-sharing pivots can share a slicer.
- **Structured Table reference.** `tbl_Sales` resolves to the current extent of the Table, so appended rows are included automatically. `$A$1:$F$5000` is frozen at authoring time.
- **Count vs Count of Numbers.** Count is `COUNTA` (any non-empty cell). Count of Numbers is `COUNT` (numeric cells only). The gap between them is exactly the number of text cells in a column you believed was numeric.
- **Additive vs non-additive aggregations.** Sum, Count, Min, and Max roll up by combining subtotals. Average, median, percentage, and distinct count do not, so their grand totals must be computed from the underlying rows.
- **Calculated field.** A formula over fields, evaluated on the **sum** of each referenced field regardless of the aggregation you display. Correct for sum over sum, wrong over an Average. A **calculated item** is different: a synthetic member added inside a field, so the grand total counts both the parts and your synthetic whole.
- **Show Values As.** Built-in relative calculations (`% of Grand Total`, `Running Total In`, `Difference From`) that follow the pivot through filters, sorting, and layout changes.
- **GETPIVOTDATA.** Lookup by field and item name rather than by cell position, which is why it survives a collapsed group and `=D7` does not.
- **Data Model / Power Pivot.** An in-memory relational engine behind the workbook. Relationships replace `VLOOKUP`, DAX measures replace calculated fields, and `DISTINCTCOUNT` becomes correct at every level.

## Common pitfalls

**Range source instead of a Table**

```text
Bad:  Change Data Source > Sheet1!$A$1:$F$5000
Good: Ctrl+T on the data, name it tbl_Sales, then Change Data Source > tbl_Sales
```

Reason: new rows fall outside the frozen range, and the pivot reports a smaller total with no warning.

**Subtotals left inside the source**

```text
Bad:  a "North total" row sitting between the detail rows
Good: delete every summary row; the pivot creates its own
```

Reason: the pivot treats the summary as detail and double counts that group.

**Merged cells in the key column**

```text
Bad:  Region merged across four rows
Good: unmerge, then Home > Fill > Down so each row carries its Region
```

Reason: only the top-left cell keeps the value, so the other rows land under `(blank)`, which reads as missing data rather than as a formatting choice.

**Averaging an average**

```text
Bad:  =AVERAGE(B2:B9) over the pivot's "Avg order" column
Good: show Sum of Revenue and Sum of Orders, then divide
```

Reason: an unweighted mean of group means ignores group size and matches nothing.

**Count where you meant Sum**

```text
Bad:  accept "Count of Amount" because Excel chose it
Good: fix the text cells, then Value Field Settings > Sum
```

Reason: Excel defaults to Count precisely because the column is not fully numeric, so the default is a symptom.

**Months grouped without Years**

```text
Bad:  Group > Months
Good: Group > Years and Months
```

Reason: Mar 2025 and Mar 2026 silently collapse into one "Mar" row.

**Calculated field over an average**

```text
Bad:  AvgPrice = Price / Qty     (with Price shown as Average)
Good: AvgPrice = Revenue / Qty   (sum over sum)
```

Reason: a calculated field always uses the sum of each field, so the result matches neither the displayed averages nor the true average.

**Positional references into a pivot**

```text
Bad:  =D7/$D$12
Good: =IFERROR(GETPIVOTDATA("Revenue",$A$3,"Region",$A10),0)
```

Reason: collapsing a group or adding a field reassigns every cell address.

**Formatting cells instead of the field**

```text
Bad:  select the value block > Home > Number Format
Good: Value Field Settings > Number Format
```

Reason: direct cell formatting is discarded on the next refresh.

**Sending without refreshing**

```text
Bad:  save and mail
Good: Ctrl+Alt+F5, then PivotTable Analyze > Options > Data >
      tick "Refresh data when opening the file"
```

Reason: the recipient sees the cache as of your last refresh, with nothing on screen to say so.

**Ghost items in filters**

```text
Bad:  filters keep offering regions that no longer exist in the data
Good: Options > Data > "Number of items to retain per field": None, then refresh
```

Reason: Excel retains deleted items by default, so filters imply data that is gone.

**VLOOKUP instead of a relationship**

```text
Bad:  =VLOOKUP([@CustomerID],Customers!A:D,3,FALSE) pasted down 400k rows
Good: Data Model > Diagram View > drag Sales[CustomerID] onto Customers[CustomerID]
```

Reason: the lookup column is a copy that goes stale and bloats the file; a relationship is evaluated live.

**A pivot where a formula belongs**

```text
Bad:  a whole pivot sheet to produce one number for a slide
Good: =SUMIFS(tbl_Sales[Amount],tbl_Sales[Region],"North",tbl_Sales[Quarter],"Q1")
```

Reason: `SUMIFS` recalculates automatically and has no cache to go stale.

## See also

- `SKILL.md` in this directory: the full rule set with menu paths and paired examples for all twelve areas.
- `skills/data/python-pandas-analysis`: the same aggregation problems in code, with `pivot_table`, `groupby`, and shape assertions.
- `skills/engineering/sql-optimization`: when the aggregation belongs in the database rather than in a workbook.
- Microsoft docs: "Create a PivotTable", "Show different calculations in PivotTable value fields", "Group or ungroup data in a PivotTable", `GETPIVOTDATA`, `SUMIFS`, and "Create a Data Model in Excel".
- Power Query (Data > Get Data): the right tool for reshaping and cleaning before a pivot ever sees the data.

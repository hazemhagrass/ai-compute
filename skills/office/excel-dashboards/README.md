# Excel Dashboards

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building one screen that answers one question and keeps answering it after the next data drop: layered workbooks, chart types chosen from the comparison, slicers wired to everything they should drive, honest axes, and a reconciliation pass before the file leaves your hands.

## What it does

A dashboard rarely errors. It shows a confident number that is stale, truncated, or encoding a comparison nobody asked for. This skill names each mechanism and gives the fix:

- **Layered structure**: Data, Calc, and Dashboard sheets, why every fact-producing formula belongs on Calc, and why a formula hidden behind a chart is a formula nobody audits.
- **Visual hierarchy**: the question in row 1, at most five KPI cards, the explaining chart below, and the detail at the bottom.
- **Chart selection**: a comparison-to-chart table, sorted bars, the five-series limit on lines, and why a second value axis makes the crossover point an artifact of scaling.
- **Axis honesty**: zero baselines for length encodings, explicit bounds so auto-scaling does not rewrite the conclusion at the next refresh, and unit formatting instead of dividing the source.
- **Ranges that grow**: Tables and pivots as chart sources, defined names over spill ranges, and the `INDEX` pattern that replaces volatile `OFFSET` names.
- **Slicers**: Report Connections, shared caches, making the filtered state visible, and the empty-selection message that stops a blank panel reading as a broken file.
- **KPI cards**: value plus comparison plus direction, computed deltas, `"n/a"` instead of `#DIV/0!`, and a metric definition table with a `GoodDirection` column.
- **In-cell visuals**: data bars, colour scales, icon-set thresholds set to Number rather than Percent, and sparklines on a shared axis.
- **Colour and grid**: one accent plus grey, never red/green alone, gridlines off, cell-grid alignment, and number formats that carry the units.
- **Performance**: aggregate once, ban volatile functions, Power Query connection-only loads, measures over computed columns, and measuring before optimising.
- **Refresh and distribution**: visible as-of stamps, retained-item cleanup, frozen panes, print areas, sheet protection that keeps slicers clickable, and snapshot copies.
- **Reconciliation**: a check block on Calc, one `AllChecksPass` cell on the face, parts-sum-to-whole, row counts, and empty-state testing.

## When to use this

Concrete triggers:

- A number on the dashboard disagrees with the same number from the source system.
- A chart stopped including new rows and nobody noticed for a month.
- Someone asks how old the data is and the sheet cannot answer.
- A slicer filters half the screen and leaves the other half unfiltered.
- The dashboard has two value axes and the "crossover" is being discussed as a finding.
- A column chart's axis starts at 90 and a 1% difference looks like a tripling.
- A delta column compares against a prior-period figure that was typed in by hand.
- Clicking a slicer takes several seconds and the team now circulates screenshots instead.
- Ten pie slices, or two pies side by side, are the main visual.
- The same report is rebuilt manually every Monday.
- The recipient prints it and it comes out across nine pages.
- `#DIV/0!` or `(blank)` appears anywhere a reader can see it.

Skip it when:

- The chart is a one-off for a single email.
- The analysis is exploratory and nobody else will read it.
- The audience needs row-level access with their own filters (ship the Table or a BI tool).
- The model needs joins across several sources, versioning, or tests (move to SQL or pandas).

## Quick start

One worked example: a raw sales export becomes a one-screen revenue dashboard with KPI cards, a ranked region chart, a slicer, and a reconciliation check.

**Step 1: build the three layers**

```text
Sheet "Data"        paste or query the raw export. Nothing else.
Sheet "Calc"        Tables, pivots, parameters, checks.
Sheet "Dashboard"   charts, cards, slicers, text.
```

Right-click Data and Calc, Hide, once the dashboard is finished.

**Step 2: make the source a Table**

```text
Select any cell in the raw data > Ctrl+T > tick "My table has headers" > OK
Table Design > Table Name: tbl_Sales
```

**Step 3: put the parameters in one block on Calc**

```excel
PeriodStart   =DATE(2026,1,1)
PeriodEnd     =EDATE(PeriodStart, 3)
PriorStart    =EDATE(PeriodStart, -3)
```

Name each cell in Formulas, Name Manager. Half-open bounds (`>=` start, `<` end) so a timestamp on the final day is not dropped.

**Step 4: compute the KPI on Calc, not on the dashboard**

```excel
CurrentRevenue =SUMIFS(tbl_Sales[Amount], tbl_Sales[Date], ">=" & PeriodStart, tbl_Sales[Date], "<" & PeriodEnd)
PriorRevenue   =SUMIFS(tbl_Sales[Amount], tbl_Sales[Date], ">=" & PriorStart, tbl_Sales[Date], "<" & PeriodStart)
Delta          =IFERROR(CurrentRevenue / PriorRevenue - 1, "n/a")
Direction      =IF(N(Delta) > 0, "▲", IF(N(Delta) < 0, "▼", "▬"))
```

**Step 5: build the ranked chart on a pivot**

```text
Insert > PivotTable > Table/Range: tbl_Sales > New Worksheet (rename it Calc_Pivots)
Rows: Region      Values: Sum of Amount
Sort the value column descending
PivotTable Analyze > PivotChart > Bar (horizontal, sorted)
```

Horizontal bars because region names are long, sorted because ranking is the question.

**Step 6: fix the axis and strip the decoration**

```text
Right-click value axis > Format Axis > Bounds > Minimum: 0 (explicit, not Auto)
Number format: #,##0,,"M"
Delete: gridlines, legend (single series), chart border, any 3D effect
Chart Design > Add Chart Element > Data Labels > Outside End
```

**Step 7: add the slicer and wire it everywhere**

```text
PivotTable Analyze > Insert Slicer > Region
Right-click slicer > Report Connections > tick EVERY pivot on the dashboard
Right-click slicer > Slicer Settings > tick "Hide items with no data"
Insert > Timeline > Date   (for the period range)
```

**Step 8: stamp the data age**

```excel
="Data as of " & TEXT(RefreshedAt, "yyyy-mm-dd hh:mm")
```

`RefreshedAt` is written by the refresh routine. Do not use `NOW()`: it reports when the file was opened, not when the data landed.

**Step 9: reconcile**

```excel
Headline      =GETPIVOTDATA("Sum of Amount", Calc_Pivots!$A$3, "Region", "North")
Independent   =SUMIFS(tbl_Sales[Amount], tbl_Sales[Region], "North")
Check         =ROUND(Headline - Independent, 2) = 0
PartsWhole    =ROUND(SUM(PivotValueColumn) - CurrentRevenue, 2) = 0
RowCount      =ROWS(tbl_Sales)
AllChecksPass =AND(Check, PartsWhole)
```

Surface `AllChecksPass` on the dashboard with a conditional format. If it is not `TRUE`, the dashboard is wrong and you found it before the reader did.

**Step 10: set refresh, freeze, protect**

```text
PivotTable Analyze > Options > Data:
  tick "Refresh data when opening the file"
  "Number of items to retain per field": None
View > uncheck Gridlines; View > Freeze Panes below the header block
Page Layout > Print Area, and Fit Sheet on One Page
Review > Protect Sheet > allow "Use PivotTable & PivotChart" and "Edit objects"
```

**Step 11: break it on purpose**

Append rows to the source and confirm the chart and `ROWS(tbl_Sales)` both move. Filter the slicer to a region with no data and confirm the panel says so instead of going blank. Delete a category and confirm it disappears from the filter list after a refresh.

## Key concepts

- **Layer separation.** Data holds raw rows, Calc holds every formula that produces a fact, Dashboard holds only references and visuals. Mixing them means the next export overwrites logic.
- **Encoding.** A bar encodes value as length, so its axis must start at zero. A line encodes change as slope, so a truncated axis is legitimate when labelled. The encoding, not taste, decides.
- **Dynamic source.** Tables, pivots, and spill ranges resize themselves. A fixed range (`$B$2:$B$500`) is frozen at authoring time and fails silently when the data outgrows it.
- **Spill-range series.** Chart series formulas reject a raw `B2#` reference. Define a name over the spill range and point the series at the name.
- **Volatility.** `OFFSET`, `INDIRECT`, `NOW`, `TODAY`, and `RAND` recalculate on every workbook change and drag their dependents with them. `INDEX`-based dynamic ranges and Tables do the same job without the cost.
- **Shared cache.** Only pivots built from the same cache can share a slicer. Copy the first pivot to create the others, or build all of them on the Data Model.
- **Report Connections.** The dialog that says which pivots a slicer actually drives. A new slicer drives exactly one by default.
- **Icon-set threshold type.** Percent thresholds move with the distribution, so identical values change colour between refreshes. Number thresholds are stable.
- **Good direction.** Whether a rise is good depends on the metric. Store it in a metric definition table and drive the colour from it, rather than colouring every increase green.
- **As-of stamp.** The timestamp written by the refresh routine, displayed on the face of the sheet. Without it, a stale dashboard is indistinguishable from a current one.
- **Reconciliation check.** A headline number recomputed by an independent path, with the difference rounded and compared to zero. It is the only thing standing between a wrong pivot and a decision.

## Common pitfalls

**Formulas on the dashboard sheet**

```text
Bad:  =SUMIFS(...) typed into the cell behind a KPI card
Good: compute on Calc, reference the result from the card
```

Reason: a formula hidden under a chart object is never audited and is destroyed by the next layout change.

**Fixed chart range**

```text
Bad:  Select Data > Chart data range: =Data!$A$1:$D$500
Good: build the chart on tbl_Sales or on a pivot
```

Reason: rows appended past 500 are excluded with no visual signal.

**Volatile dynamic name**

```excel
=OFFSET(Calc!$B$2, 0, 0, COUNT(Calc!$B:$B), 1)                  // Bad
=Calc!$B$2:INDEX(Calc!$B:$B, COUNT(Calc!$B:$B)+1)               // Good
```

Reason: `OFFSET` recalculates on every workbook change and makes the dashboard lag on every keystroke.

**Truncated bar axis**

```text
Bad:  column chart, value axis Minimum: 90
Good: column chart, value axis Minimum: 0 (explicit)
```

Reason: bars encode value as length, so a non-zero baseline multiplies small differences visually.

**Auto axis bounds on a recurring report**

```text
Bad:  leave Bounds on Auto
Good: set Minimum and Maximum explicitly
```

Reason: the next data drop rescales the chart and the reader sees a change in shape that is not a change in the data.

**Dual value axes**

```text
Bad:  revenue on the left axis, conversion rate on the right
Good: two stacked charts sharing an x axis, or both series indexed to 100
```

Reason: the crossover point is set by the scaling you chose, and readers treat it as a finding.

**Pie with many slices**

```text
Bad:  a ten-slice pie of revenue by region
Good: a horizontal bar chart sorted descending
```

Reason: angle comparison is unreliable and degrades as slice count rises; length comparison does not.

**Unsorted bar chart**

```text
Bad:  regions in alphabetical order
Good: sorted by value, descending
```

Reason: the chart exists to show the ranking, and alphabetical order hides it.

**Slicer connected to one pivot**

```text
Bad:  insert the slicer and ship
Good: right-click > Report Connections > tick every pivot
```

Reason: half the dashboard filters and half does not, producing a screen that cannot be true.

**Hand-typed comparison**

```excel
=CurrentRevenue / 1482000 - 1        // Bad
=CurrentRevenue / PriorRevenue - 1   // Good
```

Reason: the typed baseline goes stale at the next refresh and nothing flags it.

**Division by zero on the face**

```excel
=Current / Prior - 1                       // Bad: #DIV/0! when Prior is 0
=IFERROR(Current / Prior - 1, "n/a")       // Good
```

Reason: one visible error cell costs the reader's trust in every other number on the sheet.

**Percent-based icon thresholds**

```text
Bad:  Icon Set > Type: Percent (the default)
Good: Icon Set > Type: Number, with real cutoffs
```

Reason: the icons re-sort themselves whenever the distribution moves, so a value can change colour without changing.

**Per-row sparkline scaling**

```text
Bad:  leave sparkline axis on Automatic for each sparkline
Good: Sparkline > Axis > Same for All Sparklines
```

Reason: independently scaled rows make a 2% wobble and a 200% swing look identical.

## See also

- `SKILL.md` in this directory: the full rule set across all twelve areas.
- `skills/office/pivot-tables`: the aggregation layer most dashboards sit on, including cache, refresh, and grand-total traps.
- `skills/office/excel-formulas`: exact-match lookups, anchoring, criteria strings, and rounding for the Calc layer.
- `skills/office/excel-data-cleaning`: fixing the export before it reaches the Data sheet.
- `skills/data/data-visualization-principles`: choosing the encoding before choosing the chart.
- `skills/design/presentation-design`: when the dashboard becomes a slide and needs a stated conclusion.
- Microsoft docs: "Create a PivotChart", "Use slicers to filter data", "Add sparklines", "Use conditional formatting", and Power Query "Get & Transform Data".

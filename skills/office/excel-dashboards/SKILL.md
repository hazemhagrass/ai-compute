---
name: excel-dashboards
description: Use when building an Excel dashboard, KPI sheet, or recurring report. Separate data from presentation, pick chart types that answer the question, wire slicers correctly, and reconcile every headline number before it ships.
---

Build one screen that answers a stated question and keeps answering it after the next data drop. A dashboard fails in three ways, and none of them look like an error: the chart encodes a comparison nobody asked for, the ranges stopped growing when rows were appended, or the reader sees a cached number with no hint of how old it is. Every rule below prevents one of those.

## The working loop

1. **Write the question first.** One sentence at the top of the sheet: "Which regions are below plan this quarter, and by how much?" A dashboard without a written question becomes a chart gallery.
2. **Build three layers.** Raw data, calculation, presentation. Never mix them on one sheet.
3. **Make every source a Table or a query**, so ranges grow without an edit.
4. **Chart the comparison, not the columns.** Pick the chart from the question, then map the fields.
5. **Reconcile.** Every headline number gets a check cell that recomputes it from raw data by a different path.
6. **Break it.** Append rows, filter to nothing, delete a category. Then look again.

## 1. Three layers, three sheets

A dashboard that reads directly from the raw export cannot be refreshed, audited, or rebuilt when the export shape changes.

```text
Data        one sheet per source, raw, untouched, hidden
            (or Power Query connections only, no sheet at all)
Calc        Tables, pivots, measures, lookup tables, parameter cells
Dashboard   charts, KPI cards, slicers, text. No formulas that compute facts.
```

**Rules:**
- Put every formula that produces a fact on the Calc sheet. The Dashboard sheet references results, never computes them, because a formula hidden behind a chart is a formula nobody audits.
- Never type a number a reader will act on directly into the Dashboard sheet. If it is not traceable to the Data layer, it is decoration.
- Hide Data and Calc with Format, Hide Sheet. Do not delete them, and do not use `xlVeryHidden` as a security measure; it is a tidiness measure.
- Keep every input parameter (as-of date, target, scenario) in one labelled block on Calc, formatted distinctly. Inputs scattered among formulas get overwritten.

## 2. One question, and a visual hierarchy that answers it

Readers scan top-left first, then across, then down. Put the answer where the eye lands.

```text
Row 1     Title, the question in plain words, and "Data as of <cell>"
Row 2-3   3 to 5 KPI cards: value, comparison, direction
Row 4+    The chart that explains the KPIs
Bottom    Detail table, filters, footnotes, definitions
```

**Rules:**
- Cap the dashboard at what fits one screen at 1920x1080 without scrolling. A second screen is a second dashboard with its own question.
- Limit to five KPI cards. Past five, none of them is key.
- Every number carries a comparison (vs plan, vs prior period, vs the same period last year). A bare value cannot be judged as good or bad.
- Stamp the refresh time on the face of the sheet: `="Data as of " & TEXT(RefreshedAt, "yyyy-mm-dd hh:mm")`, where `RefreshedAt` is written by the refresh step, not by `NOW()`, because `NOW()` reports when the file was opened rather than when the data landed.

## 3. Pick the chart from the comparison

The question names a comparison; the comparison names the chart. Choosing a chart first and fitting data to it is how dual-axis spaghetti gets shipped.

| Question | Chart |
| --- | --- |
| How did this change over time? | Line (time on x, continuous) |
| How do categories rank? | Horizontal bar, sorted by value |
| What is the composition, over time? | Stacked column or area with few series |
| Is there a relationship between two measures? | Scatter |
| How far is each item from its target? | Bullet chart (bar plus target marker) |
| How is one value distributed? | Histogram or box plot |

**Rules:**
- Sort bar charts by value, descending, unless the category has a natural order (months, sizes, stages). Alphabetical order hides the ranking that the chart exists to show.
- Use a horizontal bar when labels are long. Rotated axis text costs the reader a head tilt on every label.
- Limit a line chart to five series. Past that, use small multiples: one small chart per series on a shared scale.
- Never use pie for more than three slices, and never for comparing two pies. Angle judgement is worse than length judgement, and it gets worse as slices multiply.
- Never use 3D, shadows, or gradients on a data series. They add pixels that encode nothing and distort area.
- Do not use a second value axis. Two scales make the crossover point an artifact of scaling. Use two stacked charts sharing an x axis, or index both series to 100 at a base period.

## 4. Axes lie by default

```text
Bad:   a column chart whose value axis starts at 90, making 92 look triple 91
Good:  column and bar value axes start at zero, always

Bad:   a line chart auto-scaled to 0 on a series that ranges 4.1 to 4.3
Good:  a line chart may start above zero, labelled clearly
```

**Rules:**
- Bar and column charts encode value as length, so the axis must start at zero. Line charts encode change as slope, so a truncated axis is legitimate when labelled.
- Set the axis bounds explicitly on any chart a reader compares across refreshes, because auto-scaling changes the visual conclusion when new data arrives while the underlying story has not changed.
- Format the axis in the units the reader thinks in (thousands, millions) using a custom number format (`#,##0,,"M"`), not by dividing the source data.
- Delete gridlines that no one reads a value from. Keep at most a light horizontal set on a line chart.
- Label the series directly at the end of the line instead of using a legend, when there are four series or fewer. A legend forces a colour-to-name lookup on every glance.

## 5. Ranges that grow

A chart pointed at `Sheet1!$B$2:$B$500` stops including data at row 501 and never says so.

```text
Bad:  Select Data > Chart data range: =Data!$A$1:$D$500
Good: build the chart on tbl_Sales, or on a pivot, or on a spilled range
```

**Rules:**
- Chart a Table (`Ctrl+T`, then Table Design, Table Name) or a PivotTable. Both resize themselves.
- For a chart that must follow a dynamic array, define a name over the spill range and use it as the series: `=Calc!$B$2#`. Series formulas accept defined names, not raw spill references, so wrap it: `ChartVals` refers to `=Calc!$B$2#`, then the series reads `=Book1.xlsx!ChartVals`.
- Avoid `OFFSET`-based dynamic names. They are volatile and recalculate the whole chain on every keystroke; `INDEX` gives the same range without the cost: `=Calc!$B$2:INDEX(Calc!$B:$B, COUNT(Calc!$B:$B)+1)`.
- After appending a data drop, check the row count on the face of the Calc sheet (`=ROWS(tbl_Sales)`) and compare it to the source. A silently truncated chart and a correct one look identical.

## 6. Slicers, timelines, and the connections nobody wires

Slicers filter pivots and Tables. They do not filter formulas, and a slicer that looks connected to a chart may drive nothing.

```text
PivotTable Analyze > Insert Slicer > Region
Right-click slicer > Report Connections > tick EVERY pivot it should drive
Right-click slicer > Slicer Settings > Hide items with no data
Insert > Timeline  (dates only; a timeline beats a date slicer for ranges)
```

**Rules:**
- Open Report Connections on every slicer before shipping. A slicer created on one pivot drives only that pivot by default, so half the dashboard filters and half does not.
- Only pivots sharing a cache can share a slicer. Create additional pivots by copying the first one, or by building all of them on the Data Model, because pivots built independently from the same Table get separate caches.
- Make a filtered state visible. Add a cell that names the active selection (`=IF(COUNTA(...)=0, "All regions", ...)`) or read it from a `CUBERANKEDMEMBER` against the slicer, so a screenshot cannot hide that a filter is on.
- Never leave the filtered-to-nothing state blank. Show "No data for this selection" via conditional formatting or an `IF` that returns text, because a blank panel reads as a broken dashboard.
- Protect the dashboard sheet with "Use PivotTable & PivotChart" and "Edit objects" allowed, so slicers stay clickable while cells stay locked.

## 7. KPI cards that carry their own context

A KPI card is a value, a comparison, and a direction. Build it from three cells, not one.

```excel
// Value
=SUMIFS(tbl_Sales[Amount], tbl_Sales[Date], ">=" & PeriodStart, tbl_Sales[Date], "<" & PeriodEnd)

// Comparison against prior period, as a share
=IFERROR(CurrentValue / PriorValue - 1, "n/a")

// Direction glyph, driven by the number, not typed
=IF(Delta > 0, "▲", IF(Delta < 0, "▼", "▬"))
```

**Rules:**
- Compute the delta from cells, never by typing last period's number. A typed comparison goes stale at the next refresh and nothing flags it.
- Return `"n/a"` when the prior value is zero. A percentage change from zero is undefined, and `#DIV/0!` on a dashboard destroys the reader's trust in every other number on the sheet.
- Colour by rule, not by hand: Conditional Formatting, New Rule, Format only cells that contain, so the colour follows the next refresh.
- Do not colour "up" green unconditionally. Rising cost, churn, and latency are red when they rise. Drive the colour from a `GoodDirection` column in a metric definition table.
- Give every KPI a definition. A `Metrics` table on Calc with columns `Name, Definition, Source, Owner, GoodDirection` ends the recurring argument about what "active user" means.

## 8. Conditional formatting and in-cell visuals

```text
Data Bars        magnitude within a column, in place, no chart object
Color Scales     a heat map across a matrix; use two colours, not three
Icon Sets        status only; set the thresholds to Number, never Percent
Sparklines       trend per row, next to the row it describes
```

**Rules:**
- Set icon-set thresholds with Type: Number against real cutoffs. The default Percent thresholds shuffle the icons every time the distribution moves, so yesterday's green becomes today's amber with no change in the underlying value.
- Cap the rule count. Each rule is evaluated per cell per recalc; hundreds of overlapping rules on a large range are a common cause of a dashboard that lags on scroll.
- Apply rules to whole Table columns (`=tbl_Sales[Amount]`), not to a fixed range, so appended rows inherit the formatting.
- Use a two-colour scale for a magnitude and a diverging three-colour scale only when there is a meaningful midpoint (zero, plan, last year).
- Set sparkline axis minimum and maximum to "Same for All Sparklines" when rows are compared with each other. The default per-row scaling makes a 2% wobble look like a 200% swing.

## 9. Colour, type, and the grid

- Pick one accent colour for the metric in focus and grey for everything else. Colour used everywhere signals nothing.
- Never encode meaning in red and green alone. Around 1 in 12 men cannot separate them; add a glyph, a sign, or a position difference.
- Fill the dashboard sheet background with a single light colour and remove gridlines (View, uncheck Gridlines). Default gridlines compete with the data.
- Align every element to the cell grid. Set a uniform narrow column width across the sheet and lay cards out in multiples of it, so resizing does not scatter the layout.
- Use one font at two or three sizes. Bold is the only emphasis; italics and underline in a dense grid read as noise.
- Number formats carry the units so labels do not have to: `#,##0,,"M";[Red]-#,##0,,"M"` and `0.0%;[Red]-0.0%`.

## 10. Performance

A dashboard that takes six seconds per click gets replaced by a screenshot, and the screenshot never refreshes.

**Rules:**
- Do the aggregation once. `SUMIFS` over 500k rows repeated in 40 cards is 40 scans; a pivot or a Power Query group-by scans once.
- Ban `OFFSET`, `INDIRECT`, `TODAY`, `NOW`, and `RAND` from Calc except in a single input cell. Volatile functions recalculate the entire dependency chain on every edit anywhere in the workbook.
- Load large sources with Power Query as "Connection only" plus "Add to Data Model" instead of landing millions of rows on a sheet.
- Replace formula columns that only exist to feed a pivot with a Power Query step or a DAX measure. Computed columns are stored; measures are not.
- Convert a chart's source to values when the underlying model is frozen history. A million live formulas behind a static quarter costs recalculation forever.
- Measure before optimising: Formulas, Calculation Options, Manual, then F9 and time it. Guessing which formula is slow wastes the afternoon.

## 11. Refresh and distribution

```text
Data > Queries & Connections > right-click query > Properties:
  tick "Refresh data when opening the file"
  tick "Enable background refresh" only for queries no formula depends on

PivotTable Analyze > Options > Data:
  tick "Refresh data when opening the file"
  "Number of items to retain per field": None
```

**Rules:**
- Write the refresh timestamp into a cell as part of the refresh routine and display it. A dashboard with no visible as-of date will be read as current forever.
- Set "Number of items to retain per field" to None, because Excel keeps deleted members in slicers and filters, implying data that no longer exists.
- Freeze panes below the header block so the title and the as-of date stay on screen.
- Set the print area and fit-to-one-page before sending, because the first thing a reader does with a dashboard is print it badly.
- Protect the sheet (Review, Protect Sheet) with objects and pivots still usable, and leave input cells unlocked. Unprotected dashboards get typed over and the typing is never noticed.
- Do not distribute by emailing the workbook when the source is a live query the recipient cannot reach. Publish to a shared location, or paste-special values into a distribution copy and label it as a snapshot.

## 12. Reconcile before anyone sees it

Every headline number gets an independent check computed a different way.

```excel
// Headline from the pivot
=GETPIVOTDATA("Revenue", Calc!$A$3, "Region", "North")

// Independent recomputation from the raw Table
=SUMIFS(tbl_Sales[Amount], tbl_Sales[Region], "North")

// The check
=ROUND(Headline - Independent, 2) = 0
```

**Rules:**
- Keep the checks on the Calc sheet in one block, and surface a single `AllChecksPass` cell on the dashboard. One red cell beats twenty unread ones.
- Check that the parts sum to the whole: the sum of the category chart's series equals the total KPI.
- Check the row count against the source system every refresh. A silently short load is the most common wrong-dashboard cause.
- Test the empty state, the single-category state, and the one-row state. Charts with one point and pivots with no rows are where layouts collapse.
- Have someone who did not build it read the dashboard and say what it tells them. If their answer is not the question at the top, the layout is wrong, not the reader.

## Anti-patterns

- A dashboard built directly on the raw export sheet, so the next export overwrites the formulas.
- Charts placed over cells that hold the data, so unhiding the columns breaks the layout.
- A hardcoded prior-period number sitting next to a live current-period number.
- Dual value axes used to make two unrelated series "fit".
- Pie charts of ten categories, and pairs of pies compared side by side.
- Merged cells used for layout. They break sorting, structured references, and pivots.
- A slicer wired to one pivot out of five, giving a half-filtered screen.
- Screenshots of charts pasted into the dashboard, which never refresh and cannot be audited.
- Red and green as the only difference between "good" and "bad".
- Twenty KPI cards, because every stakeholder asked for one.
- A dashboard with no as-of date.
- Conditional formatting applied to entire columns (`A:A`) across a dozen rules, which is a per-cell cost times a million rows.

## When to use this skill

Use it when a number on a report will drive a decision, when the same report is produced every week or month, when more than one person reads it, or when someone asks why two reports disagree.

Skip it for a one-off chart in a mail, for exploratory analysis nobody else reads, and when the audience needs row-level access with their own filters (ship the Table or a BI tool instead). When the model outgrows a workbook, joins across several sources, needs versioning, or needs tests, move the transformation to SQL or pandas and keep Excel for presentation only.

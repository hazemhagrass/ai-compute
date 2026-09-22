---
name: google-sheets-advanced
description: Use when a Google Sheet is slow, an ARRAYFORMULA or QUERY returns the wrong rows, IMPORTRANGE breaks, or a shared sheet needs Apps Script, protection, or validation. Covers the Sheets-only behaviour Excel habits get wrong.
---

Google Sheets looks like Excel and fails differently. The traps are its own: a
`QUERY` that drops a column because the type inference sampled the first rows,
an `ARRAYFORMULA` that stops one row short of the data, an `IMPORTRANGE` that
silently serves yesterday's cache, a locale that turns every comma argument into
a syntax error, and an Apps Script trigger that runs as the wrong user in the
wrong timezone. This skill is the Sheets-specific layer. For lookup logic,
anchoring, rounding, and error-masking rules that are the same in both products,
use `skills/office/excel-formulas`.

## The working loop

1. **Set the file locale and timezone first** (File, Settings). They decide
   argument separators, date parsing, and what `TODAY()` means.
2. **Write one array formula in the header row** instead of filling a column.
   A filled column is N formulas; an `ARRAYFORMULA` is one.
3. **Bound every range.** `A2:A` is fine; `A:A` and cross-sheet full columns are
   what make a sheet crawl.
4. **Break it on purpose.** Append a row at the bottom, insert a column in the
   source, and re-run. If the output stops growing or shifts, the range was wrong.
5. **Check the cell count and recalc.** File, Settings shows nothing useful; use
   `=COUNTA(A:Z)` on the heavy tabs and watch for the "still loading" banner.

## 1. ARRAYFORMULA replaces the filled column

One formula in row 2 that outputs a whole column beats 5,000 copies of it: fewer
cells, one place to edit, and new rows are covered automatically.

```
=ARRAYFORMULA(IF(A2:A="", "", B2:B * C2:C))
```

**Rules:**

- Use an open-ended range (`A2:A`), never a fixed end (`A2:A5000`), because the
  fixed form stops covering data the moment someone appends row 5001.
- Guard with `IF(A2:A="", "", ...)`, because without it every empty row below the
  data renders `0` and `COUNTA`, charts, and pivot sources pick those up.
- Put the formula in the header-adjacent first data row only, and protect that
  row, because a user typing over row 2 deletes the entire column's logic.
- Functions that already return arrays (`FILTER`, `QUERY`, `SORT`, `UNIQUE`,
  `SEQUENCE`) do not need `ARRAYFORMULA`. Wrapping them adds nothing.
- Functions that aggregate (`SUMIF`, `VLOOKUP`, `IFERROR`) do need it to operate
  row-wise over a range.

```
// Bad: 5000 separate formulas, breaks on row 5001
=B2*C2   filled down

// Bad: array, but writes 0 into every blank row forever
=ARRAYFORMULA(B2:B * C2:C)

// Good
=ARRAYFORMULA(IF(A2:A="", "", B2:B * C2:C))
```

`ARRAYFORMULA` will not overwrite a non-empty cell: it returns
`#REF! Array result was not expanded because it would overwrite data`. Clear the
column below before entering it.

## 2. QUERY is SQL-shaped, not SQL

`QUERY` uses the Google Visualization API query language. Columns are referenced
by letter (`Col1` when the source is itself an array), strings use single quotes,
and there is no `JOIN`.

```
=QUERY(Orders!A1:F, "select B, sum(E) where C = 'EU' and D >= date '2026-01-01' group by B order by sum(E) desc label sum(E) 'Revenue'", 1)
```

**Rules:**

- Pass the header-row count as the third argument (`1`), because omitting it lets
  Sheets guess, and a guessed header becomes a data row in the output.
- Reference columns as `A`, `B`, `C` for a range and `Col1`, `Col2` for an array
  expression. Mixing the two forms is the most common `#VALUE!` in a `QUERY`.
- Build date literals as `date '2026-01-01'` (ISO, single-quoted) or concatenate
  a real date: `"... where D >= date '" & TEXT($G$1,"yyyy-mm-dd") & "'"`.
- Never concatenate raw user input into the query string without `TEXT` or a
  numeric cast, because a stray quote breaks the whole statement.
- `label` and `format` clauses go last, after `order by` and `limit`.

**Mixed-type columns silently lose data.** `QUERY` infers one type per column
from the majority of its values and returns blank for every cell of the minority
type. A column of numbers with three text entries returns blanks for those three.

```
// Fix at the source: force the whole column to text before querying
=ARRAYFORMULA(IF(A2:A="", "", TO_TEXT(A2:A)))
```

Missing rows with no error is the signature of this bug. Count first:
`=COUNTA(QUERY(...))` against `=COUNTA(source)`.

## 3. FILTER, SORT, UNIQUE and the empty-result trap

```
=FILTER(Orders!A2:F, Orders!C2:C = $H$1, Orders!D2:D >= $H$2)
=SORT(UNIQUE(Orders!C2:C), 1, TRUE)
=SORTN(Orders!A2:F, 5, 0, 5, FALSE)     // top 5 by column E descending
```

- `FILTER` returns `#N/A` when nothing matches. Wrap it: `IFNA(FILTER(...), "")`.
  Use `IFNA`, not `IFERROR`, so a genuinely broken range still errors visibly.
- `FILTER` conditions are separate arguments ANDed together. For OR, use boolean
  arithmetic: `FILTER(A2:A, (B2:B="EU") + (B2:B="UK"))`.
- All condition ranges must be the same height as the source range, or `FILTER`
  returns `#VALUE!` with no hint about which one is short.

## 4. LAMBDA and named functions

`LAMBDA` plus the helper functions removes the intermediate-column sprawl.

```
=MAP(A2:A100, LAMBDA(v, IF(v="", "", UPPER(TRIM(v)))))
=BYROW(B2:D100, LAMBDA(row, SUM(row)))
=REDUCE(0, A2:A100, LAMBDA(acc, v, acc + N(v)))
=LET(base, B2*C2, tax, base*$F$1, ROUND(base + tax, 2))
```

**Rules:**

- Use `LET` to name any subexpression used more than once, because Sheets
  evaluates a repeated subexpression repeatedly and `LET` computes it once.
- Promote a `LAMBDA` used in more than one tab to a **named function**
  (Data, Named functions), because copies drift and a named function has one
  definition.
- Give named functions explicit argument descriptions; they appear in the
  autocomplete tooltip and are the only documentation a later editor gets.
- Named functions do not travel with a copied range. Importing a sheet that uses
  one into another file breaks it unless you import the function too.

## 5. IMPORTRANGE and the other IMPORT functions

```
=IMPORTRANGE("1AbC...file_id...", "Orders!A1:F")
```

**Rules:**

- Enter `IMPORTRANGE` once in a bare cell and click **Allow access** before
  wrapping it in anything, because the permission prompt never appears inside a
  `QUERY` or `ARRAYFORMULA` and the formula just returns `#REF!`.
- Use the file ID, not the full URL, and keep it in a labelled cell referenced by
  every import, so a moved source is one edit.
- Land each import on its own raw tab, then compute from that tab. Repeating the
  same `IMPORTRANGE` in ten formulas fetches ten times.
- `IMPORTRANGE` results are cached (roughly 30 minutes) and refresh on open or
  edit. Never use it for anything that must be current to the minute.
- Revoking the source file's sharing breaks the import silently on the next
  refresh; the stale values stay on screen until then.
- `IMPORTHTML`, `IMPORTXML`, and `IMPORTDATA` are best-effort scrapers. They
  break when the source page changes, and they do not run for viewers of a
  published sheet. Do not put them in anything load-bearing.

## 6. Performance

A Google Sheet is capped at 10 million cells and recalculates in the browser.
Slowness is almost always one of five causes.

- **Volatile functions**: `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `INDIRECT`,
  `OFFSET`. Each recalculates on every edit and drags dependents with it. Put
  `TODAY()` in one cell and reference that cell.
- **Full-column references**: `A:A` scans every row of the grid. Use `A2:A`.
- **Cross-file `IMPORTRANGE` chains**: A imports B imports C means every edit in
  C eventually repaints A. Flatten to one hop.
- **Formula count**: replace filled columns with `ARRAYFORMULA`; replace
  per-row `VLOOKUP` with a single `QUERY` or `XLOOKUP` array.
- **Conditional formatting over whole columns**: each rule evaluates per cell.
  Bound the ranges and delete duplicate rules.

Convert finished analysis to static values (Ctrl+Shift+V) once the numbers are
final, because a snapshot has no recalculation cost and cannot drift.

Above roughly a million populated cells or a few hundred thousand formulas, move
the data to BigQuery and use Connected Sheets, which pushes the computation to
the server and keeps only the result in the grid.

## 7. Apps Script

Apps Script is bound to the file (Extensions, Apps Script) or standalone. It runs
server-side as a user, under quotas.

```javascript
function refreshSnapshot() {
  const ss = SpreadsheetApp.getActive();
  const src = ss.getSheetByName('Raw');
  const dst = ss.getSheetByName('Snapshot');
  // One read, one write: never getRange() inside a loop.
  const values = src.getDataRange().getValues();
  dst.getRange(1, 1, values.length, values[0].length).setValues(values);
  SpreadsheetApp.flush();
}
```

**Rules:**

- Batch reads and writes. `getValues()` once into an array, mutate in JavaScript,
  `setValues()` once. A `getRange().setValue()` inside a loop is the difference
  between 200ms and a 6-minute timeout.
- Respect the 6-minute execution limit (30 minutes for Workspace accounts).
  For longer jobs, process a slice, store the cursor in `PropertiesService`, and
  re-trigger.
- Never use `SpreadsheetApp.getActiveSheet()` in a time-driven trigger; there is
  no active sheet. Address sheets by name.
- Set the script timezone in `appsscript.json` to match the spreadsheet's, because
  `new Date()` in script and `TODAY()` in the grid otherwise disagree by hours.
- Installable triggers run as their installer, so a trigger that edits a
  restricted range keeps working after the installer loses access only until the
  next authorization check. Document who installed each trigger.
- `onEdit(e)` simple triggers cannot call services that need authorization and
  cannot open other files. Use an installable `onEdit` for those.
- Custom functions (`=MYFUNC()`) are capped at 30 seconds, cannot use services
  requiring authorization, and re-run on every recalculation. Do not use one
  where a formula or a menu-driven script would do.
- Keep secrets in `PropertiesService.getScriptProperties()`, never as a literal
  in the script or in a cell, because both are visible to every editor.

## 8. Data validation and protection

- Use Data, Data validation with **Reject input** for anything that feeds a
  formula; the default "Show warning" allows the bad value through.
- Source dropdown lists from a named range on a hidden config tab, not from a
  typed comma list, so the options are editable without touching every cell.
- Protect the formula row and config tab (Data, Protect sheets and ranges). A
  protected range still lets listed editors through; "Show a warning" does not
  stop anyone.
- Sheet-level protection with "Except certain cells" is the right shape for an
  input form: lock everything, open the input cells.
- Protection is not security. Anyone who can view the file can see every tab,
  including hidden ones, via the API or by copying the file. Never put data in a
  sheet that some viewers must not read; split the file.

## 9. Conditional formatting and charts

- Prefer one custom-formula rule over many single-cell rules:
  `=$D2="overdue"` applied to `A2:F` highlights whole rows and survives sorting.
- Anchor the formula's column (`$D2`) and leave the row relative, or the rule
  evaluates the same cell for every row.
- Rules are evaluated in order and the first match wins for a given property.
  Reorder rather than adding an exception rule at the bottom.
- Chart data ranges do not auto-extend past the range you gave them. Point charts
  at a full open range (`A1:B`) or at a `QUERY` output tab.

## 10. Collaboration hygiene

- Use version history (File, Version history, Name current version) to mark any
  state someone will cite, because "restore to 3pm Tuesday" is otherwise a guess.
- Comment a formula's intent with a note on the cell (Insert, Note), not in a
  neighbouring cell that will be sorted away from it.
- Turn off "Notify people" spam by using @-mentions in comments only for people
  who must act.
- Publish to web (File, Share, Publish to web) serves a cached snapshot, not a
  live view, and ignores sheet protection. Never publish a file containing tabs
  you would not hand out.

## Anti-patterns

- `A:A` anywhere in a formula-heavy sheet.
- `IMPORTRANGE` repeated in many formulas instead of landing once on a raw tab.
- `IFERROR` wrapped around a `QUERY`, which hides a broken column reference as an
  empty cell. Use `IFNA` for expected emptiness.
- A filled column of `VLOOKUP` where one `ARRAYFORMULA` or `QUERY` would do.
- Custom Apps Script functions used as a substitute for built-in formulas.
- Merged cells: they break `FILTER`, `QUERY`, sorting, and every array output.
- Hiding sensitive tabs instead of splitting the file.
- Hard-coded file IDs scattered across formulas instead of one config cell.

## When to use this skill

Use it when a Sheet has stopped responding, when `QUERY` or `FILTER` returns
fewer rows than the source, when `IMPORTRANGE` shows `#REF!` or stale numbers,
when a shared sheet needs input validation or protection, or when someone is
about to write Apps Script against a spreadsheet.

Skip it for formula semantics shared with Excel (lookup match types, anchoring,
`ROUND` placement) - that is `skills/office/excel-formulas`. Skip it entirely
when the dataset needs joins, tests, or versioning: move to SQL, BigQuery, or
pandas and keep the Sheet for presentation.

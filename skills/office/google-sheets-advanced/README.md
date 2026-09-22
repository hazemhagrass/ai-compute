# Google Sheets Advanced

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="google-sheets-advanced robot" width="200">
</div>

A skill for the parts of Google Sheets that are not Excel: array formulas that
cover future rows, `QUERY` against the Visualization API, `IMPORTRANGE`
permissions and caching, `LAMBDA`/named functions, browser-side recalculation
limits, and Apps Script that survives its own quotas.

## What it does

Sheets fails in ways an Excel habit does not predict. This skill names each
mechanism and gives the fix:

- **ARRAYFORMULA**: one formula per column instead of thousands, open-ended
  ranges (`A2:A`) so new rows are covered, and the blank-row guard that stops a
  column of phantom zeros.
- **QUERY**: column letters vs `Col1`, the mandatory header-count argument, ISO
  date literals, and the type-inference rule that blanks out every minority-typed
  cell in a mixed column - rows vanish with no error.
- **FILTER / SORT / UNIQUE / SORTN**: `#N/A` on empty results, OR conditions via
  boolean arithmetic, and the equal-height requirement for condition ranges.
- **LAMBDA, LET, MAP, BYROW, REDUCE** and named functions, including why a named
  function does not travel with a copied range.
- **IMPORTRANGE**: the Allow-access prompt that never appears inside a wrapper
  formula, the ~30-minute cache, and the one-import-per-raw-tab pattern.
- **Performance**: the 10M-cell cap, volatile functions, full-column references,
  import chains, conditional-formatting cost, and when to move to BigQuery via
  Connected Sheets.
- **Apps Script**: batched `getValues`/`setValues`, the 6-minute limit, trigger
  identity and timezone, simple vs installable `onEdit`, and the 30-second cap on
  custom functions.
- **Validation and protection**: Reject input vs Show warning, named-range
  dropdowns, and why protection is not security.
- **Conditional formatting and charts**: one custom-formula rule with `$D2`
  anchoring instead of many per-cell rules; open-ended chart ranges.
- **Collaboration**: named versions, cell notes, and what Publish to web exposes.

## When to use this

Concrete triggers:

- A `QUERY` returns fewer rows than the source and shows no error.
- An `ARRAYFORMULA` stops producing output partway down the sheet.
- The column below the data is full of zeros that break a chart or a pivot.
- `IMPORTRANGE` shows `#REF!`, or shows numbers that are hours out of date.
- Typing in a cell takes a second to register, or the "still loading" banner
  never clears.
- Someone is about to write Apps Script against a spreadsheet.
- An Apps Script job dies at six minutes, or a trigger runs against the wrong
  sheet.
- A shared sheet needs input validation, locked formula rows, or protected tabs.
- A conditional-formatting rule highlights the wrong rows after a sort.

Skip it when:

- The question is about lookup match types, `$` anchoring, `IFERROR` vs `IFNA`,
  date serials, or `ROUND` placement - those are identical in Excel and live in
  `skills/office/excel-formulas`.
- The workload needs joins across sources, tests, or version control. Move to
  SQL, BigQuery, or pandas.
- The file is a one-off scratch calculation.

## Quick start

A raw order export on one tab, a summary on another, with no filled columns.

**Step 0: set locale and timezone**

File, Settings. The locale decides whether formula arguments are separated by
`,` or `;` and how dates parse. The timezone decides what `TODAY()` means and
must match `appsscript.json` if any script touches the file.

**Step 1: land the import once**

On a tab named `Raw`, in `A1`:

```
=IMPORTRANGE($Config.$B$1, "Orders!A1:F")
```

Click the cell, click **Allow access**. Do this before wrapping the import in
anything, because the prompt does not appear inside `QUERY` or `ARRAYFORMULA`.
`Config!B1` holds the source file ID, so a moved source is a one-cell edit.

**Step 2: compute the line total with one formula**

In `Raw!G2`:

```
=ARRAYFORMULA(IF(A2:A="", "", ROUND(E2:E * F2:F, 2)))
```

Open-ended range, blank guard, rounded where the number becomes money.

**Step 3: normalize a mixed-type key before querying**

```
=ARRAYFORMULA(IF(B2:B="", "", TO_TEXT(TRIM(B2:B))))
```

`QUERY` infers one type per column and returns blank for every value of the
minority type, so a column of numbers with three text SKUs loses those rows.

**Step 4: aggregate with QUERY**

```
=QUERY(Raw!A1:G, "select C, sum(G) where D >= date '"&TEXT($B$1,"yyyy-mm-dd")&"' and D < date '"&TEXT($B$2,"yyyy-mm-dd")&"' group by C order by sum(G) desc label sum(G) 'Revenue'", 1)
```

The `1` is the header row count. The interval is half-open. Bounds come from
cells, not from the formula text.

**Step 5: prove nothing was dropped**

```
=ROUND(SUM(QUERY(Raw!A1:G, "select sum(G) label sum(G) ''", 1)) - SUM(Raw!G2:G), 2)
```

Anything other than `0` means the `QUERY` is excluding rows - usually a
mixed-type column or a date bound that is text.

**Step 6: protect what must not be typed over**

Select `Raw!G2`, Data, Protect sheets and ranges, restrict to yourself. One user
typing a constant into that cell deletes the entire column's logic.

## Key concepts

- **Open-ended range.** `A2:A` covers every current and future row. `A2:A5000`
  stops at 5000 and gives no warning when data passes it.
- **Array-native functions.** `FILTER`, `QUERY`, `SORT`, `UNIQUE`, `SEQUENCE`
  already return arrays; wrapping them in `ARRAYFORMULA` does nothing. `SUMIF`,
  `VLOOKUP`, and `IFERROR` need the wrapper to go row-wise.
- **QUERY type inference.** One data type per column, chosen by majority.
  Minority-typed cells return blank, so rows disappear silently.
- **Column reference form.** `A`, `B`, `C` when the source is a range; `Col1`,
  `Col2` when the source is an array expression. Mixing them yields `#VALUE!`.
- **IMPORTRANGE authorization.** A per-pair grant between two files, prompted
  only on a bare formula, and revocable from the source file's sharing settings.
- **IMPORTRANGE cache.** Roughly 30 minutes. Values on screen are a snapshot,
  not a live feed.
- **Volatility.** `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `INDIRECT`, and `OFFSET`
  recalculate on every edit and pull their dependents with them.
- **Cell cap.** 10 million cells per spreadsheet, and recalculation happens in
  the browser, so the practical limit is far lower than the hard one.
- **Named function.** A saved `LAMBDA` with documented arguments, scoped to the
  file. It does not follow a copied range into another file.
- **Trigger identity.** An installable trigger runs as the user who installed it,
  not as the user who caused the event.
- **Protection vs access.** Protection stops edits by editors. It does not hide
  anything from anyone who can open the file.

## Common pitfalls

**Fixed-end array range**

```
=ARRAYFORMULA(IF(A2:A5000="", "", B2:B5000*C2:C5000))   // Bad
=ARRAYFORMULA(IF(A2:A="", "", B2:B*C2:C))               // Good
```

Reason: the fixed form stops covering data at row 5001 with no error.

**Unguarded array formula**

```
=ARRAYFORMULA(B2:B * C2:C)                     // Bad
=ARRAYFORMULA(IF(A2:A="", "", B2:B * C2:C))    // Good
```

Reason: without the guard every blank row below the data renders `0`, which then
appears in `COUNTA`, charts, and pivot sources.

**QUERY without a header count**

```
=QUERY(Raw!A1:F, "select B, sum(E) group by B")       // Bad
=QUERY(Raw!A1:F, "select B, sum(E) group by B", 1)    // Good
```

Reason: Sheets guesses the header rows, and a guessed header becomes a data row.

**String date bound in QUERY**

```
"... where D >= '2026-01-01'"                          // Bad: matches nothing
"... where D >= date '2026-01-01'"                     // Good
```

Reason: without the `date` keyword the value is compared as text against a date
column.

**Mixed-type column**

```
// Bad: query the raw column and lose the minority type
=QUERY(Raw!A1:F, "select A, sum(E) group by A", 1)

// Good: normalize first
=ARRAYFORMULA(IF(A2:A="", "", TO_TEXT(A2:A)))
```

Reason: `QUERY` assigns one type per column and blanks every cell of the other
type, dropping those rows from the result with no error.

**IMPORTRANGE wrapped before authorization**

```
=QUERY(IMPORTRANGE("id","Orders!A:F"), "select Col1", 1)   // Bad: #REF! forever
=IMPORTRANGE("id","Orders!A:F")                             // Good: authorize first
```

Reason: the Allow-access prompt only renders on a bare `IMPORTRANGE` cell.

**IFERROR around QUERY**

```
=IFERROR(QUERY(Raw!A1:F, "select Q", 1), "")    // Bad: a bad column reads as empty
=IFNA(FILTER(A2:A, B2:B=$H$1), "")              // Good: only expected emptiness
```

Reason: `IFERROR` converts a malformed query into a blank cell that looks like
"no matching rows".

**FILTER with OR as two arguments**

```
=FILTER(A2:A, B2:B="EU", B2:B="UK")              // Bad: ANDs them, returns nothing
=FILTER(A2:A, (B2:B="EU") + (B2:B="UK"))         // Good
```

Reason: extra `FILTER` arguments are ANDed; boolean addition is the OR.

**Full-column reference**

```
=SUMIF(A:A, $H$1, B:B)        // Bad
=SUMIF(A2:A, $H$1, B2:B)      // Good
```

Reason: `A:A` scans the whole grid on every recalculation.

**getRange inside a loop**

```javascript
// Bad: one round-trip per row
for (const row of rows) sheet.getRange(r++, 1).setValue(row[0]);

// Good: one read, one write
const values = sheet.getDataRange().getValues();
sheet.getRange(1, 1, out.length, out[0].length).setValues(out);
```

Reason: each `getRange`/`setValue` is a separate service call, and a few thousand
of them hit the 6-minute execution limit.

**getActiveSheet in a time-driven trigger**

```javascript
const sh = SpreadsheetApp.getActiveSheet();               // Bad: null on a trigger
const sh = SpreadsheetApp.openById(ID).getSheetByName('Raw');  // Good
```

Reason: a scheduled run has no active spreadsheet or sheet.

**Script timezone drift**

```
// Bad: appsscript.json left at the default while the file is Europe/Athens
// Good: set "timeZone" in appsscript.json to the spreadsheet's timezone
```

Reason: `new Date()` in script and `TODAY()` in the grid otherwise disagree by
hours, and date-keyed writes land on the wrong row.

## See also

- `SKILL.md` in this directory: the full rule set, section by section.
- `skills/office/excel-formulas`: lookup match types, anchoring, `IFNA`, date
  serials, and `ROUND` placement - shared with Sheets.
- `skills/office/pivot-tables`: grand-total and grouping rules that apply to
  Sheets pivot tables too.
- Google docs: Query Language Reference (Visualization API), `ARRAYFORMULA`,
  `IMPORTRANGE`, and `LAMBDA` function references.
- Google docs: Apps Script quotas and limits, and "Best Practices" for batched
  spreadsheet I/O.
- `skills/data/sql-for-analysts`: when the aggregation belongs in a database
  rather than a grid.

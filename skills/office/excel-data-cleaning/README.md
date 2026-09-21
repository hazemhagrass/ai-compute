# Excel Data Cleaning

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for cleaning a messy spreadsheet without destroying the data inside it: work on a copy, fix hidden characters and types explicitly, resolve date ambiguity from evidence, dedupe on a real key, and reconcile row counts after every step.

## What it does

Excel does not raise errors when it damages data. It eats a leading zero, reads a date under the wrong regional convention, or lets a whole-sheet Find and Replace rewrite a column you were not looking at. This skill names each mechanism and gives the exact fix:

- **Never clean in place**: freeze a `raw` sheet, transform on `work`, promote to `clean`, so every step is auditable and repeatable.
- **Numbers stored as text**: the non-breaking space (CHAR(160)), trailing spaces, and control characters that break SUM, and the `SUBSTITUTE` / `CLEAN` / `TRIM` / `VALUE` stack that actually removes all of them.
- **Date ambiguity**: why `03/04/2026` parses differently on two machines, how to detect DD/MM vs MM/DD from the data, and how to parse by position instead of by locale.
- **Duplicates**: composite keys with `COUNTIFS`, counting what Remove Duplicates would delete before deleting it, and telling duplicates apart from data conflicts.
- **Power Query**: the repeatable alternative to Text to Columns and manual edits, including the culture argument that pins date parsing and a reject table for rows that failed.
- **Merged cells**: why they break sorts, filters, and formulas, and the unmerge-and-fill-down sequence.
- **Casing**: why `PROPER` turns `mcdonald` into `Mcdonald`, and why normalization belongs in a helper column.
- **Leading zeros**: setting the column type on import, when `TEXT` can pad them back, and when the data is simply gone.
- **Find and Replace**: the whole-workbook foot-gun and the Find All count that turns it into a checked operation.
- **Row counts**: control totals and distinct-key counts read before and after every step.

## When to use this

Concrete triggers:

- A numeric column returns 0 from SUM, or shows green triangles in the corners.
- Dates display correctly but sort into the wrong order.
- A total shrank after someone ran Remove Duplicates.
- Two files that should join on an id return zero matches.
- Zip codes, SKUs, or account numbers lost their leading zeros after an import.
- Sorting a range fails with a message about identically sized merged cells.
- A customer or product column has `ACME`, `Acme `, and `acme` as separate values.
- The same messy export arrives every week and someone cleans it by hand each time.
- Someone needs to explain, later, exactly what was changed and why.

Skip it when:

- The source is a clean typed export from a database (fix it in the query instead).
- The volume runs past a few hundred thousand rows (move to pandas, SQL, or DuckDB).
- The spreadsheet is a scratch pad nobody will act on.

## Quick start

One worked pass over a weekly orders export with text numbers, ambiguous dates, duplicate lines, and short zip codes.

**Step 0: freeze the source**

```
Right click the sheet tab > Move or Copy > Create a copy
Rename the original tab to "raw", the copy to "work"
Review > Protect Sheet on "raw"
```

**Step 1: record the shape before you touch anything**

Put these in a control block on `work`, well clear of the data:

```
=COUNTA(raw!A2:A100000)
=SUM(raw!D2:D100000)
=SUMPRODUCT(--ISTEXT(raw!D2:D100000))
```

The third formula returning a nonzero count is your proof that column D is a mixed text/number column, not a formatting problem.

**Step 2: strip hidden characters and convert to real numbers**

In a helper column, not over the original:

```
=VALUE(SUBSTITUTE(SUBSTITUTE(TRIM(CLEAN(SUBSTITUTE(D2,CHAR(160)," "))),"$",""),",",""))
```

Check that nothing got lost:

```
=SUMPRODUCT(--ISNUMBER(H2:H100000))
```

This must equal the row count from step 1. If it is lower, some rows failed and you need to see them, not hide them behind `IFERROR`.

**Step 3: settle the date format from evidence, then parse by position**

```
=SUMPRODUCT(--(VALUE(LEFT(C2:C100000,2))>12))
```

A nonzero result proves the first pair is the day, so the file is DD/MM/YYYY. Parse it explicitly:

```
=DATE(VALUE(RIGHT(C2,4)),VALUE(MID(C2,4,2)),VALUE(LEFT(C2,2)))
```

**Step 4: count duplicates on the real key before deleting anything**

The key is `order_id` plus `line_no`, not `order_id` alone:

```
=COUNTIFS($A$2:$A$100000,$A2,$B$2:$B$100000,$B2)
=COUNTIFS($A$2:$A2,$A2,$B$2:$B2,$B2)
```

The second formula returns 1 on the first occurrence. Count the rows a dedupe would actually remove, which is total rows minus distinct keys:

```
=COUNTA($A$2:$A$100000)-SUMPRODUCT(1/COUNTIFS($A$2:$A$100000,$A$2:$A$100000,$B$2:$B$100000,$B$2:$B$100000))
```

Write that number down. It is what you check against afterwards.

**Step 5: restore the leading zeros**

```
=TEXT(F2,"00000")
```

This works only because a US zip is always five digits. If the widths vary, re-import with the column typed as Text; the original digits cannot be reconstructed.

**Step 6: reconcile against the frozen sheet**

```
=SUM(clean!H2:H100000)-SUM(raw!D2:D100000)
=COUNTA(clean!A2:A100000)-COUNTA(raw!A2:A100000)
```

The first must be 0. The second must equal the duplicate count from step 4, negated. Anything else is a bug you found before the reader did.

**Step 7: if this file arrives again, move the whole thing into a query**

```m
let
    Source = Excel.CurrentWorkbook(){[Name="RawOrders"]}[Content],
    Text = Table.TransformColumnTypes(Source, {{"order_id", type text}, {"zip", type text}, {"amount", type text}, {"order_date", type text}}),
    Scrubbed = Table.TransformColumns(Text, {
        {"amount", each Text.Remove(_, {"$", ",", Character.FromNumber(160)}), type text},
        {"customer", each Text.Trim(Text.Clean(Text.Replace(_, Character.FromNumber(160), " "))), type text}
    }),
    Amounts = Table.TransformColumnTypes(Scrubbed, {{"amount", type number}}),
    Dates = Table.TransformColumnTypes(Amounts, {{"order_date", type date}}, "en-GB"),
    Deduped = Table.Distinct(Dates, {"order_id", "line_no"}),
    Padded = Table.TransformColumns(Deduped, {{"zip", each Text.PadStart(_, 5, "0"), type text}})
in
    Padded
```

Next week the whole pass is one Refresh, and the steps are readable by someone other than you.

## Key concepts

- **Raw, work, clean.** Three sheets, one direction. `raw` is evidence and is never edited, `work` holds helper columns and formulas, `clean` holds pasted values. Any result must be reproducible by re-running `work` against `raw`.
- **CHAR(160).** The non-breaking space, pasted in from web pages and PDF exports. `TRIM` does not remove it and `CLEAN` does not either (CLEAN only strips codes below 32), so `SUBSTITUTE(x,CHAR(160)," ")` has to come first.
- **Format is not type.** `Format Cells > Number` changes how a value is displayed. Text stays text, so SUM keeps returning 0 and lookups keep failing. Only `VALUE`, a re-import with an explicit type, or Power Query changes the stored type.
- **Locale-dependent date parsing.** Excel resolves `DD/MM` vs `MM/DD` using the machine's regional settings at import time. The same file cleaned on two laptops yields two different date columns with no warning. ISO `YYYY-MM-DD` is the only unambiguous interchange form.
- **Composite key.** The set of columns that is unique per row. In an order line file that is `order_id` plus `line_no`. Deduplicating on one column of a multi-column key deletes real rows.
- **Duplicate vs conflict.** Identical rows are duplicates and can be collapsed. Rows sharing a key but differing in a field are a conflict; collapsing them picks a winner at random and hides the disagreement.
- **Repeatability.** Power Query stores each step as a named line that can be read, reordered, and re-run. Text to Columns and Find and Replace leave no record of what they did.
- **Control total.** A sum that must survive the whole pass unchanged. It is the cheapest possible check that a transform did not quietly drop or duplicate rows.

## Common pitfalls

**Cleaning the only copy**

```
Bad:  open the file, edit columns, save, close
Good: copy the sheet to "work", protect "raw", edit only "work"
```

Reason: without the original you cannot prove the result is correct or undo a mistake found later.

**TRIM alone on text numbers**

```
Bad:  =VALUE(TRIM(A2))
Good: =VALUE(TRIM(CLEAN(SUBSTITUTE(A2,CHAR(160)," "))))
```

Reason: `TRIM` only removes CHAR(32), so a non-breaking space survives and `VALUE` still returns `#VALUE!`.

**Reformatting instead of converting**

```
Bad:  select column, Format Cells > Number, expect SUM to work
Good: =VALUE(TRIM(CLEAN(SUBSTITUTE(A2,CHAR(160)," ")))) in a helper column
```

Reason: number formatting is a display mask; the cell still contains text.

**Letting the locale decide the date**

```
Bad:  select column C, Format Cells > Date
Good: =DATE(VALUE(RIGHT(C2,4)),VALUE(MID(C2,4,2)),VALUE(LEFT(C2,2)))
```

Reason: `03/04/2026` becomes March or April depending on the machine, and the two results look equally plausible.

**Deduping on a single column**

```
Bad:  Data > Remove Duplicates, check [order_id] only
Good: =COUNTIFS($A$2:$A$1000,$A2,$B$2:$B$1000,$B2)>1 first, then dedupe on both columns
```

Reason: one order has many lines, so a single-column dedupe deletes every line but the first.

**Deduping before trimming**

```
Bad:  Remove Duplicates, then clean the whitespace
Good: clean the whitespace, then build the key, then dedupe
```

Reason: `"ACME "` and `"ACME"` are different keys, so the duplicates are invisible until after the trim.

**Merged cells in a data range**

```
Bad:  merge A2:A5 to label a region
Good: unmerge, Go To Special > Blanks, type =A2, press Ctrl+Enter, paste as values
```

Reason: merged cells block sorting, hide rows from filters, and return blank to formulas that reference the hidden members.

**PROPER on names**

```
Bad:  =PROPER(A2)              "mcdonald" becomes "Mcdonald", "IBM" becomes "Ibm"
Good: =UPPER(TRIM(A2)) in a helper column used only for matching
```

Reason: `PROPER` capitalizes after every non-letter, which is wrong for a large share of real names and destroys acronyms.

**Double clicking a CSV with id columns**

```
Bad:  double click addresses.csv and let Excel infer types
Good: Data > Get Data > From Text/CSV, set zip and sku to Text in the preview
```

Reason: `02134` is parsed as 2134 on open and the leading zero is unrecoverable.

**Custom format for leading zeros**

```
Bad:  Format Cells > Custom > 00000
Good: =TEXT(A2,"00000") into a text column, or set the type on import
```

Reason: the stored value stays 2134, so a CSV export or a text-key lookup fails again.

**Workbook-wide Find and Replace**

```
Bad:  Ctrl+H, Within: Workbook, Replace All
Good: select the range, Within: Sheet, Match entire cell contents, Find All, read
      the count, then Replace All and compare
```

Reason: it edits columns you are not looking at, and undo does not survive a save.

**Hiding failed conversions**

```
Bad:  =IFERROR(VALUE(A2),"")
Good: =VALUE(A2) plus =SUMPRODUCT(--ISERROR(H2:H1000)) to count the failures
```

Reason: `IFERROR` blanks exactly the rows that need attention, and the blanks then look like missing source data.

**Verifying by eyeball**

```
Bad:  scroll the first 20 rows and call it clean
Good: compare =COUNTA(clean!A2:A100000) and =SUM(clean!D2:D100000) against raw
```

Reason: a scan cannot detect row loss, duplication, or a control total that moved.

## See also

- `SKILL.md` in this directory: the full rule set with paired examples for all ten areas, plus the anti-pattern list.
- Microsoft docs: `TRIM`, `CLEAN`, `SUBSTITUTE`, `VALUE`, `TEXT`, `DATE`, `COUNTIFS`, and `SUMPRODUCT`.
- Microsoft docs: Power Query M, specifically `Table.TransformColumnTypes` (the culture argument), `Table.TransformColumns`, `Table.Distinct`, and `Text.PadStart`.
- `skills/data/python-pandas-analysis`: when the file outgrows a spreadsheet, or the cleaning needs tests and version control.
- `skills/office/powerpoint-automation` and `skills/office/word-documents`: generating Office files programmatically once the cleaning rules are settled.

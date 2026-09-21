---
name: excel-data-cleaning
description: Use when cleaning a messy spreadsheet. Fix types, duplicates, dates and hidden characters on a copy, with row counts checked at every step.
---

Clean a messy spreadsheet without destroying the data underneath it. Excel does not warn you when it eats a leading zero, reads 03/04/2026 as March instead of April, or lets a whole-sheet Find and Replace rewrite a column you were not looking at. The damage is silent and usually unrecoverable once the file is saved. Every rule below exists because someone lost data doing the obvious thing.

## The working loop

1. **Copy the raw sheet and freeze it.** Rename it `raw`, never type into it again.
2. **Record the shape.** Row count, column count, and the count of blanks per column, written into a cell.
3. **Transform on a `work` sheet, one step per column.** Helper columns, not overwrites.
4. **Re-count after every step.** A step that changes the row count without you asking is a bug.
5. **Promote to `clean` only when counts reconcile.** Paste values, then compare totals against `raw`.

## 1. Never clean in place

The raw file is your only evidence that the cleaning was correct. Overwrite it and you cannot prove anything, reproduce anything, or recover from a mistake found a week later.

```
Bad:  open orders.xlsx, select column D, Find and Replace, save, close.
Good: open orders.xlsx, right click the sheet tab, Move or Copy, Create a copy,
      rename the copy "work", set the original tab to "raw", protect "raw",
      do all edits on "work".
```

**Rule:** every transform lives on a sheet or a query that can be rebuilt from `raw` by re-running it. If a step cannot be re-run, it is not cleaning, it is retyping.

Lock the source so an absent-minded click cannot edit it: `Review > Protect Sheet`, leaving every box unchecked except "Select locked cells".

**Rule:** if the file arrives by email every week, do not clean it by hand at all. Go straight to section 5 and build a query. Manual cleaning is only defensible once.

## 2. Numbers stored as text

A column of numbers that will not SUM is almost always carrying invisible characters: a trailing space, a non-breaking space (CHAR(160)) pasted in from a web page or a PDF, or a non-printing control character from a mainframe export. TRIM alone does not remove CHAR(160), which is why the usual fix fails and people conclude the data is fine.

```
Bad:  =VALUE(A2)                          returns #VALUE! and you give up
Bad:  =VALUE(TRIM(A2))                    still #VALUE!, TRIM ignores CHAR(160)
Good: =VALUE(TRIM(CLEAN(SUBSTITUTE(A2,CHAR(160)," "))))
```

Each function has one job, so keep all four:

- `SUBSTITUTE(A2,CHAR(160)," ")` converts non-breaking spaces to ordinary spaces.
- `CLEAN(...)` strips non-printing characters below CHAR(32).
- `TRIM(...)` removes leading, trailing, and repeated interior spaces.
- `VALUE(...)` converts the surviving text to a real number.

Currency symbols and thousands separators need one more pass:

```
=VALUE(SUBSTITUTE(SUBSTITUTE(TRIM(CLEAN(SUBSTITUTE(A2,CHAR(160)," "))),"$",""),",",""))
```

Detect the problem before you fix it, because a mixed column looks identical on screen:

```
=SUMPRODUCT(--ISTEXT(B2:B1000))          count of text-typed cells in a numeric column
=SUMPRODUCT(--ISNUMBER(B2:B1000))        these two must add up to your row count
```

**Rule:** a green triangle in the corner of a cell means Excel already knows the value is text. Do not dismiss it with "Ignore Error"; that hides the symptom and keeps the bug.

**Rule:** never fix this by widening the column or reformatting it as Number, because formatting changes the display and not the stored type, so SUM still returns 0.

## 3. Dates: the ambiguity that mangles data silently

`03/04/2026` is March 4 in a US locale and April 3 in most of the rest of the world. Excel parses it on import using the machine's regional settings, so the same file cleaned on two laptops produces two different answers, and neither raises an error. Worse, in a mixed column Excel converts the rows it can parse and leaves the rest as text, so half the column becomes real dates and half stays string.

```
Bad:  select the column, Format Cells > Date, and assume it worked
Good: check what you actually have first
      =SUMPRODUCT(--ISTEXT(C2:C1000))    any nonzero count means a mixed column
```

Parse ambiguous text dates explicitly, by position, instead of letting the locale decide. For `DD/MM/YYYY` text in C2:

```
=DATE(VALUE(RIGHT(C2,4)),VALUE(MID(C2,4,2)),VALUE(LEFT(C2,2)))
```

For `MM/DD/YYYY` text in C2:

```
=DATE(VALUE(RIGHT(C2,4)),VALUE(LEFT(C2,2)),VALUE(MID(C2,4,2)))
```

For an ISO string `YYYY-MM-DD`, the only unambiguous form:

```
=DATE(VALUE(LEFT(C2,4)),VALUE(MID(C2,6,2)),VALUE(MID(C2,9,2)))
```

Find the rows that are lying to you. Any real date above 12 in the day position proves the file is DD/MM, and a file that contains both 13/04 and 04/13 is unfixable without asking the source:

```
=SUMPRODUCT(--(VALUE(LEFT(C2:C1000,2))>12))
```

**Rule:** decide the source format once, from evidence, and state it in a cell next to the column. Do not infer it per row.

**Rule:** output dates as ISO text (`=TEXT(D2,"yyyy-mm-dd")`) when the file leaves your machine, because a serial number or a locale-formatted string will be re-parsed by the next tool under its own rules.

**Rule:** a date column holding both `45000` and `"2026-03-04"` was half-converted by a previous cleaner. Detect it with `=SUMPRODUCT(--ISNUMBER(C2:C1000))` before adding more transforms on top.

## 4. Duplicates: composite key, not a single column

Remove Duplicates on one column deletes rows that were not duplicates at all. An order line file has many rows per `order_id`, and the real key is `order_id` plus `line_no`. Deduplicating on `order_id` alone silently deletes every line but the first, and the total shrinks by an amount nobody notices.

```
Bad:  Data > Remove Duplicates > check only [order_id]
Good: build the composite key, count it, look at the duplicates, then decide
```

Flag duplicates before deleting anything:

```
=COUNTIFS($A$2:$A$1000,$A2,$B$2:$B$1000,$B2)              occurrences of this key
=IF(COUNTIFS($A$2:$A$1000,$A2,$B$2:$B$1000,$B2)>1,"DUP","")
```

Number the occurrences so you can keep the first and inspect the rest:

```
=COUNTIFS($A$2:$A2,$A2,$B$2:$B2,$B2)                      1 for first, 2 for second
```

Count distinct keys without deleting a row:

```
=SUMPRODUCT(1/COUNTIFS(A2:A1000,A2:A1000,B2:B1000,B2:B1000))
```

**Rule:** never run Remove Duplicates before you have counted how many rows it will delete. `COUNTIFS` gives you that number in advance, and the count is the thing you check against afterwards.

**Rule:** build the key from cleaned columns, because `"ACME "` and `"ACME"` are different keys and the duplicates stay invisible until after section 2 runs.

**Rule:** rows that share a key but differ in one field (two addresses for one customer id) are a data conflict, not a duplicate. Deleting one picks a winner at random. Surface them and ask.

## 5. Power Query for anything you will do twice

Text to Columns and manual Find and Replace are one-shot, invisible, and unrepeatable. Power Query records each step as a named line you can read, reorder, and re-run against next month's file with one Refresh.

```
Data > Get Data > From File, or Data > From Table/Range for data already in the book
```

A complete query that applies sections 2, 3 and 4 in order:

```m
let
    Source = Excel.CurrentWorkbook(){[Name="RawOrders"]}[Content],
    Text = Table.TransformColumnTypes(Source, {{"order_id", type text}, {"line_no", type text}, {"customer", type text}, {"order_date", type text}, {"amount", type text}}),
    Scrubbed = Table.TransformColumns(Text, {
        {"customer", each Text.Trim(Text.Clean(Text.Replace(_, Character.FromNumber(160), " "))), type text},
        {"amount", each Text.Remove(_, {"$", ",", Character.FromNumber(160)}), type text}
    }),
    Amounts = Table.TransformColumnTypes(Scrubbed, {{"amount", type number}}),
    Dates = Table.TransformColumnTypes(Amounts, {{"order_date", type date}}, "en-GB"),
    Keyed = Table.AddColumn(Dates, "row_key", each [order_id] & "|" & [line_no], type text),
    Deduped = Table.Distinct(Keyed, {"row_key"}),
    Final = Table.RemoveColumns(Deduped, {"row_key"})
in
    Final
```

The third argument to `Table.TransformColumnTypes` is the culture, and it is the fix for section 3: `"en-GB"` forces DD/MM/YYYY, `"en-US"` forces MM/DD/YYYY. Setting it explicitly means the query produces the same dates on every machine.

Keep the rows that failed to parse instead of letting them become null. Load this second query to its own sheet:

```m
let
    Source = Excel.CurrentWorkbook(){[Name="RawOrders"]}[Content],
    Parsed = Table.AddColumn(Source, "date_ok", each try Date.FromText([order_date], "en-GB") otherwise null, type nullable date),
    Rejects = Table.SelectRows(Parsed, each [date_ok] = null)
in
    Rejects
```

A cleaning run with an empty reject table is one you can trust; a run with 40 rejects is one you have to explain.

**Rule:** if you will receive this file shape more than once, the cleaning belongs in a query, not in your hands. Manual steps cannot be reviewed, diffed, or handed over.

**Rule:** use Text to Columns only on a copy of the column, because it overwrites the cells to its right without asking.

## 6. Merged cells

A merged cell is one value pretending to span several rows. Sorting a range containing merged cells fails outright ("This operation requires the merged cells to be identically sized"), filters skip the hidden rows, and formulas that reference the hidden members return blank.

```
Bad:  merge A2:A5 so the region label looks tidy
Good: unmerge and fill the value down, so every row carries its own key
```

Unmerge and fill in one pass, then convert the formulas to values (`Copy`, `Paste Special > Values`) so a later sort cannot scramble the references:

```
Home > Merge & Center (toggle off) > select the column >
Home > Find & Select > Go To Special > Blanks >
type  =A2  (the cell above the first blank)  then press Ctrl+Enter
```

**Rule:** never merge cells inside a data range. Use `Format Cells > Alignment > Horizontal > Center Across Selection` for the same visual effect with no structural damage.

## 7. Casing and the PROPER trap

`PROPER` uppercases the letter after every non-letter, which is correct for `john smith` and wrong for a large share of real names.

```
=PROPER("mcdonald")     returns "Mcdonald", not "McDonald"
=PROPER("VAN DER BERG") returns "Van Der Berg", wrong in Dutch convention
=PROPER("IBM")          returns "Ibm", destroys the acronym
```

**Rule:** never apply `PROPER` to a name, company, or product column and paste over the original. It converts a known-messy column into a confidently-wrong one, and the original casing is gone.

For matching and deduplication, normalize into a separate helper column and keep the display value untouched:

```
=UPPER(TRIM(CLEAN(SUBSTITUTE(A2,CHAR(160)," "))))
```

Match on the helper, display the original. Casing is a presentation concern, so fix it at the presentation edge or not at all.

## 8. Leading zeros

Excel parses `02134` as the number 2134 on import and on paste. The text is gone the moment it lands, and no formula recovers it because the number of lost digits is unknown.

```
Bad:  double click the CSV, let Excel open it, then notice the zips are short
Good: Data > Get Data > From Text/CSV, then in the preview set the column type
      to Text before Load
```

If the file is already loaded and the original width is known, pad it back, which works only when every id has the same length (if lengths vary, re-import from source):

```
=TEXT(A2,"00000")          five digit zip
=TEXT(A2,"0000000000")     ten digit account number
```

**Rule:** an id, zip code, phone number, SKU, or account number is text, not a number. You never add two of them together, which is the only test that matters.

**Rule:** do not fix leading zeros with a custom number format, because the format changes the display while the stored value stays 2134, so a CSV export or a lookup against a text key fails again.

**Rule:** apostrophe prefixes (`'02134`) force text on manual entry but are invisible in exports and break exact-match lookups. Set the column type on import instead.

## 9. Find and Replace on a whole sheet

Whole-sheet Find and Replace is the fastest way to destroy a spreadsheet, because it hits columns you are not looking at, and Excel's undo does not survive a save.

```
Bad:  Ctrl+H, replace "1" with "", Within: Workbook, Replace All
      (rewrites every 1 in every number, every date, and every formula)
Good: select the target range first, set Within: Sheet,
      check "Match entire cell contents", press Find All and read the count,
      then Replace All and compare the reported count
```

**Rule:** always select the range before opening Find and Replace, and always run Find All first, because the Find All count is your prediction and the "N replacements made" message is the check.

**Rule:** switch on "Match entire cell contents" for any replacement of a whole value, because without it, replacing `NA` with blank also guts `CANADA` and `NAME`.

**Rule:** replacements that touch formulas (anything containing `=`, `$`, or a range) belong in a helper column, not in Find and Replace.

## 10. Count rows before and after every step

Every cleaning step has an expected effect on the row count: most have none, deduplication has a number you predicted in section 4, and filtering has a number you can state in advance. An unexplained change is a bug.

Put this block in a control area of the `work` sheet, read it after every step, and reconcile the finished sheet against the frozen original:

```
=COUNTA(A2:A100000)                                 non-blank keys
=SUMPRODUCT(--(A2:A100000<>""))                     same count, blind to stray spaces
=COUNTBLANK(B2:B100000)                             gaps in a required column
=SUM(D2:D100000)                                    control total that must survive
=SUMPRODUCT(1/COUNTIF(A2:A100000,A2:A100000&""))    distinct keys
=SUM(clean!D2:D100000)-SUM(raw!D2:D100000)          must be 0, or explained
=COUNTA(clean!A2:A100000)-COUNTA(raw!A2:A100000)    must equal rows you meant to drop
```

**Rule:** write the expected count down before running the step. A number you produce afterwards will always look reasonable.

**Rule:** a control total that moves by a round number usually means a filter; one that moves by a fraction usually means a type conversion dropped rows to blank.

## Anti-patterns

- Editing the only copy of the source file (no evidence, no rollback).
- Sorting one column without selecting the others (permanently decouples the rows).
- Using Format Cells to "convert" text to numbers or dates (changes display only).
- Deleting rows you believe are blank without checking for cells holding `""` from a formula.
- `IFERROR(...,"")` wrapped around a conversion (hides exactly the rows that failed).
- Hardcoding a cleaned value over a formula (the step can no longer be re-run).
- Hidden rows or columns inside a range you are about to delete or copy.
- Trusting a visual scan of the first 20 rows as verification.

## When to use this skill

Use it when a column will not SUM, when dates look right on screen but sort wrong, when a total changed after a dedupe, when two files that should join return no matches, when zip codes or SKUs lost digits, or when the same messy export arrives on a schedule. Skip it when the file is already a clean typed export from a database (clean at the query instead), when the volume exceeds a few hundred thousand rows and belongs in pandas or SQL, or when the spreadsheet is a one-off scratch pad nobody will act on.

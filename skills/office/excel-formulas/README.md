# Excel Formulas

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for writing spreadsheet formulas that stay correct when data moves: exact-match lookups, locked references, targeted error handling, honest money rounding, and an audit pass before anyone acts on the number.

## What it does

Excel rarely refuses to calculate. It hands back a plausible number that is wrong. This skill names the specific mechanisms that produce those numbers and gives the fix for each:

- **Approximate-match lookups**: why a bare `VLOOKUP` returns a neighbouring row's value instead of an error, and why `XLOOKUP` or `INDEX`/`MATCH` removes both the match-type trap and the hard-coded column offset.
- **Absolute vs relative references**: which `$` goes where, what slides off the bottom of a lookup range on fill, and the mixed-reference grid pattern (`=$A2 * B$1`).
- **Error masking**: `IFERROR` swallowing `#REF!` and `#VALUE!` alongside the `#N/A` you expected, and `IFNA` or a direct condition guard as the targeted replacement.
- **Dynamic arrays**: spill behaviour, `#SPILL!` causes, the `#` spill-range operator, and why legacy Ctrl+Shift+Enter formulas no longer need the ceremony.
- **Criteria functions**: `SUMIFS`, `COUNTIFS`, and `AVERAGEIFS` replacing nested `IF` chains, including the string concatenation that criteria arguments actually require.
- **Type mismatches**: text that looks numeric, trailing spaces, non-breaking spaces, and the `COUNTIF` that returns 0 for a value sitting in plain sight.
- **Dates as serial numbers**: no timezone, no DST, half-open interval bounds, and `DATE()` instead of locale-dependent string parsing.
- **Floating point money**: why `=A2=B2` fails on invisible residue, and where `ROUND` belongs so line items sum to the printed total.
- **Volatile functions**: `NOW`, `RAND`, `OFFSET`, and `INDIRECT`, their recalculation cost, and non-volatile replacements built on Tables or `INDEX`.
- **Readability**: named ranges and structured Table references, plus the circular references and auditing tools (Trace Precedents, Evaluate Formula) that find what is left.

## When to use this

Concrete triggers:

- A lookup returns a value that exists in the table but belongs to the wrong row.
- A formula works in row 2 and returns `#N/A` from row 40 down, because the range slid on fill.
- The same key appears in both sheets and `COUNTIF` still returns 0.
- A column of `IFERROR` wrappers has quietly turned a broken reference into zeros inside a total.
- Line items on an invoice do not add up to the printed total.
- The workbook takes seconds to respond to a single keystroke.
- A total changed after someone inserted a column, and nobody can trace which formula moved.
- `=SUM(Sheet3!$D$2:$D$847)` appears in a cell someone else has to maintain.
- Excel warned about a circular reference and the warning was dismissed.
- The output feeds a board pack, an invoice, a forecast, or anything a person will act on.

Skip it when:

- The sheet is a scratch calculation you will close without saving.
- The logic needs joins across several sources, versioning, or tests (move to SQL or pandas).
- The file is a data dump for another tool, with no formulas in it at all.

## Quick start

One worked example: a raw order export and a product list, producing revenue per region with a correct per-line total. Every formula is real Excel.

**Step 0: make both ranges Tables**

Select the order data, press Ctrl+T, confirm the header row, and rename the Table to `Orders` in Table Design. Do the same for the product list and name it `Products`. Table references never slide on fill and grow when rows are appended.

**Step 1: normalize the join key before joining**

```excel
=TRIM(SUBSTITUTE([@SKU], CHAR(160), ""))
```

Put that in a helper column named `SKUKey` in both Tables. Then confirm the types agree:

```excel
=ISTEXT(Orders[@SKUKey]) = ISTEXT(INDEX(Products[SKUKey], 1))
```

`FALSE` here means one side is text and the other numeric, and every lookup will fail silently.

**Step 2: look the price up with exact match and a named result column**

```excel
=XLOOKUP([@SKUKey], Products[SKUKey], Products[UnitPrice], "missing price")
```

Pre-365 workbooks use the compatible form:

```excel
=IFNA(INDEX(Products[UnitPrice], MATCH([@SKUKey], Products[SKUKey], 0)), "missing price")
```

**Step 3: round where the number becomes money**

```excel
=ROUND([@Quantity] * [@UnitPrice] * (1 - [@DiscountRate]), 2)
```

Round on the line, not on the grand total, so the printed lines sum to the printed total.

**Step 4: count what failed instead of hiding it**

```excel
=COUNTIF(Orders[UnitPrice], "missing price")
```

If that is not 0, fix the product list. Do not wrap the lookup in `IFERROR(..., 0)`.

**Step 5: aggregate with criteria in cells, not in formula text**

Put the region in `$F$2` and the period bounds in `$G$2` and `$G$3`:

```excel
=SUMIFS(Orders[LineTotal], Orders[Region], $F$2, Orders[OrderDate], ">=" & $G$2, Orders[OrderDate], "<" & $G$3)
=COUNTIFS(Orders[Region], $F$2, Orders[Status], "<>cancelled")
```

The bounds are half-open (`>=` start, `<` next start) so orders timestamped late on the last day are not dropped.

**Step 6: build the region list dynamically**

```excel
=SORT(UNIQUE(Orders[Region]))
```

If that lands in `H2`, reference the whole spilled list with `$H$2#` so the summary grows with the data.

**Step 7: prove the parts add up to the whole**

```excel
=ROUND(SUM($I$2#) - SUM(Orders[LineTotal]), 2)
```

Anything other than `0` means a row is being double counted or dropped by the criteria. Then select the headline cell, run Formulas, Trace Precedents, and confirm the arrows reach only the cells you intended.

## Key concepts

- **Match type.** `VLOOKUP`'s fourth argument and `MATCH`'s third argument default to approximate. Omitting them on unsorted data returns a wrong value rather than an error. `FALSE` (or `0`) means exact.
- **Column offset vs named column.** `VLOOKUP(..., 3, FALSE)` counts columns from the range's left edge, so a column insert repoints it. `XLOOKUP` and `INDEX`/`MATCH` name the result column directly and survive the insert.
- **Anchoring.** `$` freezes what follows it. `$A$1` is fixed, `A$1` keeps its row on a fill down, `$A1` keeps its column on a fill right. F4 cycles the four forms.
- **Spill.** A dynamic array formula occupies one cell and writes into the cells below or beside it. Obstructed cells give `#SPILL!`. The `#` suffix (`H2#`) references the whole spilled result, whatever its current size.
- **Structured references.** `Orders[Amount]` is the whole column; `[@Amount]` is the current row's value. Both resize with the Table, which is why they replace `$A$2:$A$9999`.
- **Criteria strings.** `SUMIFS` criteria are text, so an operator must be concatenated: `">=" & $G$2`. Writing `">=$G$2"` compares against those literal characters.
- **Date serials.** A date is a day count since 1899-12-30 with time as the fraction. No timezone, no DST. `DATE(2026,3,15)` is locale-proof; `DATEVALUE("15/03/2026")` is not.
- **Volatility.** `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `OFFSET`, and `INDIRECT` recalculate on every workbook change and force their dependents to recalculate too. Tables and `INDEX` give dynamic ranges without that cost.
- **Round placement.** Rounding once at the end accumulates sub-cent error across rows; rounding at the point a value becomes customer-visible money makes the lines reconcile to the total.
- **Iterative calculation.** The workbook-level setting that lets circular references converge. It changes behaviour for every formula in the file, so it is a deliberate modelling choice, never a fix for an accidental loop.

## Common pitfalls

**Approximate match by omission**

```excel
=VLOOKUP(A2, Products!$A:$F, 3)          // Bad
=VLOOKUP(A2, Products!$A:$F, 3, FALSE)   // Good
```

Reason: the default is approximate match, which returns a neighbouring row's value on unsorted data and never errors.

**Hard-coded column index**

```excel
=VLOOKUP($A2, Products!$A:$F, 3, FALSE)                    // Bad
=XLOOKUP($A2, Products[SKU], Products[UnitPrice], "")      // Good
```

Reason: inserting a column inside the range repoints `3` at a different field, and the formula keeps returning numbers.

**Unlocked lookup range**

```excel
=VLOOKUP(A2, Sheet2!A2:C500, 3, FALSE)        // Bad
=VLOOKUP(A2, Sheet2!$A$2:$C$500, 3, FALSE)    // Good
```

Reason: the range shifts down on fill, so lower rows search a window that has slid past the data.

**Blanket IFERROR**

```excel
=IFERROR(VLOOKUP(A2, Products!$A:$F, 3, FALSE), 0)   // Bad
=IFNA(VLOOKUP(A2, Products!$A:$F, 3, FALSE), 0)      // Good
```

Reason: `IFERROR` also swallows `#REF!` and `#VALUE!`, converting a structurally broken formula into a zero inside a total.

**Criteria without concatenation**

```excel
=SUMIFS(Orders[Amount], Orders[Date], ">=$G$2")        // Bad
=SUMIFS(Orders[Amount], Orders[Date], ">=" & $G$2)     // Good
```

Reason: the first form compares against the literal text `$G$2` and matches nothing.

**Text keys against numeric keys**

```excel
=COUNTIF(Products[SKU], A2)                   // returns 0 though the value is visible
=COUNTIF(Products[SKU], TRIM(A2))             // Good, once both columns are text
```

Reason: `"00123"` as text and `123` as a number are different values, and the cells look identical on screen.

**Locale-dependent date parsing**

```excel
=DATEVALUE("03/04/2026")       // Bad: March or April depending on the machine
=DATE(2026, 4, 3)              // Good
```

Reason: string parsing follows the regional setting, so the same file gives different answers on two laptops.

**Closed date interval**

```excel
=SUMIFS(Orders[Amount], Orders[Date], ">=" & $G$2, Orders[Date], "<=" & $G$3)   // Bad
=SUMIFS(Orders[Amount], Orders[Date], ">=" & $G$2, Orders[Date], "<" & $G$3+1)  // Good
```

Reason: `<=` end drops any row with a time component on the final day, because that serial is greater than midnight.

**Float equality on money**

```excel
=IF(A2 = B2, "match", "differ")                 // Bad
=IF(ROUND(A2 - B2, 2) = 0, "match", "differ")   // Good
```

Reason: IEEE 754 doubles cannot represent cents exactly, and formatting hides the residue that breaks the comparison.

**Rounding only the total**

```excel
=C2 * D2                   // Bad: line shows 12.35, total sums 12.3456...
=ROUND(C2 * D2, 2)         // Good
```

Reason: the printed lines no longer add up to the printed total, and the gap grows with row count.

**Volatile dynamic range**

```excel
=SUM(OFFSET($A$1, 0, 0, COUNT($A:$A), 1))    // Bad
=SUM(Orders[Amount])                          // Good
```

Reason: `OFFSET` recalculates on every workbook change and drags its dependents along; a Table does not.

**INDIRECT for a sheet reference**

```excel
=SUM(INDIRECT($B$1 & "!A1:A100"))    // Bad
=SUM(Sheet2!$A$1:$A$100)             // Good
```

Reason: `INDIRECT` is volatile, breaks on a sheet rename, and is invisible to Trace Precedents and Find and Replace.

**Self-including total**

```excel
=SUM(B1:B10)    // Bad, when the formula itself sits in B10
=SUM(B1:B9)     // Good
```

Reason: the circular reference warning appears once, is easily dismissed, and leaves `0` behind permanently.

**Composite key without a separator**

```excel
=A1 & B1              // Bad: "AB"+"C" and "A"+"BC" collide
=A1 & "|" & B1        // Good
```

Reason: concatenated keys without a delimiter produce false matches between distinct records.

**Verifying by looking at row 2**

```excel
// Bad: read the first filled cell and move on
// Good: read the first, the last, and the count of failures
=COUNTIF(Orders[UnitPrice], "missing price")
```

Reason: fill errors and anchoring bugs appear at the bottom of the range, not at the top.

## See also

- `SKILL.md` in this directory: the full rule set with paired examples across all twelve areas.
- Microsoft docs: `XLOOKUP`, `INDEX`, `MATCH`, `SUMIFS`, `IFS`, and `IFNA` function references.
- Microsoft docs: "Dynamic array formulas and spilled array behavior" and "Using structured references with Excel tables".
- Formulas ribbon: Trace Precedents, Trace Dependents, Evaluate Formula, Error Checking, and Name Manager.
- `skills/data/python-pandas-analysis`: when the transform outgrows a grid and needs validated joins, dtypes, and assertions.
- `skills/engineering/sql-optimization`: when the aggregation belongs in the database that the export came from.

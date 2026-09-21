---
name: excel-formulas
description: Use when writing or auditing Excel formulas. Avoid the silent wrong-answer traps (approximate VLOOKUP, fill-broken references, IFERROR masks, text-vs-number keys) and build sheets that stay correct when data moves.
---

Build spreadsheets whose numbers survive a new row, a resort, and a second reader. The failure mode is almost never `#REF!`: it is a lookup that returned the row above the one you wanted, a fill that walked a range off the bottom of the table, or an `IFERROR` that turned a real bug into a clean zero. Every rule below exists because it shipped a wrong number that nobody caught.

## The working loop

1. **Name the inputs.** Raw data goes in a real Table or a named range, never a bare `A1:D9999`.
2. **Write the formula with exact match and locked references.** Approximate match and relative refs are opt-in, not defaults.
3. **Fill it across the whole column and read three rows.** First, last, and one in the middle.
4. **Break it on purpose.** Insert a row, delete a column, sort the source. If the number moves, the formula was wrong.
5. **Audit before you publish.** Trace Precedents on the headline cell, Evaluate Formula on anything with more than two nested calls.

## 1. VLOOKUP returns a wrong answer, not an error

`VLOOKUP` and `HLOOKUP` default to approximate match when the fourth argument is omitted. On unsorted data approximate match returns whatever value it stumbles on, and that value looks exactly like a correct one.

```excel
=VLOOKUP(A2, Products, 3)              // Bad: approximate match, silently wrong
=VLOOKUP(A2, Products, 3, FALSE)       // Good: exact match, returns #N/A when absent
```

`FALSE` and `0` are interchangeable in that argument. Use one every single time, including when you are certain the data is sorted, because the next person to paste into that sheet will not be.

The deeper problem is the column index. `3` means "third column from the left edge of the lookup range". Insert a column inside `Products` and the formula still points at position 3, which is now a different field, and it keeps returning numbers.

```excel
// Bad: hard-coded offset, breaks silently on a column insert
=VLOOKUP($A2, Products!$A:$F, 3, FALSE)

// Good: XLOOKUP names both the key column and the result column
=XLOOKUP($A2, Products[SKU], Products[UnitPrice], "not found")

// Good: INDEX/MATCH when XLOOKUP is unavailable (pre-2021, pre-365)
=INDEX(Products[UnitPrice], MATCH($A2, Products[SKU], 0))
```

**Rules:**
- `XLOOKUP` first when the workbook targets Excel 365 or 2021 and later. It defaults to exact match, takes an explicit not-found argument, and can look left.
- `INDEX`/`MATCH` when you need backward compatibility. The `0` third argument to `MATCH` is exact match and is not optional.
- Never leave the `MATCH` match type blank. `MATCH($A2, Products[SKU])` is approximate and has the same silent failure as bare `VLOOKUP`.

Two-way lookups read cleanly with a nested `MATCH` on each axis:

```excel
=INDEX($B$2:$G$50, MATCH($A55, $A$2:$A$50, 0), MATCH(B$54, $B$1:$G$1, 0))
```

## 2. Absolute vs relative references

`$` freezes the part it precedes. A reference with no `$` shifts in both directions when filled, which is correct for the row-by-row operand and catastrophic for the lookup range. `A1` moves on both axes, `$A1` keeps its column, `A$1` keeps its row, `$A$1` is fixed. F4 cycles the four forms.

```excel
// Bad: the lookup range slides down as you fill, losing rows off the bottom
=VLOOKUP(A2, Sheet2!A2:C500, 3, FALSE)

// Good: the key is relative, the range is absolute
=VLOOKUP(A2, Sheet2!$A$2:$C$500, 3, FALSE)

// Better: a Table reference cannot slide at all
=XLOOKUP(A2, Products[SKU], Products[UnitPrice], "")
```

The classic grid formula needs a mixed reference on each axis, not a full lock:

```excel
// In B2, filled across B2:G50: row labels in column A, column headers in row 1
=$A2 * B$1
```

**Rule:** any range that represents a fixed lookup table gets `$` on all four coordinates or becomes a Table reference. Any operand that should track the current row stays relative. Decide per reference, never per formula.

## 3. IFERROR hides real bugs

`IFERROR` catches every error type: `#N/A`, `#VALUE!`, `#REF!`, `#DIV/0!`, `#NAME?`. Wrapping a whole formula in it converts a broken reference and a legitimately missing key into the same blank cell.

```excel
=IFERROR(VLOOKUP(A2, Products!$A:$F, 3, FALSE), 0)   // Bad: a #REF! now reads as 0
=IFNA(VLOOKUP(A2, Products!$A:$F, 3, FALSE), 0)      // Good: only the expected absence
=IF(B2 = 0, "", A2 / B2)                             // Good: guard the cause, not the symptom
```

**Rules:**
- `IFNA` over `IFERROR` for lookups, because the only error you expect from a lookup is `#N/A`.
- Guard the cause (`IF(B2=0, ...)`) rather than the symptom when the cause is a single testable condition.
- Never substitute `0` for a missing value that feeds a `SUM` or an `AVERAGE`. `""` keeps it out of the average; `0` drags it down. Choose deliberately and write the choice in a comment cell.

## 4. Dynamic arrays and spill

In Excel 365 and 2021, a formula returning multiple values spills into the neighbouring cells. Anything in the spill path produces `#SPILL!`, including a single stray space.

```excel
=SORT(UNIQUE(Orders[Region]))                       // spills a column of regions
=FILTER(Orders[Amount], Orders[Region] = $F$1, 0)   // 0 is returned if nothing matches
=SEQUENCE(12, 1, 1, 1)                              // 1..12 down a column
```

Reference a spill range with the `#` suffix so it grows with the source:

```excel
// Bad: fixed height, drops values once the unique list exceeds 20
=SUMIFS(Orders[Amount], Orders[Region], $H$2:$H$21)

// Good: tracks the spill, whatever its size
=SUMIFS(Orders[Amount], Orders[Region], $H$2#)
```

Legacy array formulas from older workbooks were committed with Ctrl+Shift+Enter and display wrapped in braces. Do not type the braces; they are Excel's rendering. Modern equivalents need no key combination:

```excel
=SUM(($A$2:$A$100 = "EU") * $B$2:$B$100)      // legacy CSE pattern, still works
=SUMIFS($B$2:$B$100, $A$2:$A$100, "EU")       // clearer and faster
```

## 5. SUMIFS and COUNTIFS beat nested IFs

A nested `IF` chain encodes the criteria in the formula text, so every rule change is an edit to every filled cell, and the logic is invisible to a reader.

```excel
// Bad: unreadable, and the thresholds are trapped in the formula
=IF(A2="EU", IF(B2>1000, B2*0.1, B2*0.05), IF(B2>1000, B2*0.08, B2*0.03))

// Good: criteria live in cells, formula stays flat
=SUMIFS(Orders[Amount], Orders[Region], $F$2, Orders[Date], ">=" & $G$2, Orders[Date], "<" & $G$3)
=COUNTIFS(Orders[Region], $F$2, Orders[Status], "<>cancelled")
=AVERAGEIFS(Orders[Amount], Orders[Region], $F$2, Orders[Amount], ">0")
```

Criteria are strings, so an operator must be concatenated to the cell reference: `">=" & $G$2`, never `">=$G$2"` (which compares against the literal text).

For more than three branches, replace the `IF` chain with a lookup table plus `XLOOKUP`, or with `IFS`:

```excel
=IFS(B2 >= 1000, 0.10, B2 >= 500, 0.07, B2 >= 100, 0.04, TRUE, 0.02)
=XLOOKUP(B2, Tiers[MinAmount], Tiers[Rate], 0, -1)   // -1 = exact or next smaller
```

`IFS` evaluates top to bottom and returns the first `TRUE`, so order the conditions from most specific to least. The final `TRUE` is the default branch; without it an unmatched row returns `#N/A`.

## 6. Text that looks like a number

A lookup key imported as text will not match the same key stored as a number. The cells look identical on screen. Excel flags some of them with a green triangle, but not reliably, and not at all after a paste-as-values.

```excel
=ISTEXT(A2)                     // TRUE means the "number" in A2 is text
=ISNUMBER(A2)
=COUNTIF(Products[SKU], A2)     // 0 while the value is visibly present: type mismatch
```

Fix it at the source column, not inside the lookup:

```excel
// Bad: coercing inside every lookup, and only in one direction
=XLOOKUP(VALUE(A2), Products[SKU], Products[Price], "")

// Good: normalize the key column once, then look up plainly
=TRIM(CLEAN(A2))                // strips leading/trailing spaces and control chars
=VALUE(TRIM(A2))                // text to number, after the spaces are gone
=TEXT(A2, "00000")              // number to text, preserving leading zeros
```

**Rules:**
- Store identifiers (SKU, zip, account, phone) as text in both tables and never as numbers, because numeric parsing destroys leading zeros irreversibly.
- `TRIM` before comparing anything imported. A trailing space is the single most common cause of a lookup that "should work".
- Non-breaking spaces (character 160) survive `TRIM`. Remove them with `=SUBSTITUTE(A2, CHAR(160), "")` before trimming.

## 7. Dates are serial numbers

An Excel date is a number of days since 1899-12-30 (Windows default), formatted for display. Time is the fractional part. A date has no timezone and no DST, so subtracting two "timestamps" from different zones yields a wrong duration with no warning.

```excel
=DATE(2026, 3, 15)                    // Good: unambiguous, locale-independent
=DATEVALUE("15/03/2026")              // Bad: parses per locale, breaks on another machine
=EDATE(A2, 1)                         // one calendar month later, end-of-month safe
=EOMONTH(A2, 0)                       // last day of A2's month
=NETWORKDAYS(A2, B2, Holidays)        // business days, excluding a named holiday range
```

```excel
// Bad: string comparison, matches nothing
=COUNTIFS(Orders[Date], ">=2026-01-01")

// Good: build the bound as a real date
=COUNTIFS(Orders[Date], ">=" & DATE(2026,1,1), Orders[Date], "<" & DATE(2026,2,1))
```

**Rules:**
- Use a half-open interval (`>=` start, `<` next start) rather than `<=` end, because `<=` end excludes any time component on the last day.
- Store UTC instants as text or as separate date and offset columns if timezone matters. An Excel serial cannot carry a zone.
- `TODAY()` and `NOW()` are volatile (see below). For a fixed "as of" date, type the date into one input cell and reference it.

## 8. Floating point money and where ROUND goes

Excel stores numbers as IEEE 754 doubles, so `0.1 + 0.2` is not exactly `0.3`. Display formatting hides the residue; the stored value keeps it, and comparisons fail on invisible differences.

```excel
=IF(A2 = B2, "match", "differ")                      // Bad: fails on 1e-15 of noise
=IF(ROUND(A2 - B2, 2) = 0, "match", "differ")        // Good: compare at cent precision
=IF(ABS(A2 - B2) < 0.005, "match", "differ")         // Good: explicit tolerance
```

Round placement changes the total. Rounding once at the end lets sub-cent errors accumulate across thousands of rows; rounding each line makes the line items sum to the printed total.

```excel
// Bad: line shows 12.35, total sums the unrounded 12.3456...
=C2 * D2

// Good: round at the point the value becomes money a customer sees
=ROUND(C2 * D2, 2)
=ROUND(SUM(Orders[LineTotal]) * $F$2, 2)   // tax on an already-rounded base
```

`ROUND` rounds half away from zero. `ROUNDDOWN`, `ROUNDUP`, `MROUND`, `CEILING.MATH`, and `FLOOR.MATH` cover the other conventions. Do not rely on the "Precision as displayed" workbook option: it silently destroys the stored precision of every cell in the file, permanently.

**Rule:** round where the number becomes a currency amount (an invoice line, a payment, a printed subtotal) and nowhere else. Never round intermediate ratios, because the error compounds.

## 9. Volatile functions and recalculation cost

A volatile function recalculates on every change anywhere in the workbook, and it drags its entire dependency chain with it. A few are unavoidable; a column of them turns a 200ms recalc into 30 seconds.

Volatile: `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `OFFSET`, `INDIRECT`, `INFO`, `CELL` (most forms).

```excel
=SUM(INDIRECT("Sheet2!A1:A" & $B$1))          // Bad: volatile, broken by a sheet rename
=SUM(OFFSET($A$1, 0, 0, COUNT($A:$A), 1))     // Bad: volatile
=SUM(Orders[Amount])                          // Good: Table, not volatile
=SUM($A$1:INDEX($A:$A, COUNT($A:$A)))         // Good: INDEX, not volatile
```

`INDIRECT` also defeats every auditing tool: Trace Precedents cannot follow a reference that does not exist until calculation time, and Find and Replace will not update it.

**Rules:**
- Reach for a Table or `INDEX` before `OFFSET`. Tables resize themselves and are not volatile.
- Confine `NOW()` and `TODAY()` to one input cell each and reference that cell everywhere else, so a recalc does not change historical rows.
- Set Formulas, Calculation Options to Manual while building a large model, then F9 to recalculate on demand.
- Full-column references (`A:A`) in `SUMPRODUCT` or array-style formulas scan a million rows each. Bound them to the Table.

## 10. Named ranges and Table references

`=SUM(Sheet3!$D$2:$D$847)` tells a reader nothing and breaks when a row is added at row 848. Names and structured references carry meaning and resize automatically.

```excel
// Bad
=E2 * $H$4 * (1 - $H$5)

// Good: names defined in Formulas, Name Manager
=Quantity * UnitPrice * (1 - DiscountRate)

// Good: structured references inside a Table named Orders
=SUMIFS(Orders[Amount], Orders[Region], "EU")
=[@Quantity] * [@UnitPrice]        // same-row reference inside the Table
```

Convert a range to a Table with Ctrl+T. The Table grows when a row is appended, and every formula referencing `Orders[Amount]` picks the new row up with no edit.

**Rules:**
- Name anything referenced more than twice, and anything a reader would otherwise have to click to understand.
- Scope names to the workbook unless two sheets genuinely need the same name for different things.
- Do not name a range after its current location (`Data_D2_D847`). Name it after its meaning (`NetRevenue`).
- `[@Column]` is the current row; `[Column]` is the whole column. Mixing them up produces a spill or a whole-column aggregate where a single value was intended.

## 11. Circular references

A circular reference is a formula that depends on its own result, directly or through a chain. Excel warns once, then leaves `0` in the cell and keeps working, so the warning is easy to dismiss and never see again.

```excel
=SUM(B1:B10)    // Bad: includes its own cell, if the formula sits in B10
=SUM(B1:B9)     // Good
```

Find them at Formulas, Error Checking, Circular References. The status bar names the first offending cell. The common causes: a total row inside its own summed range, two cells referencing each other, and a Table total that references the Table column it lives in.

Iterative calculation (File, Options, Formulas, Enable iterative calculation) makes circular references converge instead of returning zero. Turn it on only for a deliberate convergence model (a loan fee that depends on the loan amount), and document it in the sheet, because it silently changes results for every other formula in the workbook.

## 12. Auditing

- **Trace Precedents** (Formulas group, or Ctrl+[ to jump): draws arrows to every cell the selected formula reads. Run it on the headline number before publishing.
- **Trace Dependents** (Ctrl+]): shows what breaks if you change this cell. Run it before deleting anything.
- **Evaluate Formula**: steps through a nested formula one operation at a time, showing the intermediate value. This is how you find which of four nested calls returns the wrong thing.
- **Show Formulas** (Ctrl+`): displays formula text across the whole sheet at once, which makes a hard-coded constant sitting among formulas obvious.
- **F9 on a selection**: highlight part of a formula in the formula bar and press F9 to see that fragment's value. Press Esc, not Enter, or you will paste the value over the formula.

## Anti-patterns

- Hard-coded constants inside formulas (`=B2 * 1.14`). Put the rate in a labelled cell and reference it.
- Merged cells anywhere near data. They break sorting, filtering, and every structured reference.
- `=IF(condition, TRUE, FALSE)`. The condition is already boolean; write `=condition`.
- Deep `IF` nesting past three levels. Use `IFS`, `XLOOKUP` against a tier table, or `SWITCH`.
- Full-column references in array-heavy formulas, which scan 1,048,576 rows per call.
- One formula that does five things. Break it into intermediate columns you can inspect, then hide them.
- `=A1&B1` for a composite key without a separator: `"AB" & "C"` and `"A" & "BC"` collide. Use `=A1 & "|" & B1`.

## When to use this skill

Use it when a total changed and nobody can say why, when a lookup returns a plausible but wrong value, when the same formula gives different answers in different rows of the same column, when a workbook takes seconds to recalculate, or when someone other than the author will act on the output.

Skip it when the sheet is a scratch calculation nobody reads twice, or when the logic has outgrown a spreadsheet (multi-step joins, versioned transforms, anything needing tests). At that point move to SQL or pandas and keep Excel for presentation.

---
name: excel-financial-modeling
description: Use when building a three-statement model, DCF, budget, or forecast in Excel. Separate inputs from calculations, keep one formula per row, and prove the balance sheet balances before anyone reads the valuation.
---

Build a forecast whose every number can be traced to a labelled assumption and whose errors announce themselves. A modelling mistake does not throw `#REF!`: it produces a valuation that is confidently wrong, survives review because the layout is unreadable, and gets discovered by the counterparty. Structure is the control, not carefulness.

## The working loop

1. **Lay out the sheets before typing a formula.** Inputs, Calculations, Outputs, in that order, never interleaved.
2. **Write one formula per row and fill it across all periods.** Every period column must hold the identical formula.
3. **Build the income statement, then working capital, then the balance sheet, then cash flow.** Cash is the plug that falls out last, never an input.
4. **Add the check row the moment the section exists**, not after the model is finished.
5. **Flex every driver to an absurd value** (revenue growth -90%, margin 0%) and confirm the checks still pass and no `#DIV/0!` appears.
6. **Audit the output cell**: Trace Precedents on the headline number, and confirm every leaf is an input cell, not a constant buried in a formula.

## 1. Inputs, calculations, outputs are three different places

A model where an assumption is typed inside a formula cannot be flexed, reviewed, or handed over. The single rule that prevents most modelling failures: a hard-coded number appears exactly once in the workbook, on an input sheet, with a label and a unit.

```excel
// Bad: growth rate, tax rate, and day count all invisible
=D10 * 1.08 * (1 - 0.25) / 365

// Good: every driver readable and flexible
=D10 * (1 + RevenueGrowth) * (1 - TaxRate) / DaysInYear
```

**Rules:**
- Put every assumption on an Inputs sheet, one row per driver, with the unit in the label (`Revenue growth (% YoY)`, `DSO (days)`).
- Never let a calculation sheet contain a typed number other than `0`, `1`, and period counters. Anything else is an input that escaped.
- Never let an output sheet contain a calculation. Outputs reference calculation cells and format them; they do not compute.
- Colour-code by convention so a reviewer can see structure without clicking: blue font for hard-coded inputs, black for formulas, green for links to another sheet, red for external workbook links. This is the near-universal banking convention and reviewers rely on it.
- Do not link to another workbook if it can be avoided; a closed source workbook returns stale values with no warning.

## 2. One formula per row, filled across every period

Consistency across a row is what makes a model reviewable: a reader checks one cell and trusts the other forty-seven. An inconsistent cell is invisible.

```excel
// Bad: Q1 hard-coded because "the actual is known"
D10: 1250000
E10: =D10 * (1 + $C$10)

// Good: actuals live in their own block, forecast rows stay uniform
E10: =E9 * (1 + E$5)
```

**Rules:**
- Keep actuals and forecast in separate column blocks, or in separate rows, so no forecast formula is ever overwritten by a pasted actual.
- Select the whole forecast range and press Ctrl+\ (Go To Special, Row differences) to find any cell that breaks the row pattern.
- Turn on Formulas, Error Checking, "Formulas inconsistent with other formulas in the region" and fix every green triangle rather than dismissing it.
- Never nest an `IF` that switches the formula shape by period (`=IF(E$4<=ActualPeriods, actual, forecast)`) across a whole model. Use separate blocks; the switch form doubles the logic in every row.

## 3. Time axis and period flags

Every calculation sheet shares one date row, built by formula from a single start date, so a change of start propagates everywhere.

```excel
E4: =EOMONTH($D$4, 1)              // period end dates, filled right
E5: =YEAR(E4)                      // year label
E6: =--(E4 <= ForecastStartDate)   // 1 for historical periods, 0 for forecast
E7: =--(MONTH(E4) = 12)            // year-end flag for annual roll-ups
```

**Rules:**
- Build period headers with `EOMONTH` or `EDATE`, never by typing dates or by `+30`, because month lengths differ and quarter ends drift.
- Store flags as `1`/`0` rows, then multiply by them, because a multiplication by a flag row is shorter and faster than an `IF` and shows in the grid as a visible switch.
- Annualise by `SUMIF` against the year label row, not by summing four hard-coded columns, because inserting a period breaks a hard-coded sum silently.

```excel
=SUMIF($E$5:$BZ$5, AnnualColumnYear, $E$20:$BZ$20)
```

## 4. Build order: the balance sheet balances or the model is wrong

Cash and revolver are outputs of the cash flow statement. If cash is typed or plugged, the model has no error detection left.

Order: revenue and cost drivers, income statement to EBITDA, depreciation from a fixed asset schedule, interest from a debt schedule, tax, net income, working capital schedule, capex and PP&E roll-forward, debt roll-forward, cash flow statement, closing cash, balance sheet.

Roll-forwards are the backbone. Every balance sheet stock item is opening balance plus flows:

```excel
// PP&E
=OpeningPPE + Capex - Depreciation

// Debt
=OpeningDebt + Drawdowns - Repayments

// Retained earnings
=OpeningRE + NetIncome - Dividends
```

**Rules:**
- Never compute a closing balance directly from a ratio. Compute the flow from the ratio, then roll the balance forward, because a directly computed balance breaks the cash flow statement's reconciliation.
- Derive working capital from days: `Receivables = DSO / 365 * Revenue`, `Payables = DPO / 365 * COGS`, `Inventory = DIO / 365 * COGS`. Then the cash flow line is the period-over-period change, negated.
- Sign conventions must be fixed per sheet and stated in a header comment: either costs are negative everywhere and you sum, or costs are positive everywhere and you subtract. Mixing the two is the most common source of a balance sheet that misses by exactly twice a line item.

## 5. Checks are rows in the model, not a final review

A model without check rows is a model whose errors are found by the reader.

```excel
// Balance sheet check, one per period
=ROUND(TotalAssets - TotalLiabilitiesAndEquity, 2) = 0

// Cash flow tie-out
=ROUND(ClosingCashBS - ClosingCashCF, 2) = 0

// Master check, on every sheet's top row
=AND(E$100:E$110)
```

**Rules:**
- Compare with `ROUND(x - y, 2) = 0`, never `x = y`, because floating point residue makes an exact comparison fail on a correct model.
- Put a master check cell in the same top-left position on every sheet so a reviewer sees `TRUE` or `FALSE` without scrolling.
- Add conditional formatting that fills the check cell red on `FALSE`. A check nobody notices is not a check.
- Check the things that can disagree: assets against liabilities plus equity, closing cash two ways, sum of segments against the total, depreciation against the asset schedule, and that no debt balance goes negative.
- Never fix a failing balance check by plugging a difference into a line item. Find the flow that is missing from the cash flow statement.

## 6. Circularity: interest on average debt

Interest depends on debt, debt depends on the revolver draw, the draw depends on cash, cash depends on interest. This is a genuine circular reference, and enabling iterative calculation makes the whole workbook silently tolerate accidental circularity too.

Two acceptable resolutions:

```excel
// Preferred: break the loop by charging interest on the opening balance
=OpeningDebt * InterestRate / 12

// If average balance is required: iterative calculation, plus a circuit breaker
=IF($C$3 = 1, 0, AVERAGE(OpeningDebt, ClosingDebt) * InterestRate / 12)
```

**Rules:**
- Prefer opening-balance interest. It removes the circularity entirely and the difference is immaterial in most models.
- If iteration is required, enable it at File, Options, Formulas with maximum iterations 100 and maximum change 0.001, and document the setting in a cell on the Inputs sheet, because the setting travels with the file and changes every other formula's failure mode.
- Always pair an iterative model with a circuit-breaker input cell (`1` = break) that zeroes the circular term, because a corrupted iteration leaves `#VALUE!` cascading with no way back.
- After toggling the breaker off, press F9 twice and confirm the balance check returns to `TRUE`.

## 7. DCF and return metrics

```excel
=NPV(WACC, E20:BZ20) + D20            // Bad if D20 is a period-0 flow inside the range
=XNPV(WACC, E20:BZ20, E4:BZ4)         // Good: actual dates, no period-spacing assumption
=XIRR(E20:BZ20, E4:BZ4)               // Good
```

**Rules:**
- `NPV` discounts the first value by one full period, so a period-0 outflow must sit outside the range and be added. Getting this wrong overstates or understates by exactly one period of discounting.
- Use `XNPV` and `XIRR` whenever periods are not exactly even, which includes every monthly model, because `NPV` assumes uniform spacing.
- `IRR` returns one root; a cash flow stream that changes sign more than once has several. Supply a guess and sanity-check against `XNPV` at that rate being near zero.
- Discount mid-period (`period + 0.5`) when cash flows arrive through the period rather than at its end, and state which convention the model uses on the Inputs sheet.
- Terminal value by perpetuity growth requires `g < WACC`; add an input validation check row, because a `g` above `WACC` returns a negative terminal value that still formats as a number.

```excel
=FinalYearFCF * (1 + g) / (WACC - g)
=IF(g >= WACC, "TV INVALID", FinalYearFCF * (1 + g) / (WACC - g))
```

## 8. Scenarios and sensitivity

```excel
// Scenario selector in C3: 1 = base, 2 = upside, 3 = downside
=CHOOSE($C$3, BaseGrowth, UpsideGrowth, DownsideGrowth)
=INDEX(ScenarioTable, MATCH($C$3, ScenarioIDs, 0), E$4)
```

**Rules:**
- Drive every scenario from one selector cell. A scenario implemented by overtyping inputs destroys the base case.
- Keep all scenario values visible side by side on the Inputs sheet, so a reviewer compares them without switching.
- Build sensitivity grids with Data, What-If Analysis, Data Table, with the output formula in the corner cell. Data Tables recalculate with the workbook and can be slow: set Calculation Options to "Automatic except for data tables" while building.
- Label every sensitivity axis with its unit and name the output in the corner (`EV / EBITDA`), because an unlabelled grid of numbers is routinely misread.

## 9. Formatting that carries meaning

- Use number formats, never rounded values, so precision is preserved for calculation: `#,##0;(#,##0)` for currency, `0.0%` for rates, `0.00x` for multiples.
- Show negatives in parentheses; a leading minus disappears when a report is printed.
- State units in the row label (`Revenue (USD 000s)`), and never mix units in a column.
- Group intermediate schedules with Data, Group rather than hiding rows, because hidden rows are forgotten and later deleted.
- Freeze panes at the first forecast column so labels stay visible across a wide time axis.
- Protect the calculation sheets and leave only input cells unlocked when the model goes to a non-author.

## Anti-patterns

- Cash or the revolver as a hard-coded input. The balance sheet then always balances and the model cannot detect any error.
- A balance sheet check that compares with `=` instead of `ROUND(...) = 0`, which shows `FALSE` on a correct model and trains reviewers to ignore it.
- Growth rates typed into forecast formulas instead of read from a driver row.
- `IFERROR` around a model formula. It converts a broken link into a clean zero that flows into the valuation.
- Merged cells in a period header row. They break fill, `SUMIF` across the row, and every structured reference.
- Deleting a period column instead of extending the model. Anything summing hard-coded columns silently drops the deleted one.
- A separate sheet per month or per scenario. The time axis belongs on the columns and the scenario in a selector; per-sheet copies diverge within a week.
- Iterative calculation enabled without a circuit breaker, so any accidental circularity converges to a wrong number instead of warning.
- Hiding the checks sheet before sending the model.

## When to use this skill

Use it when a model produces a valuation, a covenant test, a funding requirement, or a board number; when a balance sheet does not balance; when interest and debt depend on each other; when a forecast must flex across scenarios; or when the model will be handed to someone who did not build it.

Skip it for a one-off back-of-envelope calculation, and abandon the spreadsheet entirely when the model needs version control, unit tests, or joins across several data sources. At that point move the logic to Python and keep Excel for presentation.

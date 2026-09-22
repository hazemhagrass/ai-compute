# Excel Financial Modeling

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building three-statement models, DCFs, budgets, and forecasts that a stranger can audit: assumptions in one place, one formula per row, cash as an output, and check rows that fail loudly before the valuation is read.

## What it does

A financial model rarely errors. It returns a confident number that is wrong, and the layout hides why. This skill names the structural controls that make wrong numbers visible:

- **Inputs / calculations / outputs separation**: every assumption on one sheet with a unit in its label, no typed constants inside formulas, and the blue-black-green-red font convention reviewers read structure from.
- **Row consistency**: one formula filled across every period, actuals in a separate block, and Ctrl+\ (Row differences) to find the cell that broke the pattern.
- **Time axis**: period headers built from one start date with `EOMONTH`, `1`/`0` flag rows instead of `IF`, and annual roll-ups by `SUMIF` on a year label row.
- **Build order**: income statement, working capital, roll-forward schedules, cash flow, balance sheet, with cash falling out last as a plug rather than being typed.
- **Check rows**: balance sheet tie, cash two ways, segment sums, all compared with `ROUND(x - y, 2) = 0` and surfaced by a master check in a fixed position on every sheet.
- **Circularity**: opening-balance interest to break the loop, and when average balance is mandatory, iterative calculation with a documented circuit breaker.
- **Valuation math**: `NPV`'s one-period discount offset, `XNPV` and `XIRR` for uneven periods, multiple `IRR` roots, mid-period convention, and the `g >= WACC` terminal value trap.
- **Scenarios**: one selector cell driving `CHOOSE` or `INDEX`, scenario values visible side by side, and Data Tables for sensitivity grids.
- **Formatting with meaning**: number formats over rounded values, parenthesised negatives, units in labels, grouped schedules, frozen panes, protected calculation sheets.

## When to use this

Concrete triggers:

- The balance sheet does not balance, and the difference is being plugged into a line item.
- Interest depends on debt and debt depends on cash, and Excel is warning about a circular reference.
- Someone asked for a downside case and the only way to produce it is overtyping the base assumptions.
- A growth rate, tax rate, or day count is typed inside a forecast formula rather than read from a driver row.
- Cash or the revolver balance is an input, so the model can never detect its own error.
- The forecast produces a valuation, a covenant test, a funding requirement, or a board number.
- A monthly model is being discounted with `NPV`, which assumes even period spacing.
- Terminal value went negative because the perpetuity growth rate exceeded WACC.
- The model is about to be handed to someone who did not build it.
- One formula in the middle of a forecast row differs from its neighbours and nobody knows whether that is deliberate.

Skip it when:

- The calculation is a back-of-envelope estimate nobody will act on twice.
- The model needs version control, unit tests, or joins across several sources (move it to Python).
- The file is a data extract with no forecast logic in it.

## Quick start

A minimal monthly model skeleton. Three sheets: `Inputs`, `Model`, `Outputs`.

**Step 1: one date row drives everything**

On `Model`, put the model start date in `$D$4`, then fill right:

```excel
E4: =EOMONTH(D4, 1)
E5: =YEAR(E4)
E6: =--(E4 <= ForecastStartDate)    // 1 = historical, 0 = forecast
```

Never type a second date anywhere in the model.

**Step 2: drivers live on Inputs, named**

```excel
RevenueGrowth    0.8%   per month
GrossMargin      62%
DSO              45     days
DPO              30     days
InterestRate     7.5%   per annum
TaxRate          25%
```

Name each cell in Name Manager. Formulas then read as English.

**Step 3: the income statement, one formula per row**

```excel
Revenue        E10: =D10 * (1 + RevenueGrowth)
Gross profit   E11: =E10 * GrossMargin
Opex           E12: =-(E10 * OpexPctRevenue)
EBITDA         E13: =E11 + E12
D&A            E14: =-E40                      // from the PP&E schedule
Interest       E15: =-D50 * InterestRate / 12  // opening debt, breaks circularity
PBT            E16: =E13 + E14 + E15
Tax            E17: =-MAX(0, E16) * TaxRate
Net income     E18: =E16 + E17
```

Costs are negative throughout, so every subtotal is a `SUM`. Pick that convention once and never mix it.

**Step 4: working capital from days, then the change is the cash flow line**

```excel
Receivables    E30: =DSO / 365 * E10 * 12
Payables       E31: =DPO / 365 * -E12 * 12
Δ WC           E32: =-((E30 - D30) - (E31 - D31))
```

**Step 5: roll forward every balance**

```excel
PP&E closing   E40: =D40 + E41 - E42          // opening + capex - depreciation
Debt closing   E50: =D50 + E51 - E52          // opening + draws - repayments
RE closing     E55: =D55 + E18 - E56          // opening + net income - dividends
Cash closing   E60: =D60 + E70                // opening + net cash flow, never typed
```

**Step 6: the check rows, written now and not later**

```excel
E100: =ROUND(E80 - E90, 2) = 0                 // assets vs liabilities + equity
E101: =ROUND(E60 - E61, 2) = 0                 // closing cash, BS vs CF
E102: =E50 >= 0                                // debt never goes negative
E99 : =AND(E100:E102)                          // master check
```

Conditional-format `E99` red on `FALSE`, and copy it to the top-left cell of every sheet.

**Step 7: flex it hard before trusting it**

Set `RevenueGrowth` to `-20%`, `GrossMargin` to `0%`, and `DSO` to `365`. The master check must stay `TRUE` and no `#DIV/0!` may appear. If either fails, the model is wrong in the base case too; you just could not see it.

## Key concepts

- **Cash is a plug, not an input.** Closing cash is opening cash plus the cash flow statement's net movement. The moment cash is typed, the balance sheet always balances and the model's only self-test is gone.
- **Roll-forward discipline.** Every stock is opening plus flows. Ratios produce flows, never balances directly.
- **Row uniformity is the review mechanism.** A reviewer checks one cell per row and trusts the rest, so a single inconsistent cell defeats the entire review.
- **Checks belong inside the model.** A tie-out computed during review runs once; a check row runs on every keystroke.
- **Circularity is a design choice.** Opening-balance interest removes it. Iterative calculation tolerates it and, without a circuit breaker, tolerates accidental circularity everywhere else too.
- **Discounting conventions are explicit.** Period-end vs mid-period and even vs dated periods change the answer by percentage points; write the choice on the Inputs sheet.

## Common pitfalls

**Assumption buried in a formula**

```excel
=D10 * 1.08 * (1 - 0.25)                     // Bad
=D10 * (1 + RevenueGrowth) * (1 - TaxRate)   // Good
```

Reason: a driver that is not on the Inputs sheet cannot be flexed, reviewed, or found again.

**Hard-coded actual inside a forecast row**

```excel
D10: 1250000                    // Bad: overwrote the formula "just for Q1"
E10: =D10 * (1 + RevenueGrowth)
```

Reason: the row is no longer uniform, so a reviewer checking one cell learns nothing about the others. Keep actuals in their own block.

**Exact equality in a balance check**

```excel
=E80 = E90                       // Bad: FALSE on a correct model
=ROUND(E80 - E90, 2) = 0         // Good
```

Reason: floating point residue makes an exact comparison fail, and a check that cries wolf gets ignored.

**Plugging the balance difference**

```excel
=OtherAssets + BalanceDifference    // Bad
```

Reason: it hides the missing cash flow line permanently, and the model now balances for every future error too.

**`NPV` with the period-0 flow inside the range**

```excel
=NPV(WACC, D20:BZ20)             // Bad: D20 gets discounted one period
=D20 + NPV(WACC, E20:BZ20)       // Good
=XNPV(WACC, D20:BZ20, D4:BZ4)    // Good: dated, no spacing assumption
```

Reason: `NPV` discounts its first argument by one full period, so an in-range period-0 outflow is understated by exactly one period.

**`NPV` on a monthly model**

```excel
=NPV(AnnualWACC, MonthlyFlows)                  // Bad: rate and spacing disagree
=XNPV(AnnualWACC, MonthlyFlows, PeriodDates)    // Good
```

Reason: `NPV` assumes evenly spaced periods matching the rate's period; months are not equal and the rate is annual.

**Terminal value with `g >= WACC`**

```excel
=FCF * (1 + g) / (WACC - g)                                   // Bad
=IF(g >= WACC, "TV INVALID", FCF * (1 + g) / (WACC - g))      // Good
```

Reason: the perpetuity formula returns a negative number that still formats as currency and flows into the valuation.

**Iterative calculation without a breaker**

```excel
=AVERAGE(D50, E50) * InterestRate / 12                        // Bad
=IF($C$3 = 1, 0, AVERAGE(D50, E50) * InterestRate / 12)       // Good
```

Reason: once an iteration corrupts, `#VALUE!` cascades with no way to recover, and accidental circularity elsewhere converges silently instead of warning.

**Scenarios by overtyping**

```excel
// Bad: change the inputs, take a screenshot, change them back
=CHOOSE($C$3, BaseGrowth, UpsideGrowth, DownsideGrowth)    // Good
```

Reason: the base case is destroyed and the two cases can never be compared side by side.

**Annual total from hard-coded columns**

```excel
=SUM(E20:H20)                                       // Bad
=SUMIF($E$5:$BZ$5, AnnualYear, $E$20:$BZ$20)        // Good
```

Reason: inserting or deleting a period leaves the hard-coded sum quietly covering the wrong months.

**Mixed sign conventions**

```excel
Opex   E12: =E10 * OpexPct      // positive here
EBITDA E13: =E11 - E12          // subtracted here, added two rows down
```

Reason: a line item counted with the wrong sign moves the balance check by exactly twice its value, which is the hardest error to spot by eye.

**`IFERROR` around a model formula**

```excel
=IFERROR(E30 / E10, 0)      // Bad: a broken link now reads as a clean zero
=IF(E10 = 0, 0, E30 / E10)  // Good: guard the known cause only
```

Reason: `IFERROR` catches `#REF!` too, so a deleted row becomes a plausible zero inside the valuation.

**A sheet per month or per scenario**

Reason: the copies diverge as soon as one formula is fixed in only one of them. Periods belong on columns, scenarios in a selector cell.

## See also

- `SKILL.md` in this directory: the full rule set, build order, and check specification.
- `skills/office/excel-formulas`: lookup, reference, rounding, and volatility rules the model formulas rest on.
- `skills/office/pivot-tables`: summarising model output for reporting.
- `skills/data/python-pandas-analysis`: when the model needs tests, version control, or multi-source joins.
- Microsoft docs: `XNPV`, `XIRR`, `EOMONTH`, `SUMIF`, `CHOOSE`, and "Data Table" what-if analysis.
- Formulas ribbon: Name Manager, Trace Precedents, Evaluate Formula, Error Checking, and iterative calculation settings under File, Options, Formulas.

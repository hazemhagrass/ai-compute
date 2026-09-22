# Budget Tracker

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="budget-tracker robot" width="200">
</div>

A method skill for building a personal budget that survives a real month: track actuals before setting targets, separate fixed from variable from irregular, pre-fund the irregular with sinking funds, and reconcile against the bank so the tracker never quietly becomes fiction.

## What it does

This is educational content about method. It is not financial advice, and it recommends no spending level, savings rate, or product. It covers how to build and maintain the system; the numbers are yours.

- **Observation before targets**: why a budget built on guessed categories fails in week two, and what one cycle of unjudged tracking produces instead.
- **Category design**: categories derived from your own transaction history, kept few enough that filing a transaction is mechanical rather than a decision.
- **Fixed, variable, irregular**: the three-way split, and why modelling only the first two makes every renewal month look like reckless spending.
- **Sinking funds**: converting an annual cost into a level monthly contribution, tracking the fund balance rather than only the contribution line.
- **Frameworks**: zero-based, envelope, and percentage side by side, with the cost and the failure mode of each and no claim that one wins.
- **Irregular income**: planning on the trailing low instead of the hoped-for average, and a standing rule for surplus decided before the surplus arrives.
- **Reconciliation**: matching tracker to statement weekly, the usual causes of a gap, and why an unreconciled budget still looks tidy while describing a month that never happened.
- **Automation vs manual entry**: friction that creates awareness against consistency that survives a busy month, and the hybrid that keeps both.
- **The monthly review**: variance by category, and the four possible causes of a blown category, only one of which is behaviour.
- **Knowing when to stop**: coarsening detailed tracking once it stops changing decisions, and what to keep running regardless.

## When to use this

Concrete triggers:

- Your budget has been rebuilt from scratch more than twice and abandoned each time.
- Certain months look inexplicably bad, and they turn out to be the months with an insurance renewal or a car repair in them.
- The tracker's balance and the bank's balance disagree, and nobody knows since when.
- Income varies month to month and a fixed monthly plan keeps being unfundable.
- You can name your rent to the unit but cannot say what you spent on food last month.
- A subscription you forgot about showed up on a statement.
- Categories have grown to 40, nine of them empty, and filing a transaction now requires thought.
- You are choosing between a spreadsheet and a budgeting app and want the tradeoff written down.
- Tracking has become a source of stress rather than a source of information.

Skip it when:

- The question is tax treatment, investment selection, or debt-instrument comparison. Different problem, and where the amounts matter, a qualified professional.
- You are doing business bookkeeping with entities, payroll, or accruals.
- You need spreadsheet formula craft rather than budgeting method (see See also).

## Quick start

One worked month. Take-home income is 4,200 units, arriving in one payment. Every figure below adds up; the point is the structure, not the amounts.

**Step 1: assign the plan, including one sinking-fund line**

| Category | Type | Planned |
| --- | --- | --- |
| Rent | Fixed | 1,350 |
| Utilities | Fixed | 140 |
| Phone and internet | Fixed | 95 |
| Transit pass | Fixed | 80 |
| Health premium | Fixed | 210 |
| Groceries | Variable | 480 |
| Eating out | Variable | 180 |
| Household | Variable | 90 |
| Fuel | Variable | 110 |
| Personal | Variable | 100 |
| Sinking funds | Irregular | 220 |
| Debt payment | Fixed | 400 |
| Savings transfer | Fixed | 500 |
| Unassigned buffer | Buffer | 245 |
| **Total** | | **4,200** |

Fixed 2,775, variable 960, sinking 220, buffer 245. The plan equals income, so nothing is unexamined. The buffer is a real assignment with the job "absorb variance, roll forward".

**Step 2: show what the sinking-fund line is made of**

```
Car insurance        1,020 / yr  ->   85 / mo
Car maintenance        720 / yr  ->   60 / mo
Gifts and holidays     600 / yr  ->   50 / mo
Routine dental         300 / yr  ->   25 / mo
                                    ------
Monthly contribution                 220
```

Move 220 out of the spending account on payday. Track a balance per fund, not just the contribution.

**Step 3: record actuals as the month runs**

| Category | Planned | Actual | Variance |
| --- | --- | --- | --- |
| Groceries | 480 | 512 | +32 |
| Eating out | 180 | 245 | +65 |
| Household | 90 | 70 | -20 |
| Fuel | 110 | 96 | -14 |
| Personal | 100 | 100 | 0 |
| **Variable total** | **960** | **1,023** | **+63** |

Fixed lines landed as planned. The 63 comes out of the 245 buffer, leaving 182 to roll forward. No line went unfunded.

**Step 4: let the sinking fund absorb the irregular cost**

A brake job costs 340 this month.

```
Car maintenance fund, opening      420
  + contribution                    60
  - brake job                     -340
  = closing                        140
```

The month shows a 340 transfer out of the fund, not a 340 overspend. Variable spending is untouched, and the review is not distorted by a cost that was always coming.

**Step 5: reconcile against the statement**

```
Tracker closing balance      1,406
Bank closing balance         1,368
Difference                      38
```

The tracker is 38 high, meaning 38 of spending never got entered. Do not adjust the tracker to match. Find the cause: here a 36 charge was never entered, and a card payment settled two units above the pending amount it was recorded at. Enter both, re-run, confirm zero.

**Step 6: review and change one number**

Eating out ran 36 percent over for the second month running. That is either a wrong target or drifted behaviour. Two months of data says the target was set from a guess. Raise it to 240 next month and take the 60 from the buffer line, which is what the buffer is for. Record the decision in the file so next month's review can see it.

## Key concepts

- **Actuals before targets.** Targets written before a full observation cycle are guesses, and the first miss reads as personal failure rather than a bad estimate. Track one cycle unjudged, then set targets from the totals.
- **Actionable category.** One you can change next week. "Groceries" qualifies; "Lifestyle" does not, because no specific action follows from the number.
- **Fixed cost.** Same amount, every month. The lever is renegotiation, used rarely.
- **Variable cost.** Every month, differing amount. The lever is week-to-week behaviour.
- **Irregular cost.** Some months, usually large: annual insurance, vehicle work, gifts, dental, appliance replacement. Modelled as zero in most budgets, which is why renewal months look catastrophic.
- **Sinking fund.** Annual cost divided by twelve, moved out of the spending account monthly, spent from when the bill lands. Turns a lumpy cost into a level one.
- **Zero-based.** Every unit of income gets a job until the plan totals income. Thorough; costs a re-plan each month; strains under unpredictable income.
- **Envelope.** Each category holds a fixed pot; when it is empty, spending stops. Immediate feedback; rigid mid-month when costs are genuinely lumpy.
- **Percentage.** Income split into broad buckets by share. Very low maintenance; too coarse to locate a specific leak.
- **Trailing low.** The lowest income month in the last 6 to 12, used as the planning base when income varies, so a bad month is a normal month.
- **Reconciliation.** Line-by-line agreement between tracker and statement for a period, ending in a matching closing balance. The gap is data, not noise.
- **Variance.** Planned minus actual, per category. The unit of the monthly review.
- **Data ownership.** Whether you can export your history in a usable form and still read it after you stop paying. Test it before committing, not after.

## Common pitfalls

**Setting targets before tracking a cycle**

Guessed targets miss by wide margins in month one, and the miss is felt as failure rather than as a bad estimate. Track first, set targets from your own totals.

**Budgeting irregular costs as zero**

The insurance renewal was always coming. Without a sinking fund it arrives as a spike, the month reads as reckless, and the plan loses credibility. Scan 12 months for every non-monthly cost and give each a fund.

**Too many categories**

Forty categories means filing a transaction requires a decision. Decisions get postponed, then skipped, then the tracker is three weeks stale. Delete any category with no activity for two months.

**Categories that no action follows from**

"Miscellaneous" at 400 is a number you cannot act on. Split it only when the split would change what you do.

**Never reconciling**

An unreconciled tracker drifts and still looks tidy, which is what makes it dangerous. Ten minutes weekly beats two hours at month end, and a small gap is findable while you still remember the week.

**Adjusting the tracker to match the bank**

Plugging the difference destroys the only signal reconciliation produces. Find the cause: a pending charge that settled differently, a refund, a transfer counted twice, a shared card.

**Planning variable income on the average**

The average month never arrives, and the plan is unfundable precisely in the months that need it. Plan at the trailing low; assign surplus when it actually lands, by a rule written in advance.

**Raiding one sinking fund for another**

Untracked, the shortfall stays invisible until the bill arrives. If you must borrow between funds, record it as a transfer with a repayment month.

**Treating every overspend as a behaviour problem**

Four causes exist: wrong target, unusual month, permanent price change, drifted behaviour. Only the last calls for behaviour change, and it is rarer than it feels. Misattributing the other three is the fastest route to quitting.

**Ignoring the underspends**

A category consistently 40 percent under target is capacity sitting idle and a target nobody believes. Reallocate it deliberately.

**Reviewing without changing a number**

If the review does not update a target, a fund estimate, or a rule, it was a reading session. Close every review with one concrete edit.

**Full automation with no weekly look**

Automated import runs perfectly and unread for months. Automate the import, categorize and review by hand weekly; the review is where the awareness lives.

**Manual entry as a permanent regime**

Manual entry works because typing the number is a second look at the purchase, but that value decays once behaviour has changed, and the friction eventually wins. Move to import plus review once the category is stable.

**Choosing an app without testing the export**

Export your data once on day one and open the file. If the export is unusable or absent, you are renting your own history.

**Tracking in detail forever**

Detailed tracking is a diagnostic tool. When several months of review change nothing, coarsen: keep the reconcile and the sinking funds, collapse the variable categories. Return to detail when something changes.

## See also

- [SKILL.md](SKILL.md) in this directory: the full method, rule by rule, with the framework and automation comparison tables.
- [Excel formulas](../../office/excel-formulas/SKILL.md): exact-match lookups, locked references, and where `ROUND` belongs when the budget lives in a spreadsheet.
- [Excel data cleaning](../../office/excel-data-cleaning/SKILL.md): normalizing a bank CSV export before categorizing it.
- [Pivot tables](../../office/pivot-tables/SKILL.md): summing actuals by category and month without hand-built formulas.
- [Excel financial modeling](../../office/excel-financial-modeling/SKILL.md): separating inputs from calculations when the sheet grows past a simple tracker.
- [Data visualization principles](../../data/data-visualization-principles/SKILL.md): choosing a chart for variance that answers a question rather than decorating one.

---
name: budget-tracker
description: "Use when building or fixing a personal budget. Track actuals before setting targets, separate fixed from variable from irregular, fund the irregular with sinking funds, and reconcile against the bank so the numbers stay real."
---

# Budget Tracker

This skill is about method: how to build a tracking system that still works in
week three of a real month. It is educational material about process, not
financial advice, and it makes no recommendation about what you should spend,
save, or owe. Those numbers are yours.

Audience: anyone whose budget keeps dying. Not for tax planning, investment
selection, or business accounting, none of which are covered here.

The characteristic failure is not overspending. It is a budget assembled from
guesses on a Sunday evening, which by week two no longer describes anything
that happened, and is therefore abandoned rather than corrected. Every rule
below exists to keep the document and reality attached to each other.

## The working loop

1. **Observe first.** Track actual spending for one full cycle before writing a
   single target. A budget built on guessed categories fails in week two.
2. **Name categories from the receipts you actually have**, not from a template.
3. **Split the plan three ways**: fixed, variable, irregular.
4. **Give every irregular cost a monthly sinking-fund contribution.**
5. **Reconcile weekly** against the bank statement.
6. **Review monthly** by variance per category, then adjust the targets, not
   your memory of them.

## 1. Track actuals before you set targets

A target invented before you have data is a wish with a number attached. When
reality misses it by 40 percent, the honest conclusion is "my estimate was
wrong", but the felt conclusion is "I failed", and the budget gets closed.

Spend one cycle in observation mode only:

- Export 60 to 90 days of transactions from every account you spend from,
  including the card you forget about.
- Label each transaction with a rough category. Do not judge any of them.
- Total each category. Those totals are your starting targets, not aspirations.

Two things surface reliably in that first export: a recurring charge you had
forgotten, and a category that is roughly double what you would have guessed.
Both are the point of the exercise.

## 2. Categories that match how you actually spend

Categories exist to make a number actionable. "Groceries" is actionable because
you can change it next week. "Lifestyle" is not, because nothing specific can
be done about it.

Rules:

- Derive categories from your own transaction history, not from a default list.
  If nothing lands in a category for two months, delete it.
- Keep the count low enough that you can recall it unaided. When a transaction
  needs 30 seconds of thought to file, the system is already too fine-grained.
- Split a category only when the split would change a decision. Separating
  "coffee" from "eating out" is worth it only if you intend to treat them
  differently.
- One category per merchant type, so filing is mechanical. Ambiguity is the
  main source of skipped entries.
- Give yourself a category for the genuinely unclassifiable. A small "other"
  bucket is healthier than forcing entries into the wrong home.

Bad: 40 categories, 9 of them empty, 3 of them overlapping.

Good: 12 to 15 categories, each with activity every month, each one you could
act on.

## 3. Fixed, variable, irregular

| Type | Timing | Amount | Example | Lever |
| --- | --- | --- | --- | --- |
| Fixed | Every month | Same | Rent, phone plan | Renegotiate or move, rarely |
| Variable | Every month | Differs | Groceries, fuel | Adjust week to week |
| Irregular | Some months | Large | Annual insurance, car repair | Pre-fund it |

Most budgets model the first two and ignore the third, which is exactly why a
November that contains an insurance renewal looks like a month of reckless
spending. It is not overspending. It is an expense that was always coming and
was never given a home in the plan.

Find your irregular costs by scanning 12 months of history for anything over a
threshold that did not repeat monthly: insurance, vehicle work, medical and
dental, gifts and holidays, appliance replacement, annual software, travel,
school costs, pet care.

## 4. The sinking-fund method

A sinking fund converts a lumpy cost into a level monthly one.

1. Estimate the annual cost of the irregular item.
2. Divide by 12. That is the monthly contribution.
3. Move that amount out of the spending account every month, to a separate
   account or a tracked sub-balance.
4. When the bill lands, pay it from the fund. The month shows a transfer, not a
   spike.

```
Car insurance      1,020 / yr  ->   85 / mo
Car maintenance      720 / yr  ->   60 / mo
Gifts and holidays   600 / yr  ->   50 / mo
Routine dental       300 / yr  ->   25 / mo
                                  ------
                                   220 / mo
```

Track each fund's balance, not just the contribution. A fund at 70 after a
repair is telling you something a contribution line cannot.

Two rules keep funds honest: do not raid one fund to cover another without
recording it, and re-estimate the annual figures once a year against what the
item actually cost.

## 5. Frameworks: zero-based, envelope, percentage

No framework is best. They differ in how much friction they impose and what
they are good at catching.

| Framework | Rule | Strength | Cost | Fails when |
| --- | --- | --- | --- | --- |
| Zero-based | Assign every unit of income a job until the plan totals income | Nothing is unexamined | Re-planning each month | Income is unpredictable |
| Envelope | Each category holds a fixed pot; when empty, stop | Hard stop, immediate feedback | Rigid mid-month | Costs are genuinely lumpy |
| Percentage | Split income into broad buckets by share | Very low maintenance | Coarse, hides category drift | You need to find a specific leak |

A buffer line is a legitimate zero-based assignment. "Unassigned, rolls
forward" is a job; leaving 370 unmentioned is not.

Envelopes can be literal cash, separate accounts, or just columns. The
mechanism that matters is the visible remaining balance, not the medium.

Mixing is normal and not a failure: percentage at the top level, envelopes on
the two categories that actually run away from you.

## 6. Irregular income

If income varies, budget on the trailing low, not the hoped-for average. Take
the lowest month in the last 6 to 12 and plan fixed costs and sinking funds
against that figure. Anything above it is surplus, assigned when it arrives.

- Plan at the trailing low, so a bad month is a normal month.
- Give surplus a standing rule decided in advance, so a good month is not a
  spending decision made under excitement.
- Keep a buffer sized in months of fixed costs plus sinking contributions, so
  that a bad month draws down a planned reserve rather than a credit line.

Averaging is the trap: an average month never arrives, and the plan is
unfundable in exactly the months that need it most.

## 7. Reconciliation, or the budget becomes fiction

Reconciling means matching your tracker line by line to the bank statement for
a period, and agreeing on the closing balance. Without it, small omissions
compound until the tracker describes a month that did not happen, and the
worst part is that it still looks tidy.

Weekly, per account:

1. Open the statement for the period since the last reconcile.
2. Tick each transaction present in both.
3. Add what is in the bank and missing from the tracker.
4. Investigate what is in the tracker and missing from the bank: pending,
   duplicated, or entered twice with different dates.
5. Confirm closing balance matches. If it does not, the gap is data, not noise.

Common causes of a gap: a pending charge that settled at a different amount, a
refund, a transfer counted as both income and expense, a shared card, a
subscription whose currency conversion moved.

Ten minutes weekly is cheaper than two hours at month end, and a small gap is
findable while you still remember the week.

## 8. Automation vs manual entry

These trade against each other and the right answer changes over time.

| | Manual entry | Automated import |
| --- | --- | --- |
| Main effect | Friction creates awareness | Consistency survives a busy month |
| Failure mode | Skipped days, then abandonment | Runs perfectly, nobody reads it |
| Best for | The first months, or a category you are trying to change | Steady state, many accounts |
| Categorization | Deliberate, per transaction | Rules, needing periodic correction |
| Data access | You hold it | Depends on the provider |

Manual entry works because typing the number is a second look at the purchase.
That value decays once behaviour has changed. Automation works because it never
gets tired, which is also why an automated budget can run unread for months.

A practical middle: automate import, but review and categorize by hand once a
week. The review is where the awareness lives; the import is what keeps the
data complete.

## 9. The monthly review

Budget for the plan, review for the variance. Per category: planned, actual,
difference, and one sentence of cause.

A blown category is information, not failure. The useful question is which of
four things happened:

1. The target was wrong (estimate too low). Fix the target.
2. The month was unusual (a visitor, a trip). Leave the target alone.
3. A cost moved permanently (rent increase, price rise). Re-plan.
4. Behaviour drifted. This is the only case that calls for a change in
   behaviour, and it is rarer than it feels.

Treating all four as case 4 is the fastest way to quit. Also review the
underspends: a category consistently 40 percent under target is capacity that
belongs somewhere else, and a target nobody believes anymore.

Close the review by updating next month's targets in the file. A review that
does not change a number was a reading session.

## 10. Spreadsheet or app

| | Spreadsheet | App |
| --- | --- | --- |
| Setup | Hours | Minutes |
| Flexibility | Any category, any rule | What the vendor built |
| Import | Manual or CSV | Usually automatic |
| Data ownership | The file is yours | The vendor's, under their terms |
| Export | Native | Check before committing |
| Longevity | Readable in 10 years | Depends on the company |
| Correctness risk | Your own formulas | Their logic, invisible to you |

Before committing to any app, export your data once and open the file. If the
export is unusable, or absent, you are renting your own history. Costs also
change, and a paid tracker you stop paying for should leave you with a CSV.

If the budget lives in a spreadsheet, treat it as a spreadsheet with money in
it: named ranges, exact-match lookups, and round where a number becomes
currency. See `../../office/excel-formulas/SKILL.md`; do not reinvent that
craft here.

## 11. When to stop tracking in detail

Detailed tracking is a diagnostic tool, not a lifestyle. Stop, or coarsen, when:

- The numbers have been stable for several months and the review changes
  nothing.
- Fixed costs and sinking funds are automated and the remainder is comfortably
  within income.
- The tracking itself has become the source of stress.

Coarsen rather than quit: keep the reconcile and the sinking funds, collapse
the variable categories into two or three. Return to detail when something
changes: a move, a new job, a new dependent, a debt payoff plan, or a category
that starts drifting.

## Anti-patterns

- Setting targets before tracking a full cycle. The targets are fiction and the
  first miss reads as personal failure.
- Budgeting irregular costs as zero and calling the renewal month a bad month.
- Categories so fine that filing requires a decision. Decisions get postponed,
  then skipped.
- A tracker never reconciled to a statement. It drifts silently and stays tidy.
- Planning irregular income on the average. The average month never arrives.
- Raiding a sinking fund without recording it, which hides the shortfall until
  the bill lands.
- Rolling a chronic overspend forward as debt to next month instead of
  re-planning the target.
- An app chosen without testing the export.
- Reviewing without changing a number.

## When to use this skill

Use it when a budget keeps being abandoned, when certain months look
inexplicably bad, when the tracker and the bank balance disagree, when income
varies month to month, or when you need to find where money is actually going
rather than where it was supposed to go.

Skip it for tax treatment, investment choices, debt-instrument comparison, or
business bookkeeping with multiple entities. Those are different problems with
different tools and, where the amounts matter, a qualified professional.

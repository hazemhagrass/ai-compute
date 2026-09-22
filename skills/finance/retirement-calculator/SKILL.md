---
name: retirement-calculator
description: Use when modelling a retirement projection. Fix real vs nominal, model sequence risk, output a range not a number.
---

This skill is about the *method* of building a retirement projection: which arithmetic is internally consistent, which model answers which question, and which outputs are honest. It does not tell anyone what to do with money, what to hold, when to stop working, or what any number ought to be. Those are decisions for the person whose money it is, with a qualified adviser if they want one. What follows is how to build a model that does not lie to them.

Every number here is the output of arithmetic run while writing this file, on assumptions invented for illustration. None of it is a historical return, a measured inflation rate, or a finding from any study. Assumptions in examples are labelled as assumptions wherever they appear.

## The working loop

1. **Declare the measurement unit first**: real (today's purchasing power) or nominal (future currency). Write it at the top of the model.
2. **Put every assumption in one labelled block**, with its unit, before any formula references it.
3. **Build the deterministic path first** so the mechanics are readable and hand-checkable.
4. **Then destroy the single path**: vary the return ordering and run stochastic paths. The single path is the least informative output the model can produce.
5. **Report a distribution and a failure probability**, never a point estimate.
6. **Run the sensitivity grid** and state which input actually moved the answer.
7. **Print the assumption block with the result**, always, in the same artifact.

## 1. Real vs nominal is the single biggest modelling error

Pick one unit and stay in it. Mixing them is not a rounding problem; it silently changes the answer by more than most of the decisions the model exists to inform.

The conversion is multiplicative, not subtractive:

```
real_return = (1 + nominal_return) / (1 + inflation) - 1
```

With an assumed 6% nominal return and 2.5% inflation, the exact real return is **3.4146%**. The subtraction shortcut gives 3.5000%. Compounded on 100,000 over 30 years, the exact figure gives **273,817** and the shortcut **280,679** -- the shortcut is **2.51% high** off a 0.09pp input error.

The destructive version is escalating spending with inflation *while* compounding the balance at a real return, which double-counts inflation. Assume 1,000,000 balance, 40,000 first-year withdrawal, 3.4146% real return, 30 years:

| Treatment | Balance after 30 years |
| --- | --- |
| Consistent real (flat 40,000 real withdrawal) | **632,502** |
| Inflation double-counted (withdrawal escalated 2.5%/yr against a real return) | **-159,052** |

Same intent, same inputs; one is solvent and one is bankrupt. Nothing in the spreadsheet flags it.

**Rules:**

- Label every currency row `(real, today's money)` or `(nominal)`. An unlabelled row will be misread by the next reader, usually you in six months.
- Prefer real for planning. Purchasing power is what a person experiences, and a real model needs no inflation assumption on the spending side.
- Use nominal only to tie to nominal external facts: a fixed-rate mortgage schedule, a nominal annuity, an unindexed tax bracket.
- If both are unavoidable, keep them on separate sheets and convert once, at a single documented cell, never inline.
- Never compare two projections built in different units. Convert one first.

## 2. Three model types, three different questions

They are not competing accuracies. Each answers a different question and is silent on the others.

**Deterministic projection.** One fixed return per year. Tells you what the arithmetic implies *if* the assumption holds exactly. Its output is a mechanism, not a forecast; it cannot express risk because it has none. Use it to verify plumbing and communicate structure.

**Monte Carlo.** Many paths drawn from an assumed return distribution. Tells you the spread of outcomes *that your distributional assumption implies* -- a restatement of your assumption in outcome space, not a prediction. Sensitive to the volatility input, to the assumed shape (a normal draw understates fat tails), and to whether draws are independent across years (real returns are not obviously so).

**Historical-sequence backtesting.** Replay actual past return orderings. Tells you how a rule would have behaved in the sequences that happened. The count of independent long retirements in any market's history is small, overlapping windows are not independent observations, and the future is not drawn from that sample. It is evidence about robustness to real-world ordering, not a probability.

Same inputs, different answers -- computed with an assumed 4.5% real return, 12% assumed volatility, 1,000,000 start, 45,000 flat real withdrawal, 30 years, 20,000 paths, fixed seed:

| Model | Output |
| --- | --- |
| Deterministic | Ends at **876,461**. Never fails. |
| Monte Carlo (same mean) | **28.4% of paths deplete.** p10 = 0, median **502,870**, p90 **2,701,219** |

Two models sharing a mean return disagree about whether the plan works at all. That gap is the whole reason volatility belongs in the model.

**Rules:**

- Never present a deterministic projection as a plan outcome. Present it as the mechanism, with the distribution beside it.
- State Monte Carlo assumptions with the result: mean, volatility, distribution shape, path count, seed, and any cross-year correlation.
- Never quote a Monte Carlo success rate to more than whole percentage points. The precision is an artifact of sample size, not knowledge.
- Never describe a backtest result as a probability of the future.
- Run all three when the stakes justify it. Agreement is weak evidence; disagreement tells you which assumption is carrying the answer.

## 3. Sequence-of-returns risk, computed

The same set of returns in a different order produces a different outcome once money is being withdrawn. Not slightly different. A different plan.

Assumed 25-year series: four weak years of -15%, -10%, -5%, +5%, then 21 years of +7%. Arithmetic mean **4.88%**, geometric mean **4.7093%**. Path A runs the weak years first; Path B is the identical list reversed. Start 1,000,000, flat 55,000 real withdrawal at the start of each year.

| Path | Return order | Outcome |
| --- | --- | --- |
| A | weak years first | **Depleted in year 21** |
| B | weak years last | **974,053 remaining at year 25** |

With no withdrawals, both paths end at exactly the same balance -- multiplication commutes. The divergence is created entirely by withdrawing from a shrunken balance: each unit taken in a down year removes a larger share of the portfolio and never participates in the later recovery.

**Rules:**

- Never evaluate a withdrawal plan on average return alone. The average is precisely the statistic sequence risk is invisible to.
- Test the reversed ordering as a standing check. It is free and it is the cheapest proof that ordering matters.
- Concentrate scenario attention on the early withdrawal years. Late bad years have a far smaller balance-weighted effect.
- Report the depletion year, not just the ending balance. A zero balance hides whether it happened in year 21 or year 3.

## 4. Withdrawal rules trade income stability against depletion risk

Every rule sits on one axis: how much the income may move versus how much the balance may be drained. None removes the tradeoff.

Computed on Path A (bad-first ordering), 1,000,000 start, 25 years, 45,000 initial withdrawal. Guardrails implemented as: cut spending 10% if the withdrawal exceeds 5.4% of the balance, raise 10% if it falls below 3.6%.

| Rule | Ending balance | Lowest year's income | Highest | Total withdrawn |
| --- | --- | --- | --- | --- |
| Fixed real | **308,396** | 45,000 | 45,000 | **1,125,000** |
| Percentage of balance (4.5%) | **999,351** | **28,484** | 45,000 | 892,349 |
| Guardrails | **991,620** | **32,805** | 45,000 | 850,221 |

Read it honestly: fixed real delivered the most total income and the most stable income, and left the smallest balance. The balance-linked rules protected the portfolio by transferring the shock to the person's spending. That is the tradeoff stated numerically -- not a ranking.

- **Fixed real**: constant purchasing power, zero income risk, highest depletion risk. Cannot respond to anything.
- **Percentage of balance**: cannot mathematically deplete, since the withdrawal is always a fraction of what remains. The income is as volatile as the portfolio; the low year above was 37% below the first year.
- **Guardrails**: bounded adjustments on thresholds. Income moves less than pure percentage-of-balance; depletion risk sits between the two. The thresholds and step sizes are arbitrary choices that drive the result and must be stated.

The **4% rule** is a widely discussed rule of thumb: an initial withdrawal of 4% of the balance, thereafter escalated with inflation. Know it by name because people will cite it at you. Known criticisms are in circulation and the reader should look them up rather than take a summary here: that it derives from one country's historical market data over a specific window, assumes a fixed retirement length, ignores fees and taxes, assumes mechanical adherence no real person exhibits, and that starting conditions may not resemble the sampled period. Treat it as a conversational reference point with contested standing, not a safe number. Do not restate the originating study's design or findings unless you have read it.

**Rules:**

- State the rule's parameters in full. "Guardrails" without thresholds is not a rule.
- Report both axes for every rule: the income path (min, max, variability) and the balance path (ending value, depletion probability).
- Never rank withdrawal rules. Show the tradeoff and let the reader weigh it.
- Model the rule as it would actually be followed, including whether anyone would keep withdrawing a fixed amount from a halved portfolio.

## 5. A point estimate is the wrong output

"You need 1,200,000" carries a precision no model can support. It hides the assumptions, cannot be falsified, and invites the reader to treat a modelling artifact as a fact.

Report instead, from the Monte Carlo above (assumed 4.5% mean, 12% volatility, 30 years, 20,000 paths, fixed seed):

- Failure probability at 45,000/yr: **28.4%**; at 40,000/yr: **18.3%**; at 50,000/yr: **41.1%**
- Surviving-path outcomes: p10 **0**, median **502,870**, p90 **2,701,219**

The p10-to-p90 spread covers an order of magnitude. Any single number drawn from it is a choice of which part of the distribution to show.

**Rules:**

- Lead with the failure probability and the percentile range, not a headline balance.
- Present the sensitivity of failure probability to withdrawal level, as above. The slope is more actionable than any single point on it.
- Never describe a failure probability as a probability about the world. It is a probability under the model's assumptions and should be sentenced that way.
- Never express results to a precision the assumptions cannot carry. Round.

## 6. Sensitivity analysis: find the input carrying the answer

Run one-at-a-time perturbations and rank by effect size. A model whose answer is driven by an unjustifiable return assumption is a model reporting its own assumption.

Computed on an accumulation baseline: 20,000 saved at the end of each year for 25 years at an assumed 4% real return, ending at **866,235**.

| Perturbation | Ending balance | Change |
| --- | --- | --- |
| Savings +10% (to 22,000/yr) | 952,858 | **+10.0%** |
| Return +10% relative (4.0% to 4.4%) | 917,939 | **+6.0%** |
| Years +3 (25 to 28) | 1,039,326 | **+20.0%** |
| Return +100bp (4.0% to 5.0%) | 1,002,269 | +15.7% |

Under these assumptions three extra contribution years moved the result twice as far as a proportionally equal return increase, and the savings rate passed through roughly one-for-one. That is a property of compounding on this baseline, not a universal law -- rerun it on the actual model, because the ranking shifts with horizon and starting balance.

**Rules:**

- Perturb by comparable *relative* amounts, not arbitrary absolute ones, or the ranking is an artifact of your step sizes.
- Rank inputs by effect size and say so in the output. "The answer is driven by the years-to-retirement assumption" beats any balance.
- Run two-way grids on the top two drivers only. Beyond two dimensions nobody reads it.
- If the largest driver is an assumption you cannot defend, say so prominently. That is the model's most important finding.

## 7. Irregular items break smooth-curve models

A projection built only from a savings rate and a return will be wrong in the specific years that matter most.

- **One-off costs** (roof, car, tuition, a wedding): dated line items in the cash flow row, not an uplift to average spending. Their timing interacts with sequence risk -- a large outflow in a down year does the damage a withdrawal does.
- **Mortgage payoff**: a step change in required spending at a known date. A fixed nominal payment *falls* in real terms every year, so the payment row is one of the few that legitimately belongs in nominal terms and must be deflated before joining a real model.
- **Phased retirement income**: part-time earnings, a pension starting at a set age, state benefits with their own indexation rule. Each gets its own dated row with its own escalation. Netting them into one number destroys the differing escalation.
- Anything that starts or stops on a date gets a date column and a flag row. Never bake a start date into a formula.

## 8. Longevity: planning to an average underestimates risk

Life expectancy is the centre of a distribution. A plan built to end at the expected age is designed to run out roughly when half the distribution is still alive, leaving the model silent about the entire upper half of the outcome space -- the half in which running out of money matters. For a couple it compounds: the money must typically last to the *later* of two deaths, a longer horizon than either individual's expectation.

The horizon effect is large. Under section 2's assumptions, extending 30 to 35 years raised modelled failure from **28.4% to 38.8%** -- five years moved failure by more than ten percentage points.

**Rules:**

- Plan to a high percentile of survival, not the median, and say which percentile you used.
- Use current actuarial tables for the relevant population and cite source and year. Do not use a remembered figure; life tables are published, dated, and specific.
- Model a couple's joint-last-survivor horizon explicitly.
- Show failure probability as a function of horizon length. It is one of the model's steepest sensitivities.

## 9. Healthcare and long-term care are the largest unmodelled risks

Stated generally, because specifics are jurisdictional and change: for many households the largest uncertainty in a retirement projection is health and long-term care cost, and it is the item most often omitted entirely. Its distribution is strongly right-skewed -- a majority of the cost falls on a minority of households -- so an average is a particularly misleading summary.

**Rules:**

- Model it as a separate, explicitly right-skewed item. Averaging it into general spending hides exactly the tail the model exists to find.
- State the jurisdiction and the public-provision assumption. A projection is not portable across countries or across a policy change.
- If you cannot source a cost distribution, say the item is unmodelled and name it as a known gap. An acknowledged gap is honest; a silent omission is not.
- Never quote a specific lifetime care cost without a dated, cited source.

## 10. Inflation is not one number

Categories inflate at different rates, and a retiree's basket is not the basket the headline index measures. A blended rate weighted to the actual basket can differ materially from the headline.

Illustration with invented weights and invented category rates -- housing 45% at 2.5%, food 15% at 3.0%, health care 15% at 5.0%, other 25% at 2.0% -- blends to **2.825%** against an assumed 2.5% headline. Applied to 50,000 of spending over 25 years: **100,332** versus **92,697**, a gap of **8.2%** on the same starting spend.

**Rules:**

- Weight inflation to the modelled basket when category rates differ materially, and cite a source for each category rate.
- Never source category inflation rates from memory. Publish the series name and date.
- Spending patterns shift over a retirement, so the weights are themselves time-varying. If you hold them fixed, say so.

## 11. Assumptions travel with every output

An output without its assumptions is not a result; it is a number that will be quoted back at you out of context.

Attach to every figure, in the same artifact: measurement unit (real or nominal); return assumption with its source or its status as an assumption; volatility and distribution shape; inflation assumption; horizon and the survival percentile it represents; the withdrawal rule with all parameters; tax and fee treatment or an explicit statement that they are excluded; the model type; and path count and seed for anything stochastic.

Add a line stating what the model does not include. For most projections that list contains long-term care, tax law changes, policy changes, and behavioural deviation from the modelled rule.

## Anti-patterns

- Escalating spending with inflation while compounding the balance at a real return.
- Subtracting inflation from nominal return instead of dividing.
- A single deterministic path presented as the plan outcome.
- A headline "you need X" with no range and no failure probability.
- A Monte Carlo success rate quoted to a decimal place.
- A backtest result described as a probability.
- Ranking withdrawal rules instead of showing the tradeoff each makes.
- A horizon set to life expectancy with no percentile stated.
- Health care averaged into general spending, erasing the right tail.
- Citing the 4% rule, or any historical return figure, from memory as established fact.
- Sensitivity run by perturbing inputs by unequal relative amounts, then ranking them.
- Any output that leaves the model without its assumption block attached.

## When to use this skill

Use it when building or reviewing a retirement or drawdown projection; when a projection reports one number; when spending and returns may be in mismatched units; when a withdrawal rule needs comparing against alternatives; or when someone needs to know which assumption their answer actually rests on.

Skip it for a single-line time-value-of-money calculation, and stop entirely where the question becomes what a specific person should do with their own money. That is advice, it is regulated in most jurisdictions, and it is not what a model produces.

## See also

- `skills/office/excel-financial-modeling/SKILL.md` -- inputs/calculations/outputs separation, roll-forward schedules, check rows, scenario selectors, sensitivity grids. Build the mechanics there; this skill covers only what is specific to retirement projection.
- `skills/research/truth-first/SKILL.md` -- sourcing rules for every return, inflation, and longevity figure that enters a model.
- `skills/data/data-visualization-principles/SKILL.md` -- choosing a chart form for a distribution of outcomes rather than a single line.

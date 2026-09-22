# Retirement Calculator

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="retirement-calculator robot" width="200">
</div>

A method skill for building a retirement projection that does not lie: pick real or nominal and stay in it, model sequence-of-returns risk instead of averaging it away, and report a failure probability and a range rather than a single headline number.

## What it does

This is educational content about modelling method. It is not financial advice, and it recommends no savings rate, withdrawal rate, allocation, or retirement age. Every figure in the skill is arithmetic run on assumptions invented for illustration, labelled as such.

- **Real vs nominal**: the multiplicative conversion, the cost of the subtraction shortcut, and the double-counted-inflation bug that turns a solvent plan into a bankrupt one with no warning in the sheet.
- **Three model types**: deterministic, Monte Carlo, and historical-sequence backtesting, each answering a different question and silent on the others.
- **Sequence-of-returns risk**: the same returns in a different order, one path depleted and one path solvent, and why the average return is the statistic that cannot see it.
- **Withdrawal rules**: fixed real, percentage of balance, and guardrails compared on both axes at once, income stability against depletion risk, with no ranking.
- **The 4% rule**: what it is, why people will cite it at you, and why it is a conversational reference point with contested standing rather than a safe number.
- **Output form**: failure probability and percentile range instead of "you need X", plus the slope of failure against withdrawal level.
- **Sensitivity analysis**: equal relative perturbations, ranked by effect size, to find which input is actually carrying the answer.
- **Irregular items**: one-off costs, mortgage payoff, and phased income as dated rows, not as an uplift to an average.
- **Longevity**: why planning to life expectancy designs for the half of the distribution that does not matter, and the joint-last-survivor horizon for couples.
- **Healthcare and long-term care**: the largest commonly unmodelled risk, right-skewed, where an average is the most misleading possible summary.
- **Inflation as a basket**: category rates weighted to the modelled spending, not one headline number.
- **Assumption blocks**: what must travel with every figure, and the explicit list of what the model excludes.

## When to use this

Concrete triggers:

- A projection reports a single number, such as "you need 1,200,000", with no range attached.
- Spending escalates with inflation in the same model where the balance compounds at a real return.
- Someone computed a real return by subtracting inflation from the nominal return.
- A withdrawal plan was evaluated on an average return, with no test of return ordering.
- Two projections built by different people are being compared and nobody checked whether both are in the same unit.
- A Monte Carlo success rate is being quoted to a decimal place, or a backtest result is being called a probability of the future.
- The horizon was set to life expectancy and no survival percentile was stated.
- Health care is folded into general spending as an average.
- A withdrawal rule needs comparing against alternatives and the comparison keeps turning into a ranking.
- You need to know which assumption the answer actually rests on before anyone acts on it.

Skip it when:

- The task is a single-line time-value-of-money calculation.
- The question has become what a specific person should do with their own money. That is advice, regulated in most jurisdictions, and not what a model produces.
- You need spreadsheet mechanics rather than retirement-specific method (see See also).

## Quick start

The shortest path from a raw projection to an honest one. Assumptions below are invented for illustration.

**Step 1: declare the unit at the top of the model**

```
Measurement unit: REAL (today's purchasing power)
Return assumption:      4.5% real     (assumption, not a measured figure)
Volatility assumption:  12%           (assumption)
Horizon:                30 years      (survival percentile: stated below)
Withdrawal rule:        45,000 flat real, start of year
```

**Step 2: convert correctly if a nominal figure enters**

```
real = (1 + nominal) / (1 + inflation) - 1
6% nominal, 2.5% inflation  ->  3.4146% real   (not 3.5%)
```

On 100,000 over 30 years the shortcut overstates the result by 2.51%, off a 0.09pp input error.

**Step 3: build the deterministic path, then refuse to ship it alone**

| Model | Output on the same inputs |
| --- | --- |
| Deterministic | ends at 876,461, never fails |
| Monte Carlo, same mean | 28.4% of paths deplete; p10 0, median 502,870, p90 2,701,219 |

Two models sharing a mean return disagree about whether the plan works at all.

**Step 4: reverse the return order as a standing check**

An assumed 25-year series of four weak years then 21 good ones, 1,000,000 start, 55,000 flat real withdrawal:

```
weak years first  ->  depleted in year 21
weak years last   ->  974,053 remaining at year 25
```

Identical returns, identical average. With no withdrawals both paths end equal, because multiplication commutes. The divergence is created entirely by withdrawing from a shrunken balance.

**Step 5: show the tradeoff, do not rank**

| Rule | Ending balance | Lowest year's income | Total withdrawn |
| --- | --- | --- | --- |
| Fixed real | 308,396 | 45,000 | 1,125,000 |
| Percentage of balance (4.5%) | 999,351 | 28,484 | 892,349 |
| Guardrails | 991,620 | 32,805 | 850,221 |

Fixed real delivered the most income and the most stable income, and left the smallest balance. The balance-linked rules protected the portfolio by moving the shock onto the person's spending. That is the tradeoff stated numerically.

**Step 6: report a range and a slope, not a number**

```
Failure probability at 40,000/yr   18.3%
                   at 45,000/yr   28.4%
                   at 50,000/yr   41.1%
```

**Step 7: rank the sensitivities by equal relative perturbation**

On an accumulation baseline of 20,000/yr for 25 years at 4% real (866,235):

```
Years +3           +20.0%
Savings +10%       +10.0%
Return +10% rel     +6.0%
```

Say which input is carrying the answer. If it is one you cannot defend, that is the model's most important finding.

**Step 8: attach the assumption block to the output**

Unit, return and its status, volatility and distribution shape, inflation, horizon with survival percentile, the withdrawal rule with every parameter, tax and fee treatment, model type, path count and seed. Plus a line naming what is not included.

## Key concepts

- **Measurement unit.** Real means today's purchasing power; nominal means future currency. Mixing them is not a rounding problem, it changes the answer by more than most decisions the model exists to inform.
- **Inflation double-counting.** Escalating spending with inflation while compounding the balance at a real return. The most destructive single bug in retirement models, and nothing in a spreadsheet flags it.
- **Deterministic projection.** One fixed return per year. Output is a mechanism, not a forecast. It cannot express risk because it has none.
- **Monte Carlo.** Many paths from an assumed return distribution. A restatement of your assumption in outcome space, sensitive to volatility, distribution shape, and cross-year independence.
- **Historical-sequence backtesting.** Replaying real past orderings. Evidence about robustness to real-world sequence, not a probability, because overlapping windows are not independent observations.
- **Sequence-of-returns risk.** Order dependence created by withdrawals. Each unit taken in a down year removes a larger share of the portfolio and never participates in the recovery.
- **Depletion year.** When the balance hit zero. An ending balance of zero hides whether that happened in year 21 or year 3.
- **Fixed real withdrawal.** Constant purchasing power, zero income risk, highest depletion risk, cannot respond to anything.
- **Percentage of balance.** Cannot mathematically deplete, since the withdrawal is always a fraction of what remains. Income is as volatile as the portfolio.
- **Guardrails.** Bounded adjustments on thresholds. The thresholds and step sizes are arbitrary choices that drive the result, so they must be stated.
- **Failure probability.** A probability under the model's assumptions, not a probability about the world, and never quoted to a decimal place.
- **Survival percentile.** The point in the longevity distribution the horizon is set to. Life expectancy is the middle, so a plan built to it goes quiet over the half of the outcome space where running out of money matters.
- **Joint-last-survivor horizon.** For a couple the money must last to the later of two deaths, longer than either individual expectation.
- **Blended inflation.** Category rates weighted to the modelled basket. A retiree's basket is not the basket the headline index measures.
- **Assumption block.** The labelled list of every input with its unit and source, printed in the same artifact as the result.

## Common pitfalls

**Subtracting inflation from the nominal return**

The conversion is `(1 + nominal) / (1 + inflation) - 1`. The shortcut looks close and compounds into a material overstatement over a retirement-length horizon.

**Escalating spending with inflation against a real return**

Inflation gets counted twice. Same intent and same inputs produce one solvent plan and one bankrupt one, with no error anywhere in the sheet.

**Comparing two projections built in different units**

Convert one first, at a single documented cell, never inline.

**Presenting the deterministic path as the plan outcome**

It never fails, by construction. Present it as the mechanism with the distribution beside it.

**Evaluating a withdrawal plan on average return**

The average is precisely the statistic sequence risk is invisible to. Reverse the ordering as a standing check; it costs nothing.

**Reporting a point estimate**

"You need 1,200,000" carries a precision no model can support, hides the assumptions, and cannot be falsified. Lead with the failure probability and the percentile range.

**Quoting a Monte Carlo success rate to a decimal place**

That precision is an artifact of sample size, not of knowledge. Round to whole percentage points.

**Calling a backtest result a probability of the future**

The count of independent long retirements in any market's history is small, and the future is not drawn from that sample.

**Ranking withdrawal rules**

Every rule trades income stability against depletion risk. Show both axes and let the reader weigh them.

**Modelling a rule nobody would follow**

Ask whether a real person would keep withdrawing a fixed amount from a halved portfolio. If not, the modelled rule is not the rule.

**Sensitivity run with unequal relative steps**

The ranking then reports your step sizes rather than the model. Perturb by comparable relative amounts, and keep two-way grids to the top two drivers.

**Smoothing irregular items into an average**

A roof, a tuition bill, or a mortgage payoff is a dated row with a start flag. Timing interacts with sequence risk: a large outflow in a down year does the damage a withdrawal does.

**Setting the horizon to life expectancy**

That designs the plan to run out around the point half the distribution is still alive. Use a high survival percentile and state which one, from a current dated life table rather than memory.

**Averaging health care into general spending**

The distribution is strongly right-skewed, so the average erases exactly the tail the model exists to find. If you cannot source a distribution, name the item as an unmodelled gap.

**Using one inflation number**

Weight category rates to the modelled basket, cite a series name and date for each, and say so if you hold the weights fixed over the horizon.

**Citing the 4% rule, or any return figure, from memory**

It derives from one country's historical data over a specific window and has known criticisms in circulation. Treat it as a reference point people will cite at you, not as a safe number.

**Shipping a figure without its assumption block**

An output without its assumptions is not a result, it is a number that will be quoted back at you out of context.

## See also

- [SKILL.md](SKILL.md) in this directory: the full method with the worked tables, rule by rule.
- [Excel financial modeling](../../office/excel-financial-modeling/SKILL.md): inputs/calculations/outputs separation, roll-forward schedules, check rows, and sensitivity grids. Build the mechanics there.
- [Truth first](../../research/truth-first/SKILL.md): sourcing rules for every return, inflation, and longevity figure that enters the model.
- [Data visualization principles](../../data/data-visualization-principles/SKILL.md): charting a distribution of outcomes rather than a single line.
- [Budget tracker](../budget-tracker/SKILL.md): the spending side, where the projection's withdrawal figure comes from.
- [Investment portfolio analyzer](../investment-portfolio-analyzer/SKILL.md): the return and volatility assumptions this model consumes.

# Investment Portfolio Analyzer

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="investment-portfolio-analyzer robot" width="200">
</div>

Measure what a portfolio actually returned, and what it actually cost, from your
own cash-flow ledger instead of a broker's summary screen.

This is an educational skill about **measurement method**. It is not financial
advice. It never recommends a security, an allocation, a fund, or an account type,
and it contains no jurisdiction's tax rates. Every number in the skill was produced
by executing the code it shows; recompute all of them on your own data.

## What it does

Broker screens report a single percentage and rarely say which one it is. That one
number hides the four things that decide whether a portfolio is doing what you
think:

- **Which return.** Time-weighted (how the strategy performed) and money-weighted
  (what you actually earned, given your contribution timing) are different
  questions. On the skill's worked example they differ by 22.35 percentage points.
- **What it cost.** An expense ratio quoted annually looks trivial. Compounded and
  expressed as a share of terminal value, 0.75% a year costs 19.02% of the ending
  balance over 30 years.
- **Whether it is diversified.** Diversification is the correlation matrix, not the
  ticker count. Two holdings at rho 0.9 barely reduce dispersion below one holding.
- **What the risk numbers omit.** Standard deviation and max drawdown are sample
  statistics from one realized path, not bounds.

The skill walks a seven-step loop: assemble the ledger, compute both returns,
convert to total return, compound the costs, measure concentration and correlation,
measure dispersion and drawdown, then pick the benchmark -- before looking at the
result.

## When to use this

Use it when:

- A return figure has to be defensible to someone else.
- Contributions or withdrawals make a simple start-to-end percentage misleading.
- You are comparing your own performance against an index.
- Costs or concentration need to be quantified rather than asserted.
- A figure came out of a backtest and someone intends to act on it.

Skip it when you have no cash-flow history to compute from. Compute nothing and go
assemble the ledger first -- every method here takes dated, signed flows as input.

## Quick start

1. **Build the ledger.** Dated, signed, single currency. Money *into* the portfolio
   is negative, money *out* -- including the terminal market value as a final
   entry -- is positive. Getting this backwards flips the sign of the answer.

2. **Compute money-weighted return (XIRR).** The skill gives a bisection
   implementation that stays robust where Newton's method diverges on sign-flipping
   flow series. On its example ledger it returns 6.1804%, against a naive
   contributions-vs-value ratio of 22.07% -- the naive figure ignores how long each
   contribution was actually deployed.

3. **Sanity-check the root.** Confirm `xnpv(rate, flows)` is near zero. A series
   with several sign changes can admit more than one mathematically valid rate.

4. **Compute time-weighted return separately** if you plan to compare against an
   index. Chain sub-period returns across your own flow dates.

5. **Sum every cost layer into one annual figure** -- fund expense ratio,
   platform or wrapper fee, advisory fee, commissions, bid/ask spread, and
   currency conversion -- then compound it over your horizon before quoting it.

6. **Measure concentration** from the holdings table: top-N weight, sector and
   geography with look-through into funds, single-issuer weight aggregated across
   every vehicle, employer stock, and the Herfindahl index (its reciprocal is the
   effective number of positions, usually far below the raw count).

7. **Choose and justify the benchmark before seeing the result.** Match the
   universe, the risk profile, the basis (total return vs total return, same
   currency, same fee treatment), and the period including the start date.

## Key concepts

**TWR vs MWR.** An index is a time-weighted series with no external cash flows. Your
XIRR is contaminated by your own contribution timing. Comparing XIRR to an index
tells you whether you added money before an up or down move, not whether your
holdings performed. Use TWR against an index; use XIRR against your own goal.

**Fees compound against the balance.** The cost is a fraction of the *compounded*
balance, so it grows with both rate and time. This survives any gross-return
assumption you choose.

**Tax drag behaves like a fee.** A taxed distribution or realized gain removes
currency from the compounding base. Model it as an extra annual drag through the
same loop. Look up your own rates from a primary source -- no tool should supply
them.

**Sequence of returns.** With no cash flows, return order is irrelevant because
multiplication commutes. With flows it is decisive: the skill's five-return series
run forward and backward gives identical no-flow terminal values but a 15,460.63
difference once a fixed withdrawal runs alongside. Any projection built on a single
average return assumes this away.

## Common pitfalls

**Reporting one return figure without naming the method**

- Bad: "The portfolio returned 22.07% last year."
- Good: "Time-weighted 6.18%; money-weighted 22.07%, inflated by a large
  contribution made before the rally."
- Reason: the two answer different questions, and the gap between them on the
  worked example is 22.35 percentage points. An unlabelled number is unusable.

**Benchmarking an XIRR against an index**

- Bad: XIRR 6.18% vs index 9.1%, concluding the holdings underperformed.
- Good: compare time-weighted return against the index; compare XIRR against
  your own funding goal.
- Reason: an index has no external cash flows, so it is a time-weighted series.
  Your XIRR carries your contribution timing, which the index cannot have.

**Using a price series where total return was needed**

- Bad: measuring against the price level of an index.
- Good: measuring against the total-return version, same currency, same fee
  treatment.
- Reason: a price series omits dividends, distributions, and interest whether
  or not you reinvest them, so the comparison is biased against your portfolio.

**Quoting an expense ratio annually and never compounding it**

- Bad: "It is only 0.75% a year."
- Good: "0.75% a year is 19.02% of terminal value over 30 years."
- Reason: the fee is charged against the compounded balance, so its cost grows
  with both the rate and the horizon.

**Counting holdings as a diversification measure**

- Bad: "40 positions, so it is diversified."
- Good: the correlation matrix, single-issuer weight aggregated across every
  vehicle, and the reciprocal Herfindahl as the effective number of positions.
- Reason: two holdings correlated at rho 0.9 barely reduce dispersion versus
  one. Overlapping funds can hold the same issuer several times over.

**Anchoring on purchase price**

- Bad: holding a position until it "gets back to what I paid".
- Good: judging the position on whether it fits the portfolio today.
- Reason: the market does not know your cost basis; the price you paid is not
  an input to the decision in front of you.

**Presenting a backtest without the variant count**

- Bad: "This rule returned 14% annually in the simulation."
- Good: the same figure, plus how many rules were tried before this one.
- Reason: the best of many variants on one history is a selection effect. See
  `references/backtest-integrity.md`.

Also worth avoiding: dropping a cash distribution from the ledger because it
"left the account"; treating a broker's gain/loss column as a return;
performance chasing, which selects on the trailing window rather than on the
strategy; and inferring fund overlap from fund names instead of joining the
published holdings files on a security identifier.

## See also

- `skills/research/truth-first` -- claim discipline for the write-up.
- `skills/data/python-pandas-analysis` -- dataframe mechanics: dtypes, merge
  validation, money as integer minor units, shape assertions. Follow those rather
  than reinventing them here.
- `skills/finance/budget-tracker` -- the cash-flow side.
- `skills/finance/retirement-calculator` -- long-horizon projection, where
  sequence-of-returns risk matters most.

## Bundled files

- `SKILL.md` -- the method: eleven numbered sections and the working loop.
- `references/costs-and-taxes.md` -- account types, asset location, turnover
  policy, and costing a rebalancing rule against your own trade history.
- `references/backtest-integrity.md` -- survivorship, overfitting, look-ahead,
  and cost omission; read before quoting any simulated figure.

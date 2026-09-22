---
name: investment-portfolio-analyzer
description: Use when analyzing a portfolio's return and risk. Compute time-weighted vs money-weighted return, fee drag, concentration, and drawdown from your own data instead of trusting a broker summary screen.
---

This is an educational skill about measurement method. It is not financial advice,
and it never recommends a security, an allocation, a fund, or an account. Every
figure in this file came from executing the code shown on illustrative inputs, not
from a remembered study. The method is the point; recompute everything on your data.

Claim discipline for the write-up lives in `skills/research/truth-first`. The
dataframe mechanics (dtypes, merge validation, money as integer minor units, shape
assertions) live in `skills/data/python-pandas-analysis`; follow them, do not
restate them.

## The working loop

1. **Assemble the cash-flow ledger first.** Dated, signed, in one currency.
2. **Compute both returns.** Time-weighted and money-weighted answer different questions.
3. **Convert everything to total return.** Price-only series understate income.
4. **Compute costs as cumulative currency, not as an annual percentage.**
5. **Measure concentration and correlation.** Not the count of tickers.
6. **Measure dispersion and drawdown.** Then state what they do not tell you.
7. **Pick the benchmark before you look at the result**, and write down why.

## 1. Time-weighted vs money-weighted return

They answer two different questions and they are not interchangeable.

- **Time-weighted return (TWR)** removes the effect of when money arrived. It
  chains sub-period returns across every external cash flow. It answers: how did
  the strategy perform per unit of money exposed?
- **Money-weighted return (MWR, computed as IRR or XIRR)** is the discount rate
  that sets the net present value of the dated cash flows to zero. It answers:
  what did *this investor* actually earn, given the amounts they had in at each moment?

```python
from datetime import date

def xnpv(rate, flows):
    t0 = flows[0][0]
    return sum(a / (1.0 + rate) ** ((d - t0).days / 365.0) for d, a in flows)

def xirr(flows, lo=-0.9999, hi=10.0):
    # Bisection. Robust where Newton diverges on sign-flipping flow series.
    for _ in range(300):
        mid = (lo + hi) / 2
        if xnpv(mid, flows) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
```

Sign convention: money *into* the portfolio is negative, money *out* (including the
terminal market value) is positive. Get this backwards and the sign flips.

### The divergence is not small

A two-period toy portfolio, each period six months: period one returns +20%, period
two returns -10%. Start with 10,000, then add 90,000 immediately before the losing
period. Printed output of the code above on that flow series:

```
TWR two-period:        8.0 %
value end p1:  12000.0   after add: 102000.0   end p2: 91800.0
MWR (XIRR):          -14.3516 %
gap:                  22.3516 percentage points
```

The strategy was up 8%; the investor was down 14.4%, because most of their money
was only present for the drawdown. Neither is wrong. They answer different questions.

### The common error

Comparing your money-weighted personal return against an index return. An index is
a time-weighted series with no external cash flows. Your XIRR is contaminated by
your contribution timing, so that comparison tells you whether you happened to add
money before an up or down move, not whether your holdings performed.

- **To compare against an index:** use TWR, chained across your own flow dates.
- **To judge your own outcome in currency:** use XIRR, against your own goal only.

### XIRR on a real, irregular series

```python
series = [(date(2021, 3, 1),  -5000.0),
          (date(2021, 9, 15), -2500.0),
          (date(2022, 6, 1),  -3000.0),
          (date(2023, 2, 10),  1200.0),   # a withdrawal
          (date(2024, 11, 20), -4000.0),
          (date(2026, 1, 5),  16500.0)]   # terminal market value, as a final inflow
```

Running `xirr(series)` prints `6.1804 %`, and `xnpv` at that rate is `0.0`.
Contributions totalled 14,500 and value returned 17,700, a simple ratio of
`22.069 %`. Reporting 22% as "my return" would be meaningless: it ignores that the
money was deployed over different lengths of time. Always check `xnpv(r, flows)`
is near zero before trusting a root; a flow series with several sign changes can
admit more than one mathematically valid rate.

## 2. Total return, not price return

A price series omits dividends, distributions, and interest. Whether you reinvest
them or spend them, they are part of the return and must appear in the ledger.

- If you reinvest: use an adjusted/total-return series, or model the reinvestment
  as a zero-net-flow buy on the distribution date.
- If you take the cash: it is a positive dated flow in your XIRR series. Do not
  drop it because it "left the account".
- Never compare your total return against a benchmark's price return. Construct
  both on the same basis or the comparison is rigged before you start.

## 3. Fees compound: express them as cumulative cost

An expense ratio quoted per year is easy to dismiss. Compound it over the holding
period and state it as a share of terminal value. Compute it, do not assert it:

```python
gross = 0.07   # your own assumption, not a forecast
for er in (0.0003, 0.0020, 0.0075, 0.0100):
    for yrs in (10, 30):
        a = (1 + gross) ** yrs
        b = (1 + gross - er) ** yrs
        print(f"ER {er*100:.2f}% over {yrs}y: cost {(1 - b/a)*100:.2f}% of terminal")
```

Printed output from that exact loop (10y / 30y cost as a share of terminal value):

```
ER 0.03%:  0.28% /  0.84%      ER 0.75%:  6.79% / 19.02%
ER 0.20%:  1.85% /  5.46%      ER 1.00%:  8.96% / 24.55%
```

The 7% gross figure is an input you chose, not a prediction. Re-run it with your own
assumption and horizon. The structural point survives any input: the cost is a
fraction of the *compounded* balance, so it grows with both rate and time.

Include every layer you actually pay: fund expense ratio, platform or wrapper fee,
advisory fee, commissions, bid/ask spread, currency conversion. Sum them into one
annual figure before compounding, or you understate the total.

## 4. Tax drag and account type

A taxed distribution or realized gain removes currency from the compounding base,
so its cost compounds exactly like a fee. Model it as an extra annual drag and run
it through the loop in section 3. Tax rules are jurisdiction-specific and change;
this skill encodes no country's rules, and neither should your analysis without a
primary source for your own. Look up your own rates.

See `references/costs-and-taxes.md` when choosing between account types, comparing
a taxable holding against a sheltered one, or setting a turnover policy.

## 5. Diversification is correlation, not count

Holding thirty funds is not diversification if they move together. The quantity
that matters is the correlation matrix, and portfolio variance is
`w' * Cov * w`, not an average of the parts.

```python
import numpy as np
w = np.array([0.5, 0.5])
s = np.array([0.18, 0.18])           # each holding's sd, your own estimate
for rho in (1.0, 0.9, 0.5, 0.0, -0.5):
    C = np.array([[1.0, rho], [rho, 1.0]])
    port = float(np.sqrt(w @ (np.outer(s, s) * C) @ w))
    print(f"rho {rho:+.1f}: portfolio sd {port*100:.4f}%")
```

Printed output, two equally weighted holdings each at 18% sd:

```
rho +1.0: 18.0000%   rho +0.5: 15.5885%   rho -0.5:  9.0000%
rho +0.9: 17.5442%   rho +0.0: 12.7279%
```

Two holdings at rho 0.9 give you almost nothing that one holding did not. The
count went up; the dispersion barely moved.

**Overlap is the practical version of this.** Broad index funds from different
providers frequently hold the same large constituents at similar weights, so two
such funds can look like diversification on a statement and behave like one
position. Check it directly: pull each fund's published holdings file, join on the
security identifier, and compute the overlapping weight. Never infer overlap from
the fund names.

Correlations are estimated from a sample window, are not stable, and commonly rise
in stressed periods -- precisely when the diversification was supposed to help.
Report the window you measured over.

## 6. Concentration measurement

Compute these directly from your holdings table:

- **Top-N weight.** Share of portfolio value in the largest 1, 5, and 10 positions.
- **Sector and geography weight.** Including look-through into funds, not just the
  fund's own label.
- **Single-issuer weight**, aggregated across every vehicle that holds it. A direct
  stock position plus the same name inside three index funds is one exposure.
- **Employer stock.** Treat it as a special case: your salary, your benefits, and
  that position share a single point of failure. Measure the combined exposure;
  whether that is acceptable is your decision, not this skill's.
- **Herfindahl index** (`sum of w_i squared`) as a single summary number. Its
  reciprocal gives the "effective number of positions", which is usually far below
  the raw count.

## 7. Rebalancing

Three mechanical policies: **calendar** (fixed schedule regardless of drift),
**threshold** (trade when a weight drifts outside a band), and **hybrid** (check
on a schedule, trade only if a band is breached). Each costs spread, commission,
and -- in a taxable account -- realized gains.

Do not accept a general claim that one policy beats the other; that claim is
horizon-, cost-, and tax-dependent. See `references/costs-and-taxes.md` to cost
your own policy against your own trade history.

## 8. Benchmark selection

Choose the benchmark before you see the result, and write down the justification.

- Match the universe. A global portfolio measured against a single-country index is
  not being measured.
- Match the risk. A benchmark with a different volatility profile flatters or
  punishes for reasons unrelated to skill.
- Match the basis. Total return vs total return, same currency, same fee treatment.
- Match the period, including the start date. A start date chosen after the fact is
  the easiest way to manufacture outperformance.

A wrong benchmark flatters by construction, and it is the least visible error in any
performance report because it looks like rigor.

## 9. Backtest integrity

A historical simulation is quotable only with four disclosures: the dataset's
survivorship treatment, the number of rule variants tried, the decision-time data
cutoff, and the per-trade cost assumed. Missing any one, report the method and
withhold the number. See `references/backtest-integrity.md` when any figure comes
from simulation rather than from your own executed cash flows.

## 10. Volatility, drawdown, and what they do not say

```python
sd = float(np.std(returns, ddof=1))   # ddof=1: sample, not population

def maxdd(seq):                       # on the equity curve, not the returns
    v = peak = 1.0; dd = 0.0
    for r in seq:
        v *= (1 + r); peak = max(peak, v); dd = min(dd, v / peak - 1)
    return dd
```

On the five-return series `[0.20, 0.10, 0.05, -0.15, -0.05]` the sample standard
deviation prints `13.5093 %` and `maxdd` prints `-19.25 %`.

What these do **not** tell you: standard deviation treats upside and downside
dispersion identically, assumes the dispersion measured in your window is
representative, and says nothing about tail shape. Max drawdown is a single realized
path, not a bound; it is the worst thing that *did* happen in your sample, not the
worst that can. Neither measures permanent loss of capital, liquidity risk,
counterparty risk, or the risk that you abandon the plan at the bottom.

## 11. Sequence-of-returns risk

With no cash flows, return order is irrelevant: multiplication commutes. With flows,
order is decisive. The same five returns in forward and reverse order:

```
no-flow terminal            A: 1.119195    B: 1.119195
withdraw 10k/yr from 100k   A: 66539.13    B: 51078.50
```

Identical returns, reversed order, and a 15,460.63 difference once a fixed
withdrawal runs alongside. Bad returns early, while withdrawals shrink the base,
cannot be recovered by equally good returns later. The mirror case applies to
contributions. Any projection using a single average return assumes this away.

## Anti-patterns

- Reporting one return figure without saying whether it is TWR or MWR.
- Benchmarking an XIRR against an index.
- Using a price series where a total-return series was needed.
- Quoting an expense ratio annually and never compounding it.
- Counting holdings as a diversification measure.
- Treating a broker's "gain/loss" column as a return.
- Anchoring on purchase price: the price you paid is not an input to whether a
  holding fits the portfolio today. The market does not know your cost basis.
- Performance chasing: selecting on trailing return, which selects on the window.
- Selling winners and keeping losers to avoid realizing a loss on paper.
- Presenting a backtest without the number of variants tried.

## When to use this skill

Use it when a return figure needs to be defensible, when contributions or
withdrawals make a simple percentage misleading, when costs or concentration need
to be quantified rather than asserted, or when someone else will act on the output.
Skip it when you have no cash-flow history to compute from -- compute nothing, go
assemble the ledger first.

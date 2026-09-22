# Cost drag: taxes and rebalancing

Open this when deciding a turnover or rebalancing policy, or when comparing a
taxable holding against a sheltered one. It extends section 3 of SKILL.md, which
already covers compounding an explicit fee.

## Tax drag, stated generally

Tax rules are jurisdiction-specific and change. This skill encodes no country's
rules, and neither should your analysis without a primary source for your own.

What is general:

- A taxed distribution or realized gain removes currency from the compounding
  base, so its cost compounds exactly like a fee. Model it as an extra annual
  drag and run it through the same loop as section 3 of SKILL.md.
- Turnover drives realized gains. Two strategies with the same gross return do
  not deliver the same after-tax return in a taxable account if turnover differs.
- Tax-advantaged account types exist in most jurisdictions. Asset location
  (which holding sits in which account type) is a real variable.
- Compare after-tax or not at all. A pre-tax comparison between a taxable and a
  sheltered holding is not a comparison.

Look up your own rates. Do not let any tool, including this one, supply them.

## Rebalancing: threshold vs calendar

Two mechanical policies, each with a real cost:

- **Calendar.** Rebalance on a fixed schedule regardless of drift. Simple, easy
  to automate, trades even when drift is trivial.
- **Threshold.** Rebalance when a weight drifts more than a set band (absolute
  or relative) from target. Trades less in calm periods, more in volatile ones.
- **Hybrid.** Check on a schedule, trade only if a band is breached. This is the
  common compromise.

The tradeoff is explicit: rebalancing costs spread, commission, and (in a
taxable account) realized gains. Estimate the cost of your own policy by
counting the trades your rules would have generated over your own history and
applying your own actual per-trade cost.

Do not accept a general claim that one policy beats the other. That claim is
horizon-dependent, cost-dependent, and tax-dependent.

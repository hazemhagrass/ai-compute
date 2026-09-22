# Backtest integrity

Open this when a number comes from historical simulation rather than from your
own executed cash flows, or when a dataset of instruments is the input to any
statistic you plan to report.

## Survivorship bias

A dataset containing only instruments that still exist today has silently
deleted the failures. Any statistic computed from it is biased upward. Confirm
your source includes delisted and merged entities before reporting a number.

## Overfitting

Every parameter you tune against the same history buys in-sample fit and buys
nothing out of sample. Trying many rules and reporting the best one is not
evidence. Report how many variants you tried, alongside the result.

## Look-ahead bias

Using data that was not available at the decision timestamp, including restated
fundamentals and index membership known only later. Timestamp every input by
when it was *knowable*, not by the period it describes.

## Cost omission

A backtest with no spread, commission, or tax is measuring a strategy nobody can
execute. Apply the cost model from `references/costs-and-taxes.md` to the trade
count the rules actually generate.

## Reporting rule

A backtest result is quotable only with: the dataset's survivorship treatment,
the number of variants tried, the decision-time data cutoff, and the per-trade
cost assumed. Missing any one of those, report the method and withhold the number.

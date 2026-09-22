# Research Data Analysis

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="research-data-analysis robot" width="200">
</div>

Analysing research data so the conclusion survives scrutiny: plan the analysis
before seeing outcomes, report effect sizes rather than p-values, and make the
headline number reproducible from raw data.

## What it does

Governs the statistical *reasoning* layer of a data analysis: writing an
analysis plan before looking, labelling confirmatory vs exploratory work,
avoiding p-hacking / forking paths / HARKing, correcting for multiple
comparisons, leading with effect sizes and confidence intervals, checking test
assumptions and switching to robust or rank-based alternatives when they fail,
deciding outlier and missing-data handling in advance, computing power before
collection, and running a seeded, version-pinned pipeline that regenerates the
paper's numbers from raw immutable data. It deliberately does not teach
dataframe mechanics or chart selection; see `See also`.

## When to use this

- You are about to run a statistical test on a research dataset and the test
  was not written down before you saw the outcome.
- A result looks "significant" and you are deciding what to claim from it.
- You have many outcomes, subgroups or model variants and need a correction.
- A reviewer or stakeholder will ask "could someone else reproduce this?"
- Results appear unstable: a small analysis change flips the sign or story.
- You are supporting someone whose analysis is under fire and need to audit
  the reasoning, not just the code.

For dataframe wrangling bugs or silent data corruption, load
`data/python-pandas-analysis` instead. For choosing a chart type, use
`data/data-visualization-principles`.

## Quick start

A real 20-test noise walk-through, runnable today. Requires numpy, scipy,
pandas, statsmodels (for the FDR correction; versions used here: numpy 2.5.3,
scipy 1.18.1, pandas 3.0.6, statsmodels 0.15.0).

```python
import numpy as np
from scipy import stats
from statsmodels.stats.multitest import multipletests

rng = np.random.default_rng(20260922)          # seed on purpose
n_studies, n_tests, n_per_group = 10000, 20, 30
sigma = 10.0

# 20 hypotheses per study, both arms drawn from N(0, sigma). Null is TRUE.
noise = rng.normal(0.0, sigma, (n_studies, n_tests, 2, n_per_group))
pvals = stats.ttest_ind(noise[..., 0, :], noise[..., 1, :], axis=-1).pvalue

raw_hit    = (pvals < 0.05).any(axis=1)
bonf_p     = (pvals * n_tests).min(axis=1)                 # Bonferroni per study
bonf_hit   = bonf_p < 0.05
bh_reject  = np.array([                                    # FDR per study
    multipletests(study_p, alpha=0.05, method='fdr_bh')[0]
    for study_p in pvals
])
bh_hit     = bh_reject.any(axis=1)

print(f"studies with >=1 raw p<0.05      : {raw_hit.mean():.1%}")
print(f"studies with >=1 Bonferroni hit  : {bonf_hit.mean():.1%}")
print(f"studies with >=1 BH-rejected hyp : {bh_hit.mean():.1%}")
```

Actual output of this exact code:

```
studies with >=1 raw p<0.05      : 64.6%
studies with >=1 Bonferroni hit  : 4.5%
studies with >=1 BH-rejected hyp : 4.6%
```

Roughly two-thirds of "studies" on pure noise produced at least one
"significant" result. Bonferroni or BH on the *family* brings it back to the
nominal 5% (4.5% / 4.6% above). This is the whole argument for the plan-first /
correct-the-family workflow in one screen of code.

## Key concepts

- **Analysis plan before outcomes**: hypotheses, primary outcome, alpha,
  correction, exclusion / outlier / missing-data rules, written down while
  still blind. Deciding any of these after seeing results is a second lottery
  ticket against the null.
- **Confirmatory vs exploratory**: one pre-specified test on the full sample
  supports a claim; everything else generates hypotheses for the *next*
  dataset. Label which is which in every output.
- **Forking paths**: 24 plausible analyst choices on a null dataset reached
  p<0.05 on some path in 26.5% of simulations. Hacking is optional; the paths
  are not.
- **Multiple comparisons**: family-wise (Bonferroni) vs false-discovery-rate
  (Benjamini-Hochberg). Choose by what "false positive" means in your context,
  then name the correction in the plan.
- **Effect size first**: p is a function of n. n=50,000/group turns a 0.02 SD
  difference into p=0.0017. Report d and 95% CI [0.0074, 0.0322] as the story;
  p is bookkeeping for the correction step.
- **What p is not**: the null's probability, "chance", or the size of the
  effect.
- **Assumptions**: heavy tails wreck *power* more than type-I error (t detected
  a true shift in Cauchy-tailed data only 20.4% of the time while
  Mann-Whitney found it 87.6%). Unequal n and unequal sd can push pooled t to
  29% type-I error; Welch holds ~5%. Default to Welch.
- **Missing data**: MCAR / MAR / MNAR decide the remedy. Mean imputation
  crushed a clean regression slope from 0.497 to 0.125 in simulation; MNAR
  hiding the large y values biased it to 0.42. No default fixes MNAR.
- **Reproducibility**: immutable raw input, scripted transformation, seeded
  randomness, pinned dependency versions, generated - not hand-pasted -
  outputs.

## Common pitfalls

Bad: running 20 outcomes, spotting that outcome 7 is p=0.035, and reporting it.
Good: planning 1 primary outcome plus a named correction for the secondaries;
reporting outcome 7 only as exploratory, with the caveat attached.
Why: on pure noise, 20 tests produce at least one p<0.05 in ~64% of studies
(demonstrated above); a raw hit at 5%-family alpha is 13x likelier to be noise
than a planned, corrected one.

Bad: dropping two extreme observations after seeing that p>=0.05, then
reporting the smaller p.
Good: stating the outlier rule (metric, threshold, action, max count) in the
plan, applying it mechanically, listing every deletion, and (on doubt) running
a robust alternative like the median or trimmed mean alongside.
Why: simulated, post hoc deletion of 2 points lifted the false-positive rate
from 5.1% to 16.3%; an honest stated rule keeps it at 5.1%.
Related: with 999 lognormal observations plus one extreme value, the mean was
5021.6 and the median 19.4 - reporting the mean here is the outlier rule
deciding itself, badly.

Bad: `df = df.dropna()` everywhere and calling it handled.
Good: name the mechanism (MCAR / MAR / MNAR), justify it, and impute /
model / scope the claim accordingly.
Why: MCAR deletion is unbiased but wasteful; MAR deletion and *any* naive mean
imputation are biased (slope 0.497 -> 0.125 above); MNAR isn't fixable by
either and needs a sensitivity analysis or an honest scope limit.

Bad: reporting "power was 80%" after seeing the results.
Good: `TTestIndPower().solve_power()` before collection (d=0.5, alpha=0.05,
power=0.80 -> n=64/group), and never a post hoc power number.
Why: post hoc power is a function of the p-value you already got; it adds no
information and launders an underpowered design.

Bad: quoting p=0.0017 (n=50,000/group) as "a meaningful difference".
Good: headline the effect size and its CI (d=0.0198, 95% CI [0.0074, 0.0322])
and let a reader judge whether a 0.02 SD shift matters in their units.
Why: p measures evidence against the null, not importance; with enough n the
null always loses.

Bad: a "reproducible" notebook whose output was pasted into the paper and whose
randomness was unseeded.
Good: raw data stays read-only, transformation runs from a script, seeds are
fixed (`np.random.default_rng(SEED)`), pinned versions in `requirements.txt`
or a lockfile, and the outputs are regenerated from raw by a single command.
Why: reproducibility is what lets a skeptic (or you, in six months) tell a
fabricated or quietly-edited number from a computed one.

## See also

- `skills/data/python-pandas-analysis` - dataframe mechanics, dtype traps,
  silent corruption to avoid while implementing the plan.
- `skills/data/data-visualization-principles` - which chart carries which
  message once the statistics are settled.
- `skills/research/truth-first` - verifying a surprising empirical claim
  against external sources before treating it as fact.
- `skills/research/literature-review` - situating the finding against prior
  work before claiming novelty.
- `skills/engineering/test-strategy` - the broader software analogue:
  deciding what to test before looking at outputs.

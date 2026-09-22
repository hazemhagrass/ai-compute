---
name: research-data-analysis
description: Use when analysing research data or testing a hypothesis. Plan the analysis before looking at outcomes, so the conclusion survives scrutiny.
---

# Research Data Analysis

Your job here is the *reasoning* that turns data into a defensible claim: which
test, whether its assumptions hold, what the result means and does not mean,
and whether a skeptical reader could reproduce the number in the paper. If a
question has a throwaway answer, the conclusion it produces is a throwaway too.

Scope boundaries (do not duplicate, cross-reference instead):

- Dataframe mechanics, joins, dtype drift, chained-assignment corruption:
  `skills/data/python-pandas-analysis`.
- Which chart form fits which question: `skills/data/data-visualization-principles`.
- Verifying sensational or surprising claims against sources:
  `skills/research/truth-first`.

## 1. Plan first, look after

Write the analysis plan *before* touching the outcome data: hypotheses and their
directions, the primary outcome and at most a few secondaries, the test for each,
the alpha, the multiple-comparison correction, the exclusion rules, the missing-
data rule, the outlier rule, the sample size. Why: every analysis decision made
after seeing the results is a second chance to manufacture a false positive, even
when everyone involved is honest. Simulation shows how cheaply this happens:

- Twenty independent t-tests on pure noise (null true, n=30/group, one
  simulation, seed 20260922) produced one p-value of 0.035: a "finding" in data
  that contains nothing.
- A null dataset with 2 outcomes x 3 subgroups x 2 covariate choices (24
  analysis paths) reached p<0.05 on some path in **26.5%** of 20,000 runs.
- Optional stopping (peek at p every 5 subjects until it dips below 0.05, cap
  n=50/group) gave a false positive rate of **16.8%** versus 5.0% for the same
  total n analysed once.
- When p>=0.05, deleting up to 2 "outliers" (the most extreme points, chosen
  afterward) pushed the result under 0.05 in **11.3%** more of 20,000 null runs
  (honest 5.1% vs 16.3% with post hoc deletion).

So: plan in writing, freeze decisions, save the plan next to the data, and treat
any deviation as a documented change, not a silent one.

## 2. Confirmatory vs exploratory, and label which is which

- **Confirmatory**: one pre-specified test of one pre-specified hypothesis on
  the final data. Only this supports a strong claim.
- **Exploratory**: pattern hunting, subgroup medians, everything-but-the-plan.
  Legitimate and often the most valuable part of a first-pass analysis, but its
  output is *hypotheses for the next study*, never "we found that X causes Y".

Split outputs into two sections (`analyses_primary.md` / `analyses_explore.md`)
with no shared rows, and label every reported number in text. Labeling matters
most under time pressure: when a stakeholder asks "so is it significant?", the
correct exploratory answer is "this is exploratory; ask again with the next
sample." For a claim being written up, see preregistration (section 8).

## 3. p-hacking, forking paths, HARKing

Three named failure modes, all variants of one move: making analysis decisions
using the outcome.

- **p-hacking**: trying analyses until p crosses 0.05 (stopping rules, outlier
  trims, test switches, subgroup splits). The optional-stopping and outlier
  simulations above are p-hacking with a clean conscience.
- **Garden of forking paths** (Gelman): not deliberate hacking. Reasonable
  choices (which covariates, which subgroups, which exclusion window) made one
  at a time after peeking at results multiply into dozens of effective tests.
  Even one honest analyst exploring without correction can find a p<0.05 in a
  null dataset ~1 time in 4 with only the modest path count shown above.
- **HARKing**: HYPothesising After the Results are Known, then writing up a
  post hoc finding as a predicted one. Destroys the reader's ability to weigh
  the evidence, because a confirmed prediction and a mined pattern get equal
  billing.

Defence is procedural, not heroic: the plan (section 1), the confirmatory /
exploratory split (section 2), and correction (section 4).

## 4. Multiple comparisons

Every extra test is another lottery ticket against the null. Twenty independent
tests at alpha=0.05 on pure noise turn up at least one "significant" result in
about 64% of studies (analytic 1-0.95**20 = 0.6415; simulated 63.9% of 10,000).
Use a correction named in the plan:

- **Bonferroni**: threshold = alpha / m. Simple, overly conservative, controls
  family-wise error rate (FWER). In a concrete vector of 10 p-values
  (0.001, 0.008, 0.021, 0.036, 0.049, 0.11, 0.24, 0.31, 0.48, 0.77), raw
  analysis flagged 5 at 0.05; Bonferroni-adjusted p-values were
  [0.01, 0.08, 0.21, 0.36, 0.49, 1.0, 1.0, 1.0, 1.0, 1.0] and only 1 survived.
- **Benjamini-Hochberg**: controls the false discovery rate (FDR), the expected
  *proportion* of false discoveries among rejections, and is the better default
  for GWAS-scale screening or wide feature tables (many features x few rows).
  Same vector, BH-adjusted: [0.01, 0.04, 0.07, 0.09, 0.098, 0.1833, 0.3429,
  0.3875, 0.5333, 0.77]; 2 survive. With 20 noisy t-tests per study, BH kept the
  family-wise "at least one false hit in the family" rate at 5.0% (10,000
  simulations).

Decide *which* family (all planned tests) up front, and never run uncorrected
screening on the dataset you will publish claims from. Statsmodels:
`statsmodels.stats.multitest.multipletests(pvals, method='fdr_bh')`.

## 5. p-values and effect sizes

A p-value is the probability of data at least as extreme as observed, **if the
null hypothesis is true**. It is not any of these three things:

1. Not the probability the null is true.
2. Not the probability the result happened by chance.
3. Not a measure of effect size or importance.

Large n manufactures small p: with n=50,000/group and a true difference of
0.02 SD, a simulated t-test returned p=0.0017, d=0.0198, 95% CI
[0.0074, 0.0322]. A highly "significant" difference a reader cannot perceive.
So report the estimate with its interval as the headline:

- Standardised mean difference (Cohen's d): small 0.2, medium 0.5, large 0.8.
- Practical usefulness lives in *this dataset's units*, not the standardised
  scale; translate before interpreting.
- A 95% CI is the range of effect sizes the data are compatible with; "not
  significant" means the interval contains 0, not that there is no effect, and
  a tiny CI width on a huge n can still sit entirely above 0 and matter not at
  all in practice. Interval reasoning before test reasoning.

Raw p-values stay important for one thing: deciding *which* findings a
correction (section 4) will certify as confirmatory. They are bookkeeping, not
the headline.

## 6. Assumption checking, and what to do when assumptions fail

Check assumptions on the residual structure *before* trusting a test's p-value.
Shapiro-Wilk on residuals, residual-vs-fitted plot for homoscedasticity,
Ljung-Box or autocorrelation plot for independence (on time-series data).

When an assumption fails, pick the alternative *by property, not by habit*:

| Broken assumption | First-line response |
| --- | --- |
| Non-normal residuals, heavy tails, n<~15/group | Mann-Whitney U (rank-based), or bootstrap CI on the mean |
| Heteroscedastic variances between groups | Welch's t (unequal variance), never pool |
| Non-independence (repeated measures, clustered) | Mixed model / GEE / paired test, never a plain t-test on rows |
| Few outcomes, censored or ordinal data | Permutation test or rank method |

Two things the textbook forgets, both demonstrated by simulation:

- Heavy tails *on both groups*: with n=25/group, true shift 0, the t-test has an
  actual false positive rate of ~0.020 (under the nominal 0.05) while
  Mann-Whitney sits at 0.050. The subtle error is different: when the null is
  false (true shift 2.0, n=25/group, Cauchy tails) the *power* collapses - t
  detected the shift 20.4% of the time, Mann-Whitney 87.6%. Heavy-tailed data
  is not "t is unsafe"; it is "t barely detects real effects here".
- Unequal n and unequal sd: pooling variance is only safe when n and sd move in
  opposite directions. Simulated, null true, alpha target 0.05: pooled t hit
  0.290 type-I error with n=(10,40) sd=(4,1); 0.000 with n=(10,40) sd=(1,4);
  0.054 with equal n. Welch held 0.048-0.051 in every case. **Use Welch as the
  default** for two-group comparisons and stop treating "equal variances" as a
  special case that needs justifying.

Assumption checks themselves are multiple tests; a failed check is a decision
point with a plan behind it (section 1), not an alert to tea-leaf-read.

## 7. Outliers and missing data

**Outliers**: decide the rule while blind to the data. Good stated rules name
the metric (IQR fence at 1.5x, deviation > 3 SD of the residual, physical
impossibility), the action (drop / winsorise / keep + robust variant), and a cap
of k points. Simulated, post hoc deletion of 2 extreme points turned a 5.1%
false-positive rate into 16.3%. "If p looks weak, trim outliers" is not a rule.
Never delete a point because it breaks the story; delete it because a rule
defined before the data named the condition, and report every deletion.
**Missing data**: the mechanism decides the remedy, not the tool's default.

- **MCAR** (missing independent of everything): listwise deletion is unbiased,
  just wasteful.
- **MAR** (missing depends on *observed* variables): deletion biases, but
  multiple imputation conditional on observed data repairs it. Simulated, y =
  0.5x + noise, dropping the 40% of rows with the largest x: full-data mean(y)
  = 24.98, slope 0.50; after the drop, mean(y) = 21.43 (biased) but slope 0.497
  (survives, because the mechanism is on a covariate the model conditions on).
  Add mean-imputation on top and the slope is destroyed: 0.125.
- **MNAR** (missing depends on the *hidden* value itself): no imputation fixes
  this. Dropping the 40% of rows with the largest y gave slope 0.42 instead of
  0.50, mean 21.35 instead of 24.98. Name the mechanism, then either model it
  (selection model, pattern-mixture, sensitivity analysis per section 9) or
  scope the claim to what the data can support.

Also worth remembering: **patient-level imputation of a mean** is not
"handling" missing data; it shrinks variance and, as the simulation shows, can
destroy a coefficient in a regression where the response is fine. If the
mechanism is MAR and the analysis is regression, listwise deletion on the
*conditioned-on* covariate is often less harmful than a naive imputation, but
multiple imputation is the general-purpose correct answer.

## 8. Power, sample size, preregistration

Power targets **before** data collection, never post hoc power *after*. Post hoc
power is a function of the observed p-value and adds no information; the
pre-study calculation is the only kind that decides anything.

Reference values for a two-sided two-sample t-test, alpha=0.05, power=0.80
(statsmodels `TTestIndPower`):

| Effect size (Cohen's d) | n per group |
| --- | --- |
| 0.2 | 394 |
| 0.5 | 64 |
| 0.8 | 26 |

Power at n=20/group for d=0.5 is only **0.34**: an underpowered study is a
machine for finding *nothing* in the very effect you came to detect, and it is
also a machine for finding *noise* (see forking paths). Use
`statsmodels.stats.power.TTestIndPower().solve_power()`.

**Preregistration**: publish the plan (hypotheses, primary outcomes, sample
size, exclusion rules, analysis code stub) somewhere timestamped and immutable
before the data exist, e.g. OSF, as clinical trials register. A preregistered
plan converts confirmation into something a skeptic can tell apart from
exploration, and makes HARKing structurally impossible rather than
conventionally embarrassing. If preregistration is impossible (exploratory
work), the next best thing is a *dated* analysis plan file committed next to
the raw data (section 10).

## 9. Sensitivity analysis

One result that depends on one defensible choice is a fragile result. Run the
headline estimate under several defensible alternatives and report whether the
conclusion is stable:

- Imputation model varied (mean / regression / multiple imputation / no
  imputation).
- Outlier rule varied (drop / winsorise / keep and use a robust estimator).
- Subgroup or exclusion boundary moved (age cutoff 55 -> 50 or 60).
- Test changed (t -> Welch t -> Mann-Whitney).

Report the pattern in one table, not the happy result hidden in the smallest
number. A finding that flips signs under two defensible choices is not a
finding, it is a decision; report it as such. Sensitivity analysis is also the
honest answer when the missing-data mechanism is uncertain: run the analysis
under MCAR / MAR / MNAR assumptions side by side and see which conclusion
survives all of them.

## 10. Reproducible pipeline

The number in the paper must be regenerable from the raw data with a fixed
recipe. That means:

1. **Raw data is immutable.** Never edit the source file; write a separate
   scripted cleaning step. If the raw file changes, the pipeline output changes,
   and that change is visible rather than silent.
2. **Scripted transformation, not edited copies.** Every row dropped, join
   performed, and value recoded exists as a line in a file (Python/R/SQL,
   anything reviewable), not as a manual edit in Excel. A spreadsheet cell
   someone typed over is not reproducible.
3. **Randomness is seeded.** `np.random.default_rng(SEED)` (or
   `random.seed(SEED)`), not unseeded calls. A re-run that produces a different
   p-value because the bootstrap resample changed is a different result each
   time.
4. **Environment is pinned.** Record the actual versions in the environment
   used for the analysis, not the "latest" ones, in a committed `requirements.txt`
   or `pyproject.toml`. For the environment used to generate this skill's own
   examples: numpy 2.5.3, scipy 1.18.1, pandas 3.0.6, statsmodels 0.15.0.
   Container (Docker) image or `uv.lock`/`conda-lock` lockfile when available,
   because "pandas 3.0.6" today is not "pandas 3.0.6" forever. Record the Python
   version and OS too.
5. **Output is a generated artefact.** Tables/figures are written by the script,
   not pasted into a doc by hand. `make all` (or `quarto render` / a notebook
   run top-to-bottom on fresh state) produces the paper's tables from raw input
   on any machine.

Test the pipeline the way you test code: delete the output directory, re-run,
diff. If the paper's number changes, there is untracked state - a manual edit,
unpinned randomness, version drift, outdated working-directory assumption -
and the conclusion is the paper's only load-bearing wall.

Reproducibility is related to but distinct from analysis quality (section 1-9):
a garbage analysis can be perfectly reproducible; still garbage. Both are
required.

## 11. Deliverable checklist

Before reporting a conclusion, confirm every line:

- [ ] Analysis plan written and frozen before outcome data was viewed.
- [ ] Confirmatory / exploratory split labelled in the output.
- [ ] Multiple-comparison correction named in the plan and applied to the
      family it planned to correct.
- [ ] Effect sizes and 95% CIs reported ahead of any p-value.
- [ ] Assumptions checked; any violation handled per the plan, not ad hoc.
- [ ] Outlier rule stated up front, applied mechanically, deletions listed.
- [ ] Missing-data mechanism reasoned about (MCAR / MAR / MNAR), handling
      chosen for that mechanism, not the tool's default.
- [ ] Power / sample size computed before collection; no post hoc power.
- [ ] Sensitivity analysis run around the defensible choices that could
      plausibly flip the result.
- [ ] Random seeds, dependency versions and OS recorded; pipeline reproduced
      the headline number from raw input at least once on a clean checkout.
- [ ] If preregistered, deviation list remains empty or documented.

If a line fails, fix it before the conclusion leaves the room.

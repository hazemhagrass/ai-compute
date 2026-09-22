---
name: academic-paper-writing
description: Use when writing or revising a paper for peer review. Structure IMRaD, state contributions, survive the desk reject.
---

A paper is a claim plus the evidence a hostile expert needs to check it. Peer review is that hostile expert reading under time pressure, looking for a reason to stop. This skill covers the structure and conventions of a peer-reviewed paper: what belongs in each section, what the reviewer is actually checking, and what gets a manuscript rejected before anyone reads the results.

Three neighbouring skills own adjacent ground and are not restated here:

- [`literature-review`](../literature-review/SKILL.md) owns finding and synthesising the sources. Use it to build the evidence base before you write the related work section.
- [`truth-first`](../truth-first/SKILL.md) owns whether a single claim is grounded. Every number in your paper is subject to its rules, including the ones about your own work.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) owns sentence and paragraph craft: leading with the action, complete examples, failure modes.
- [`citation-manager`](../citation-manager/SKILL.md) owns bibliography mechanics: reference databases, citation keys, style files. Do not hand-maintain references.

## The claim comes first

### 1. Write the abstract last, and make it claim-first

The abstract is the only part most readers read, and the part an editor uses to decide whether the paper is in scope. You cannot write it until the results are final, because an abstract drafted early describes the paper you hoped to write.

A claim-first abstract has five moves in roughly five to seven sentences:

1. The problem, in one sentence, in terms a reader outside your subfield recognises.
2. The gap: what is unresolved, stated as a limitation of current work rather than as a complaint.
3. What you did, in method terms concrete enough to be recognisable.
4. What you found, with numbers, including the direction and the magnitude.
5. What it means and for whom, bounded to what you actually showed.

Do not open with two sentences of field history. Do not write "results are discussed" or "implications are considered", which tell the reader nothing and burn the space where the finding should be.

### 2. State contributions explicitly as a list

Reviewers are asked to judge novelty and significance. Make that judgement easy by naming the contributions rather than leaving them implicit in the narrative. Put the list at the end of the introduction.

Each item should be a thing that did not exist before your paper and that a reader could verify by looking at a specific section.

**Bad:**

> In this paper we explore several aspects of the problem and present a number
> of interesting findings.

**Good:**

> Our contributions are:
>
> 1. A formal statement of the scheduling problem under partial observability
>    (Section 3), which prior formulations assume away.
> 2. An algorithm with a worst-case bound of O(n log n), proved in Section 4.
> 3. An evaluation on three public datasets showing a 12% median latency
>    reduction over the strongest prior method (Section 6), with the code and
>    configurations released.
> 4. A characterisation of the regime where the method fails: workloads with
>    burst factors above 8 (Section 6.4).

Item 4 is a contribution, not a weakness. Naming where a method stops working is information other researchers can use.

## IMRaD, and the line between describing and interpreting

IMRaD is Introduction, Methods, Results, and Discussion. The boundary reviewers police hardest is between Results and Discussion. Results describe what the data show. Discussion interprets what that means. Mixing them is the single most common structural complaint in review, because interpretation smuggled into Results lets a claim pass without the reader noticing it was a claim.

| Section | Answers | Tense | Contains |
|---|---|---|---|
| Introduction | Why should anyone care, and what is missing | Present for the field, past for prior work | Problem, gap, contributions list |
| Related work | How does this sit against prior work | Present or past | Positioning, not a catalogue |
| Methods | What exactly did you do | Past | Enough detail to reproduce |
| Results | What did the data show | Past | Measurements, figures, tables, no causal language |
| Discussion | What does it mean, and what are the limits | Present | Interpretation, comparison, limitations, future work |

### 3. Results describe, Discussion interprets

**Bad (in Results):**

> Accuracy rose from 71% to 84%, demonstrating that the attention mechanism
> captures long-range dependencies that the baseline misses.

The first clause is a result. The second is an untested mechanistic explanation wearing the same sentence.

**Good (in Results):**

> Accuracy rose from 71.2% to 84.0% (95% CI for the difference: 9.4 to 16.2
> points, n = 2,000 held-out items).

**Good (in Discussion):**

> The gain concentrates on items with referents more than 40 tokens apart
> (Table 5), which is consistent with the attention mechanism capturing
> long-range dependencies. We did not test this mechanism directly; an
> ablation of the attention span would be needed to establish it.

### 4. The introduction establishes a gap without padding

The introduction has one job: convince the reader that a specific thing is unknown and that knowing it matters. Four paragraphs is usually enough.

1. The problem and why it matters, with the stakes named concretely.
2. What is known, compressed, with citations doing the work.
3. The gap: what remains unresolved and why prior approaches do not close it.
4. What this paper does, ending in the contributions list.

Padding to avoid: opening sentences that could preface any paper in the field ("Machine learning has seen rapid growth in recent years"), history that does not bear on the gap, and definitions of terms every reader of the venue already knows.

The gap must be falsifiable. "Nobody has studied X" invites a reviewer to produce the paper that studied X, and they usually can. "Prior work on X assumes independent arrivals; production traces are bursty, and no published evaluation covers that regime" is a gap that survives, because it names the assumption rather than claiming absence.

### 5. Related work positions, it does not list

A related work section that is one paragraph per paper is an annotated bibliography. Organise by the dimensions along which approaches differ, place your work on those dimensions, and make the contrast explicit.

**Bad:**

> Smith et al. (2023) proposed a caching layer. Jones et al. (2024) used
> prefetching. Patel et al. (2025) combined both.

**Good:**

> Prior approaches trade memory for latency in one of two ways. Caching methods
> (Smith 2023; Patel 2025) hold results and assume request keys repeat.
> Prefetching methods (Jones 2024) predict the next key and assume arrivals are
> predictable. Both assumptions fail under the bursty traces we target, which
> is why we take the third route of admission control rather than a hybrid of
> the two.

Cite what you position against, not everything you read. See [`literature-review`](../literature-review/SKILL.md) for assembling the set and for keeping it unbiased.

## Methods a stranger could run

### 6. Reproducibility is a checklist, not an aspiration

Write Methods so that a competent stranger with your data could get your numbers. The reviewer's test is simpler: could they tell what you did well enough to spot a flaw? Missing detail reads as concealment even when it is only carelessness.

Report, at minimum:

- **Software versions**: language, framework, library, and solver versions, pinned. "PyTorch 2.3.1, CUDA 12.1" beats "recent PyTorch".
- **Parameters**: every hyperparameter, including the ones you did not tune, and how the tuned ones were selected (search space, budget, selection criterion, and which split was used).
- **Random seeds**: the seeds used, and whether reported numbers are single runs or aggregates over seeds. A single-seed result on a stochastic method is an anecdote.
- **Hardware**: CPU/GPU model, memory, and count, because timing claims are meaningless without them.
- **Data provenance**: source, version or snapshot date, licence, size, and the exact split procedure. If you filtered, state the filter and how many records it removed.
- **What you excluded and why**: dropped runs, failed jobs, outlier removal, with counts.

For human-subject or animal work, the ethics approval body and protocol number belong here, and their absence is a desk-reject trigger at most venues.

### 7. Report negative and null results honestly

A method that did not work, an ablation that changed nothing, a dataset where the effect vanished: these belong in the paper. Removing them turns your evaluation into a selection of the runs that agreed with you, which is the mechanism that makes literatures unreliable.

**Bad:** report the three datasets where the method wins, omit the two where it ties.

**Good:** report all five, and say in the Discussion that the gain appears only where the input distribution is skewed, which is a finding.

A null result is not the same as an absence of evidence. "We observed no difference" is weak; "the 95% confidence interval for the difference was 0.4 to 0.6 points on a 100-point scale, which excludes any effect large enough to matter here" is a real finding, because it bounds the effect rather than failing to detect one.

## Statistics that survive scrutiny

### 8. Report effect sizes and uncertainty, not bare p-values

A p-value is the probability of observing data at least as extreme as yours, assuming the null hypothesis is true. It is not the probability that the null hypothesis is true, and it is not a measure of effect size.

Consequences you can state without controversy:

- **Statistical significance is not practical importance.** With a large enough sample, an effect too small to act on will clear any threshold. Always pair a test with the magnitude and its interval, and say whether that magnitude matters in the application.
- **Multiple comparisons inflate false positives.** Testing many hypotheses at a fixed threshold makes some of them cross it by chance. If you ran many tests, say how many, and either correct (Bonferroni, Benjamini-Hochberg) or report the tests as exploratory and label them so.
- **Correlation does not imply causation.** Observational association supports a causal claim only under assumptions you must state: no unmeasured confounding, correct temporal order, no selection into the sample on the outcome. If you cannot defend those, write the association in associational language.

**Bad:**

> The treatment group performed significantly better (p < 0.05), showing that
> the intervention improves outcomes.

**Good:**

> The treatment group scored 3.2 points higher on the 100-point scale
> (95% CI 0.4 to 6.0; n = 120 per arm; two-sided t-test, p = 0.03). The
> interval includes differences small enough to be operationally irrelevant,
> so we treat this as weak evidence of a small effect rather than a
> demonstrated improvement.

Pre-register or at least pre-declare your primary outcome where the venue supports it. An analysis chosen after seeing the data is exploratory, and labelling it so costs you far less than a reviewer discovering it.

### 9. Figures carry the argument, captions stand alone

Reviewers skim figures first. A figure should make one point, and its caption should let a reader who has read nothing else understand what is plotted and what to conclude.

A self-contained caption states: what is plotted on each axis with units, what the sample or dataset is with n, what error bars or bands represent, and the takeaway.

**Bad:** `Figure 3: Results.`

**Good:** `Figure 3: Median end-to-end latency (ms, log scale) against offered load (requests/s) for the three schedulers on the WEB-2 trace. Bands show the interquartile range over 10 seeds. Admission control holds median latency flat past 4k req/s, where both baselines degrade.`

See [`data-visualization-principles`](../../data/data-visualization-principles/SKILL.md) for choosing the chart form. The rule specific to papers: never present a result only in prose when a figure would show it, and never present the same numbers in both a figure and a table.

## Credibility sections

### 10. Limitations is an asset, not a confession

A limitations section that names real constraints tells a reviewer you understand your own work. One that lists only generic caveats ("more data would help") tells them you did not look, and invites them to find the limitation you missed, which they will then treat as something you hid.

Name, for each limitation, the scope it restricts and what would resolve it:

> Our evaluation uses a single production trace from one provider, so the load
> patterns may not generalise to workloads with different burst structure. The
> effect size on skewed inputs is estimated from 10 seeds, which bounds
> precision at roughly plus or minus 2 points. We did not test above 8 GPUs,
> so the scaling claim is untested past that point.

Distinguish limitations (constraints on what your evidence supports) from future work (things you would like to do). Reviewers read a future-work list offered as limitations as an evasion.

### 11. Declarations belong in the paper, not in the cover letter

Most venues require these, and their absence triggers a return before review:

- **Author contributions**: who did what, often using CRediT roles (conceptualisation, methodology, software, validation, formal analysis, investigation, data curation, writing, supervision, funding acquisition).
- **Conflicts of interest**: funding sources, employment, consulting, patents, and any financial or personal relationship a reader might consider relevant. Declaring an interest is not an admission; concealing one is a retraction risk.
- **Data availability**: where the data are, under what licence, with an identifier. If data cannot be shared, say why (privacy, licence, third-party ownership) rather than writing "available on request", which most venues now treat as insufficient.
- **Code availability**: repository link, commit hash or release tag, and licence. A link to a repository whose contents changed after submission is not a reproducible artefact.
- **Ethics**: approving body and protocol number for human or animal work, and the consent procedure.

### 12. Know the venue's preprint and anonymity policy before you post

Policies differ by venue and change, so check the venue's own instructions rather than assuming. The things to check before submitting:

- Whether preprints are permitted at all, and whether posting during review is allowed.
- Whether review is single-anonymous, double-anonymous, or open, and what a preprint does to double-anonymity (some venues allow it, some forbid promotion during review).
- Length limits, template, and whether appendices count toward the limit.
- Licence terms of the preprint server versus the publisher's requirements.

## Review is a conversation

### 13. Respond point by point, and disagree without fighting

Reply to every reviewer comment in a separate numbered block, quoting the comment, then stating the change and where it lives. A response that answers a subset reads as evasion, and an editor cannot check what you did not list.

For each comment, do one of three things:

- **Accept and change**: state the change and the location. "Added seed counts and variance across seeds to Table 2 (Section 5.1)."
- **Accept partially**: do what you can and say what you could not. "We added the third dataset. The fourth is licence-restricted and cannot be redistributed; we note this in Limitations."
- **Disagree**: address the substance, not the reviewer. Restate their concern in your own words to show you understood it, give the evidence, and offer a change that addresses the underlying worry even if you reject the proposed fix.

**Bad:**

> The reviewer has clearly misunderstood our method. As stated in Section 3,
> the baseline is appropriate.

**Good:**

> R2.4: "The baseline seems weaker than the current state of the art."
>
> We read this as a concern that the comparison is not against the strongest
> available method. We chose this baseline because it is the only prior method
> with a public implementation supporting variable-length inputs, which we now
> state explicitly in Section 5.2. We additionally ran the stronger method on
> the fixed-length subset where it applies; results are in the new Table 7,
> and our method remains ahead by 6 points on that subset.

If a comment rests on a factual error about your paper, correct it neutrally and point to where the paper says otherwise, then ask whether that passage should be clearer, because a reviewer misreading it means other readers will too.

### 14. Avoid the desk rejects

Desk rejection happens before review, usually in minutes, usually for something you could have checked. The recurring causes:

| Cause | Check before submitting |
|---|---|
| Scope mismatch | Read the venue's aims and scope, and cite papers it published |
| Formatting | Use the official template unmodified; do not shrink margins or fonts |
| Over length | Count pages with references and appendices under the venue's rule |
| Missing ethics statement | Required for human, animal, or sensitive-data work |
| Anonymity break | No author names, no acknowledgements, no "our earlier work [12]", no identifying repository URLs, no PDF metadata with your name |
| Missing declarations | Conflicts, funding, data and code availability |
| Dual submission | Not under review elsewhere, and prior overlapping work disclosed |
| Broken references | Every citation resolves; see [`citation-manager`](../citation-manager/SKILL.md) |

## Before you submit

1. Does the abstract state the finding with a number, not a promise to discuss it?
2. Are the contributions a numbered list, each pointing to a section?
3. Does the introduction name a falsifiable gap in one sentence?
4. Is Results free of causal and mechanistic language?
5. Could a stranger rerun the work from Methods alone: versions, parameters, seeds, hardware, data provenance?
6. Are null and negative results present rather than pruned?
7. Does every statistical claim carry an effect size and an interval?
8. Does every figure caption stand alone, with units, n, and what the bands mean?
9. Does Limitations name real scope constraints, not generic caveats?
10. Are contributions, conflicts, data, code, and ethics statements all present?
11. Is the manuscript anonymous where the venue requires it, including metadata?

If any answer is no, the reviewer will find it before you do.

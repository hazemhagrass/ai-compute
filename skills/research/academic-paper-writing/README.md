# Academic Paper Writing

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="academic-paper-writing robot" width="200">
</div>

Structure a manuscript so a hostile expert reviewer can check your claim instead of rejecting it for something you could have fixed in an hour.

## What it does

Applies the structural conventions of peer-reviewed papers to a draft, across four areas:

1. **The claim.** A claim-first abstract written last, and contributions stated as a numbered list that each point to a section. Reviewers are asked to judge novelty; this makes that judgement checkable rather than a guess.
2. **IMRaD discipline.** Introduction, Methods, Results, and Discussion, with the Results/Discussion boundary enforced. Results describe what the data show. Discussion interprets. Mixing them is the most common structural complaint in review, because interpretation hidden inside a Results sentence passes without the reader noticing it was a claim.
3. **Evidence that holds.** Methods written so a stranger could rerun the work: versions, hyperparameters, seeds, hardware, data provenance, exclusions with counts. Effect sizes with intervals rather than bare p-values. Null and negative results kept rather than pruned.
4. **Credibility surface.** Limitations as a scope statement, figure captions that stand alone, and the declarations (contributions, conflicts, data, code, ethics) whose absence returns a manuscript before review.

It sits between three other skills. [`literature-review`](../literature-review/SKILL.md) assembles the evidence base you cite. [`truth-first`](../truth-first/SKILL.md) governs whether any single claim is grounded, including claims about your own results. [`technical-writing`](../../writing/technical-writing/SKILL.md) governs the sentences. This skill governs the shape of the artefact.

## When to use this

Use it when:

- Drafting a paper for a journal or conference with peer review
- Revising a manuscript before submission, or auditing a collaborator's draft
- Writing a response to reviewers after a major or minor revision decision
- Converting a technical report, thesis chapter, or preprint into a submission
- Diagnosing why a paper was desk rejected without review

Skip it when:

- Writing a blog post, internal report, or documentation. Use [`technical-writing`](../../writing/technical-writing/SKILL.md).
- Doing the literature search itself. Use [`literature-review`](../literature-review/SKILL.md).
- Managing references and bibliography files. Use [`citation-manager`](../citation-manager/SKILL.md).
- Building a conference talk from a finished paper. Use [`presentation-design`](../../design/presentation-design/SKILL.md).

## Quick start

Take a weak abstract and rewrite it claim-first. This is a fictional example built to show the edits, not a report of real results.

**Before:**

```
Machine learning has become increasingly important in many domains
in recent years. Scheduling is a fundamental problem in distributed
systems and has been studied extensively. However, existing methods
still face challenges. In this paper, we propose a novel approach
to the scheduling problem based on a new admission control
mechanism. We conduct extensive experiments on several datasets.
The results demonstrate the effectiveness and efficiency of our
proposed method. The implications of these findings are discussed,
and directions for future work are outlined.
```

What a reviewer sees: two sentences of filler before the topic appears, a gap stated as "still face challenges" (which names nothing), no numbers, no named datasets, and a closing sentence that promises discussion instead of reporting a finding. An editor screening for scope cannot tell what was measured or whether it belongs in the venue.

**After:**

```
Request schedulers for inference services degrade sharply under
bursty load, and the resulting tail latency is what users
experience. Existing caching and prefetching schedulers assume
either repeated request keys or predictable arrivals; production
traces satisfy neither, and no published evaluation covers the
bursty regime. We present ADMITQ, a scheduler that rejects
admission rather than queuing when predicted service time exceeds
the latency budget. On three public traces (WEB-2, AZURE-VM,
ALIBABA-PAI) across 10 seeds, ADMITQ holds median end-to-end
latency flat to 4,100 requests per second, where the strongest
baseline degrades at 2,400, a 12% median latency reduction at
matched throughput (95% CI 8 to 16%). The gain is confined to
workloads with burst factors above 3; below that, ADMITQ and the
baseline are indistinguishable. Code, configurations, and seeds
are released.
```

The five moves, in order: problem stated in user-visible terms, gap stated as a named assumption that fails rather than as vague difficulty, method concrete enough to recognise, findings with magnitude and interval and named datasets, and a bounded scope claim that also discloses where the method does not help.

Note the last two sentences. Reporting the regime where the effect disappears in the abstract is not a weakness. It preempts the reviewer who would have found it in Section 6 and treated it as something you buried.

Then work outward: introduction ends in a numbered contributions list matching those findings; Methods carries versions, seeds, and hardware; Results reports the numbers without explaining them; Discussion explains them and states what the evidence does not cover.

## Key concepts

### Claim-first abstract, written last

Five moves: problem, gap, what you did, what you found with numbers, what it means and for whom. Written after the results are final, because an abstract drafted early describes the paper you intended. "Results are discussed" is not a finding.

### Contributions as a list

Each item is something that did not exist before the paper, pointing to the section that establishes it. A negative characterisation ("the method fails above burst factor 8, Section 6.4") is a legitimate contribution, because other researchers can use the boundary.

### The Results/Discussion boundary

Results state measurements in past tense with no causal or mechanistic language. Discussion states interpretation in present tense and says explicitly what was not tested. "Accuracy rose 13 points" is a result. "Because the attention mechanism captures long-range dependencies" is an interpretation, and belongs in Discussion with a note on what would be needed to establish it.

### A falsifiable gap

"Nobody has studied X" invites a reviewer to name the paper that did. "Prior work assumes independent arrivals; production traces are bursty and no published evaluation covers that regime" names the assumption, which survives a counterexample search.

### Reproducibility detail

Software versions pinned, every hyperparameter plus the tuning procedure and split, seeds and whether numbers aggregate over them, hardware model and count, data source with version and licence and split procedure, and every exclusion with a count. Missing detail reads as concealment even when it is carelessness.

### Effect size over p-value

A p-value is the probability of data at least as extreme as yours under the null hypothesis. It is not the probability the null is true, and it is not a magnitude. Statistical significance is not practical importance: a large enough sample makes any effect cross a threshold. Multiple tests at a fixed threshold inflate false positives, so report how many you ran and either correct or label the analysis exploratory. Correlation supports causation only under stated assumptions.

### Null results are findings

"We observed no difference" is weak. "The 95% interval for the difference was 0.4 to 0.6 points on a 100-point scale" bounds the effect, which is a result. Dropping the datasets where the method tied turns an evaluation into a selection of agreeable runs.

### Self-contained captions

Axes with units, dataset and n, what error bars or bands represent, and the takeaway. Reviewers skim figures before prose, so a caption that requires the body text to interpret wastes the first impression.

### Limitations as scope, not apology

Name what the evidence does not cover and what would resolve it. Generic caveats ("more data would help") signal that you did not look, and license the reviewer to treat the limitation they find as one you hid. Limitations constrain the claim; future work is a wish list, and offering the second as the first reads as evasion.

### Related work as positioning

Organise by the dimensions along which approaches differ, place your work on them, and make the contrast explicit. Cite what you position against, not everything you read.

## Common pitfalls

### Interpretation smuggled into Results

Bad:

```
Accuracy rose from 71% to 84%, demonstrating that the model
learns compositional structure.
```

Good:

```
Results:    Accuracy rose from 71.2% to 84.0% (95% CI for the
            difference 9.4 to 16.2 points, n = 2,000).
Discussion: The gain concentrates on items requiring two-step
            composition (Table 5), consistent with the model
            learning compositional structure. We did not test
            this directly.
```

The "demonstrating" clause is an untested mechanism riding along with a measurement, so it passes review without ever being evaluated as a claim.

### Significance read as importance

Bad:

```
The treatment group performed significantly better (p < 0.05),
showing the intervention improves outcomes.
```

Good:

```
The treatment group scored 3.2 points higher on a 100-point
scale (95% CI 0.4 to 6.0, n = 120 per arm, p = 0.03). The
interval includes differences too small to matter operationally.
```

A p-value carries no magnitude. With a large sample it will cross any threshold for an effect nobody would act on, so a bare p-value lets a trivial finding read as a substantial one.

### The generic opening paragraph

Bad:

```
In recent years, artificial intelligence has seen rapid growth
across many domains, attracting significant attention from both
academia and industry.
```

Good:

```
Inference schedulers drop requests under bursty load, and the
resulting tail latency is what users experience as an outage.
```

The first sentence could preface any paper in the field, which means it carries no information and spends the reviewer's attention before the problem appears.

### Methods that cannot be rerun

Bad:

```
We trained the model with standard hyperparameters on a GPU
until convergence.
```

Good:

```
PyTorch 2.3.1, CUDA 12.1, 4x A100 80GB. AdamW, lr 3e-4, cosine
decay, batch 256, 40 epochs. Learning rate selected from
{1e-4, 3e-4, 1e-3} on the validation split. Seeds 0 to 9; all
reported numbers are medians over 10 runs.
```

"Standard" is not a value. A reviewer who cannot tell what you did cannot tell whether it was wrong, and defaults to assuming it was.

### Pruned negative results

Bad:

```
Our method outperforms the baseline on all three benchmarks.
(Two further benchmarks where it tied are not mentioned.)
```

Good:

```
Our method outperforms the baseline on three of five benchmarks
and is indistinguishable on the other two. The gain appears only
where the input distribution is skewed (Section 6.3).
```

Selective reporting makes the evaluation a sample of the runs that agreed with you, which is the mechanism that makes a literature unreliable.

### Generic limitations

Bad:

```
Like all studies, ours has limitations. Future work could
explore additional datasets and larger models.
```

Good:

```
The evaluation uses one production trace from a single provider,
so burst structure may not generalise. We did not test above
8 GPUs, so the scaling claim is untested past that point.
```

Generic caveats tell a reviewer you did not examine your own scope, so the limitation they find looks concealed rather than overlooked.

### Related work as a catalogue

Bad:

```
Smith (2023) proposed caching. Jones (2024) used prefetching.
Patel (2025) combined both.
```

Good:

```
Caching methods (Smith 2023; Patel 2025) assume request keys
repeat; prefetching (Jones 2024) assumes arrivals are
predictable. Both assumptions fail on bursty traces, which is
why we use admission control instead.
```

One paragraph per paper leaves the reader to work out where your paper sits, which was your job, not theirs.

### Combative reviewer response

Bad:

```
The reviewer has clearly misunderstood our method. As stated in
Section 3, the baseline is appropriate.
```

Good:

```
R2.4: "The baseline seems weaker than the current state of the
art." We read this as a concern that the comparison is not
against the strongest method. We chose it because it is the only
prior work with a public implementation supporting
variable-length inputs, now stated in Section 5.2. We also ran
the stronger method on the fixed-length subset where it applies
(new Table 7); our method leads by 6 points there.
```

The editor arbitrates, and "you misunderstood" gives them nothing to arbitrate with. Restating the concern and answering the substance does.

## See also

- [`literature-review`](../literature-review/SKILL.md) - assembling and synthesising the source base before writing related work
- [`truth-first`](../truth-first/SKILL.md) - grounding every factual claim, including claims about your own results
- [`citation-manager`](../citation-manager/SKILL.md) - reference databases, citation keys, and bibliography mechanics
- [`technical-writing`](../../writing/technical-writing/SKILL.md) - sentence and paragraph craft underneath the paper structure
- [`data-visualization-principles`](../../data/data-visualization-principles/SKILL.md) - choosing the chart form for a figure that carries the argument
- [`review-comment-phrasing`](../../writing/review-comment-phrasing/SKILL.md) - phrasing critique without attacking the person, useful when you are the reviewer
- [`grill-me`](../../workflow/grill-me/SKILL.md) - adversarial interrogation of your own argument before a reviewer does it
- [`presentation-design`](../../design/presentation-design/SKILL.md) - turning the finished paper into a talk

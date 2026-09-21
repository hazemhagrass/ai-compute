# Literature Review

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Run a literature search that someone else could re-run and land on the same included set.

## What it does

Turns "I read a bunch of papers" into a protocol, a query log, a screening trail, and an extraction table. The skill applies rules across four stages:

1. **Protocol first.** Question, inclusion criteria, exclusion criteria, databases, and date range get written down before the first search runs, so the criteria are not reverse-engineered from whatever came back.
2. **Search and record.** Every database gets its exact query string, filters, and hit count logged, plus forward and backward citation chasing, because an unrecorded search cannot be reproduced.
3. **Screen in two passes.** Title and abstract first, then full text, with one exclusion reason per excluded paper drawn from the pre-declared criteria, and PRISMA counts that reconcile.
4. **Extract and synthesise.** A fixed-column table, one row per paper, then themes rather than a paragraph per paper.

It is the applied sibling of [`truth-first`](../truth-first/SKILL.md). That skill asks whether one claim is grounded. This one asks whether a body of claims was gathered without bias, because a review built entirely from the first page of one search engine can be perfectly cited and still wrong about the field.

## When to use this

Use it when:

- Writing a systematic review, scoping review, or a related-work section that claims coverage
- Building the evidence base for a technical, product, or clinical decision
- Answering "what does the research actually say about X?" for someone who will act on the answer
- Auditing an existing review for search gaps before trusting its conclusions
- Updating a prior review, where you need the earlier search to be re-runnable

Skip it when:

- Reading for orientation, with no claim of completeness attached to the output
- Chasing one specific paper you already know by name
- The question is answered by primary documentation or source code rather than research literature. Use `truth-first` for that.

## Quick start

A worked example. Someone asks whether retrieval-augmented generation actually reduces hallucination in question answering.

**Step 1: write the protocol.** Before touching a search box.

```
Question:   Does adding retrieval to a generative QA system reduce
            factually incorrect answers versus the same model without
            retrieval?
Include:    Empirical evaluations with a no-retrieval baseline and a
            reported factuality or accuracy measure.
Exclude:    (1) no retrieval component, (2) no baseline comparison,
            (3) survey or position paper only, (4) not in English.
Databases:  arXiv (where this field preprints), Scopus (peer-reviewed
            and citation graph), ACL Anthology (venue of record for NLP).
Dates:      2020 onward (RAG formulation published 2020).
```

**Step 2: search and log.** Write the query, run it, record the count.

| Database | Query | Filters | Hits |
|---|---|---|---|
| arXiv | `abs:("retrieval-augmented" AND (hallucination OR factuality))` | cs.CL, 2020+ | 214 |
| Scopus | `TITLE-ABS-KEY("retrieval augmented" AND "question answering")` | English, 2020+ | 168 |
| ACL Anthology | `retrieval augmented hallucination` | 2020+ | 97 |

Note the run date. Counts move as indexes grow.

**Step 3: deduplicate on DOI.** Import all 479 records into the reference manager, match on DOI, then hand-match arXiv preprints against their published versions (different DOIs, same work). Say 122 duplicates come out, leaving 357.

**Step 4: screen pass one, title and abstract.** Fast yes or no against the four exclusion criteria. Say 291 are excluded, leaving 66 to retrieve.

**Step 5: screen pass two, full text, with reasons.** Read the methods, not the abstract. Every exclusion gets a criterion number.

```
Liu 2024    - excluded: no no-retrieval baseline (criterion 2)
Okafor 2023 - excluded: position paper (criterion 3)
Tan 2025    - could not retrieve: paywalled, no institutional access
```

Say 47 are excluded, 4 cannot be retrieved, 15 included.

**Step 6: check the arithmetic.** 479 minus 122 duplicates, minus 291 screened out, minus 47 excluded at full text, minus 4 not retrieved, equals 15 included. It closes. If it had not, a paper went missing without a recorded decision.

**Step 7: chase citations.** Read the reference lists of the 15 included papers (backward) and their "cited by" lists (forward). Anything new goes through the same two-pass screen, marked as citation-chased so the source of each inclusion stays visible.

**Step 8: extract into the fixed table.** Same columns for every paper, including the ones whose conclusions you like.

| Key | Design | Dataset, n | Measured | Effect | Baseline | Preprint? |
|---|---|---|---|---|---|---|
| Smith25 | Benchmark | NQ, 3610 q | Exact-match accuracy | +4.1 pts (CI 2.2 to 6.0) | Same model, no retrieval | Published |
| Jones24 | Human eval | 200 answers | Rater-judged unsupported claims | 31% to 19% | Same model, no retrieval | Preprint |

**Step 9: synthesise by theme.** Not one paragraph per paper.

```
Twelve of 15 studies report improved factuality, but the effect
concentrates in questions whose answers exist verbatim in the
retrieval corpus. The three null results (Jones 2024; Liu 2025;
Ferreira 2025) all evaluate multi-hop questions, where no single
retrieved passage contains the answer. Retrieval corpus coverage,
not model size, separates the positive from the null findings.
```

**Step 10: declare the gaps.** "Four eligible reports could not be retrieved (DOIs in Appendix B). One included paper (Jones 2024) is a preprint and its published version may differ. All 15 were checked against the Retraction Watch database; none are retracted."

## Key concepts

### Protocol before search

Criteria written after seeing results are criteria shaped by results. Fixing the question, the inclusion and exclusion rules, the databases, and the date range in advance is what makes an exclusion decision defensible rather than a preference.

### The query log

Database, verbatim query string with field tags and Boolean operators, filters, hit count, and run date. This is the single artifact that makes the review reproducible. Without it, "we searched PubMed" is an assertion, not a method.

### Database coverage is not interchangeable

PubMed/MEDLINE indexes biomedical literature with the MeSH controlled vocabulary, which lets you search a concept rather than every word form of it. arXiv carries preprints in physics, mathematics, and computer science, with no peer-review gate. Scopus and Web of Science are curated multidisciplinary indexes with citation graphs, which is what makes forward citation chasing mechanical rather than manual.

Google Scholar is the widest net and the weakest instrument for a systematic search: its index contents are not published, its ranking is opaque and personalised, its Boolean support is limited, and it caps how deep you can page. Two people running the same query can get different lists, which is the definition of non-reproducible. Use it to find grey literature and to chase citations, never as the sole database.

### Two-pass screening

Pass one on title and abstract is cheap and catches the obvious misses. Pass two on full text is expensive and catches abstracts that oversell. Running only pass one excludes papers on the strength of their marketing; running only pass two costs you hundreds of full-text reads.

### PRISMA flow counts

PRISMA (Preferred Reporting Items for Systematic Reviews and Meta-Analyses) specifies a flow diagram: identified, duplicates removed, screened, excluded, sought for retrieval, not retrieved, assessed for eligibility, excluded with reasons, included. The counts must reconcile to the included total. Arithmetic that does not close means a paper was dropped without a recorded decision.

### Claimed versus measured

The abstract states a conclusion, the methods state an operationalisation, and they are frequently not the same scope. A single benchmark becomes "general capability", a surrogate endpoint becomes "patient outcomes", an association becomes "causes". Extract from methods and results, then note the gap where the abstract overreaches.

### Effect size over significance

A p-value reports how surprising the data would be under a null hypothesis. It reports nothing about magnitude, and large samples produce small p-values for effects too small to act on. Record the effect size and its confidence interval, which carry both magnitude and precision.

### Echo chamber

Citation chasing converges on a co-citing cluster. Signs: the same author groups on most included papers, one shared foundational citation, and no included paper contradicting another. Break out by searching a second vocabulary for the same construct, searching a neighbouring discipline's database, hunting explicitly for null results and failed replications, and comparing your included set against any prior registered review.

### DOI-based deduplication

The same paper arrives from three databases with three title spellings and an inconsistent author format. DOI is a persistent identifier, so match on it first. Preprint and published versions carry different DOIs for the same work, so catch those by title plus authors plus abstract and keep the published version, whose numbers may differ.

## Common pitfalls

### Unrecorded searches

Bad:

```
We searched PubMed, Scopus and Google Scholar for relevant papers.
```

Good:

```
PubMed, 2026-03-11: (semaglutide[tiab]) AND (obesity[MeSH]),
filters RCT + English + 2018-2026, 137 hits.
```

The first version cannot be re-run by anyone, including its author a month later.

### Google Scholar as the whole search

Bad:

```
A Google Scholar search returned 18,400 results; we reviewed
the first 100.
```

Good:

```
Scopus and PubMed searches (queries logged in Table 1) returned
570 records. Google Scholar was used additionally for grey
literature and forward citation chasing, contributing 9 records
not found in the indexed databases.
```

"First 100 by Google Scholar's ranking" is a sample selected by an undisclosed algorithm, so its bias cannot be characterised.

### Exclusions without reasons

Bad:

```
Chen 2023 - excluded, not relevant
```

Good:

```
Chen 2023 - excluded at full text: no comparator group
(exclusion criterion 3)
```

"Not relevant" cannot be checked or disputed, so it hides both honest mistakes and motivated ones.

### p-value as the finding

Bad:

```
The intervention significantly improved scores (p = 0.03).
```

Good:

```
Mean difference 2.1 points (95% CI 0.3 to 3.9) on a 100-point
scale, n = 88 per arm.
```

The interval shows both that the effect is distinguishable from zero and that it may be too small to matter, which the p-value alone conceals.

### Abstract taken as the result

Bad:

```
Smith 2024 shows the intervention improves patient outcomes.
```

Good:

```
Smith 2024 measured 30-day readmission at a single hospital
(n = 412). "Improves patient outcomes" in the abstract covers
one proxy outcome, one site, 30 days.
```

Reviews that extract from abstracts inherit every abstract's overreach and compound it.

### Preprints and published versions conflated

Bad:

```
Jones et al. report a 40% reduction.
```

Good:

```
Jones et al. (preprint, not peer reviewed) report a 40%
reduction. The version published later reports 27% after a
reviewer-requested correction to the denominator; we extract
from the published version.
```

Numbers move between versions. An unmarked preprint gives a reader no way to weigh the claim.

### Inaccessible papers silently dropped

Bad:

```
(the paper simply never appears)
```

Good:

```
Four eligible reports could not be retrieved: three paywalled
with no institutional access (DOIs in Appendix B), one available
only in Japanese. All four appeared eligible from their abstracts.
```

A named gap is a gap a reader can close. An invisible one reads as completeness.

### Annotated bibliography instead of synthesis

Bad:

```
Smith (2024) found X. Jones (2023) found Y. Patel (2025) found Z.
```

Good:

```
Lab evaluations report X (Smith 2024; Patel 2025); field
deployments report the opposite (Jones 2023; Okafor 2024).
The split tracks evaluation setting, not method.
```

A paragraph per paper leaves the reader to do the synthesis, which was the job.

## See also

- [`truth-first`](../truth-first/SKILL.md) - grounding individual claims in verifiable sources; this skill is its applied sibling, covering how the body of evidence was assembled
- [`technical-writing`](../../writing/technical-writing/SKILL.md) - structure and style for the write-up once the evidence is in
- [`python-pandas-analysis`](../../data/python-pandas-analysis/SKILL.md) - analysing the extraction table once the screening columns are filled
- [`grill-me`](../../workflow/grill-me/SKILL.md) - adversarial interrogation, useful for attacking your own search strategy before a reviewer does
- [`planning`](../../workflow/planning/SKILL.md) - breaking the review into checkable stages
- [`skill-authoring`](../../meta/skill-authoring/SKILL.md) - writing skills like this one

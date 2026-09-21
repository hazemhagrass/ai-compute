---
name: literature-review
description: Use when reviewing literature on a topic. Search systematically, record every query, screen in two passes.
---

Write the search protocol before running the first search. A literature review is reproducible when a stranger can re-run your queries and land on the same included set. Anything else is a reading list with citations attached.

This is the applied sibling of [`truth-first`](../truth-first/SKILL.md): that skill governs whether a single claim is grounded, this one governs whether a body of claims was gathered without bias.

## Rules for the search

### 1. Write the protocol before searching
Fix five things on paper first, because a protocol written after the results is just a description of what you happened to find.

- **Question**: one sentence, with population, intervention or exposure, comparator, and outcome where those apply.
- **Inclusion criteria**: study types, languages, publication venues you will accept.
- **Exclusion criteria**: stated positively so screening is a yes or no decision, not a judgement call.
- **Databases**: which ones, and why those cover the field.
- **Date range**: with a reason (a method was introduced, a standard changed, a prior review ended).

**Bad:** "Search for papers about retrieval-augmented generation and read the good ones."

**Good:** "Papers proposing or evaluating retrieval-augmented generation for question answering, 2020 to present (the RAG paper predates none of the target systems), English only, peer-reviewed venues plus arXiv preprints, excluding: no empirical evaluation, no retrieval component, survey-only."

### 2. Record the exact query string and hit count per database
An unrecorded search is not reproducible. Record verbatim: the database, the full query string including field tags and Boolean operators, any filters applied, and the number of hits returned.

**Bad:** "Searched PubMed for semaglutide and weight loss, found around 200 papers."

**Good:**

| Database | Query | Filters | Hits |
|---|---|---|---|
| PubMed | `(semaglutide[tiab]) AND (weight loss[tiab] OR obesity[MeSH])` | 2018-2026, English, RCT | 137 |
| Scopus | `TITLE-ABS-KEY(semaglutide AND (obesity OR "weight loss"))` | Article, English | 402 |

Hit counts drift as databases index new records, so note when the search ran. If your count and a reader's count differ by a few records, that is expected; differing by hundreds means the query was not what you wrote down.

### 3. Do not treat Google Scholar as a systematic search
Databases differ in what they index and in what you can control.

- **PubMed/MEDLINE**: biomedical and life sciences, with a curated controlled vocabulary (MeSH) that lets you search concepts rather than word forms.
- **arXiv**: preprints in physics, mathematics, computer science, and related fields. No peer review gate.
- **Scopus** and **Web of Science**: curated multidisciplinary indexes with citation graphs, so they support forward citation chasing directly.
- **Google Scholar**: broadest coverage including grey literature and theses, but the index contents are not published, results are personalised and ranked opaquely, Boolean support is limited, and it caps how many results you can page through. Two people running the same Google Scholar query can get different lists.

Use Google Scholar to find things the curated indexes missed, and to chase citations. Do not use it as your only source and then call the result systematic, because nobody (including you) can re-derive the result set.

**Rule**: search at least two independent indexes covering the field, and state why those cover it.

### 4. Chase citations in both directions
Database queries miss papers that use different vocabulary for the same idea. Citation chasing catches them.

- **Backward**: read the reference lists of your included papers.
- **Forward**: find papers that cite your included papers (Scopus, Web of Science, Google Scholar's "Cited by", or Semantic Scholar).

Record which papers entered through citation chasing rather than database search, because a review whose included set is mostly citation-chased is describing one research community, not a field.

### 5. Break the echo chamber
Citation chaining converges. A tightly co-citing cluster of authors will cite each other and no one else, and chasing citations inside it feels like thoroughness while it narrows your view.

Symptoms: the same five author groups appear on most included papers; every included paper cites the same foundational reference; no included paper contradicts another.

Counter-moves:

- Search a second vocabulary. The same construct is often named differently across fields (for example "churn" in business analytics versus "attrition" in clinical trials).
- Search a database from a neighbouring discipline.
- Look explicitly for null results, failed replications, and critiques, since positive findings are easier to publish and therefore easier to find.
- Check whether a Cochrane, PROSPERO-registered, or other prior systematic review exists and compare its included set against yours. Papers it included that you missed are a direct measure of your search's gaps.

## Rules for screening

### 6. Screen in two passes and record the exclusion reason
Pass one reads title and abstract only. Pass two reads the full text. Two passes keep cost proportional: you do not read 400 full texts, and you do not exclude a relevant paper on the basis of a badly written abstract.

Record one exclusion reason per excluded paper, drawn from your pre-declared exclusion criteria. "Not relevant" is not a reason, because it cannot be checked or disputed.

**Bad:** `Chen 2023 - excluded, not relevant`

**Good:** `Chen 2023 - excluded at full text: no comparator group (exclusion criterion 3)`

### 7. Report the PRISMA flow counts
PRISMA (Preferred Reporting Items for Systematic Reviews and Meta-Analyses) publishes a flow diagram and checklist for exactly this. Report the counts so the arithmetic closes:

- Records **identified** per database, plus records identified through citation chasing and other sources.
- Records **removed before screening**: duplicates, ineligible by automation filters.
- Records **screened** at title and abstract, and how many were excluded.
- Reports **sought for retrieval**, and how many could not be retrieved.
- Reports **assessed for eligibility** at full text, and how many were excluded, **with a count per reason**.
- Studies **included**.

Every number must reconcile: identified minus duplicates minus screened-out minus full-text-excluded minus not-retrieved equals included. If it does not reconcile, a paper was silently dropped somewhere.

### 8. Declare what you could not access
Silently dropping a paywalled or non-English paper biases the review in a direction you cannot estimate. List it.

**Bad:** (paper never appears anywhere in the review)

**Good:** "Four reports could not be retrieved: three behind publisher paywalls with no institutional access (DOIs listed in Appendix B), one available only in Japanese, which falls outside our language criterion. All four appeared eligible from their abstracts."

A named gap is a gap a reader can fill. An invisible gap looks like completeness.

## Rules for extraction and synthesis

### 9. Extract into a fixed table, one row per paper
Free-text notes per paper are not comparable. Fix the columns before extraction so that every paper is interrogated with the same questions, including papers you like.

Minimum columns:

| Column | Why |
|---|---|
| Citation key and DOI | Unambiguous identity, and the deduplication key |
| Venue and peer-review status | Preprint versus published changes the weight |
| Design | RCT, cohort, benchmark, case study, simulation |
| Sample or dataset, with n | The single strongest predictor of how much a result means |
| What was actually measured | The operationalised outcome, not the abstract's framing |
| Effect size with interval | Magnitude and precision |
| Comparator or baseline | An effect with no baseline is not an effect |
| Limitations stated by authors | Often the most honest part of a paper |
| Funding and conflicts | Declared interest is context, not disqualification |
| Exclusion or inclusion decision | Traceability back to the protocol |

### 10. Separate what a paper claims from what it measured
The abstract sells, the methods section reports. Extract from the methods and results, then compare against the abstract, and record the gap when there is one.

**Bad:** "Smith 2024 shows the intervention improves patient outcomes."

**Good:** "Smith 2024 measured 30-day readmission in a single hospital (n=412) and reports a reduction; the abstract's phrase 'improves patient outcomes' covers one proxy outcome at one site over 30 days."

Common gaps worth flagging: a surrogate outcome described as the clinical one, a single benchmark described as general capability, an association described in causal language, a subgroup result headlined as the main result.

### 11. Prefer sample size, effect size and interval over p-values
A p-value tells you how surprising the data would be under a null hypothesis. It does not tell you how big the effect is, and a small p-value from a large sample can accompany an effect too small to matter.

**Bad:** "The improvement was significant (p < 0.05)."

**Good:** "Mean difference 2.1 points (95% CI 0.3 to 3.9) on a 100-point scale, n=88 per arm. Statistically distinguishable from zero; the interval includes values too small to be clinically meaningful."

Record the interval even when the paper buries it. If a paper reports only a p-value and no effect size, that is itself an extraction finding worth noting.

### 12. Check preprint status and retractions
- Mark every preprint as a preprint in the extraction table. Preprints are legitimate evidence and are often the most current work in fast-moving fields, but they have not passed peer review, and the published version may differ.
- Check whether a preprint was later published, and if so, extract from the published version, because numbers change between versions.
- Check included papers against the Retraction Watch database and the publisher's page for retraction or expression-of-concern notices. Retracted papers keep accumulating citations, and citing one silently propagates a known error.

### 13. Deduplicate on DOI, not on title
The same paper arrives from three databases with three title spellings, differing author-name formats, and a preprint twin. Import everything into a reference manager (Zotero, Mendeley, or a BibTeX file under version control) and deduplicate on DOI first, since the DOI is a persistent identifier assigned to the record.

Then handle what DOI matching cannot: preprint and published versions carry different DOIs for the same work, so match those by title plus author plus abstract and keep the published one. Record the duplicate count, since PRISMA asks for it.

### 14. Synthesise into themes, not paper by paper
A paragraph per paper is an annotated bibliography. It leaves the reader to do the synthesis you were supposed to do.

**Bad:**

```
Smith et al. (2024) found X. Jones et al. (2023) found Y.
Patel et al. (2025) found Z.
```

**Good:**

```
Three of the seven included studies report X under
high-resource conditions (Smith 2024; Patel 2025; Liu 2025),
while the two field deployments report the opposite
(Jones 2023; Okafor 2024). The split tracks evaluation
setting rather than method: every lab study reports X and
no field study does.
```

Build themes from the extraction table's columns. Where papers disagree, say so and name the moderator (design, population, setting, measure) that explains the disagreement, or state that you could not identify one.

## Before you call the review done

1. Can a stranger re-run every query from what you wrote down?
2. Do the PRISMA counts reconcile to the included total?
3. Does every excluded paper have a reason drawn from a pre-declared criterion?
4. Is every preprint marked, and every included paper retraction-checked?
5. Are inaccessible papers listed rather than absent?
6. Does the synthesis organise by theme, with disagreements named?
7. Is every claim in the write-up traceable to a row in the extraction table?

If any answer is no, the review is not yet reproducible.

## When to use this skill

Use it when:
- Writing a systematic review, scoping review, or the related-work section of a paper
- Building an evidence base for a technical or clinical decision
- Answering "what does the research actually say about X?"
- Auditing someone else's review for search gaps

Skip it when:
- Reading for background or orientation with no claim to completeness
- Looking up one specific known paper
- The question is answerable from primary documentation rather than research literature (use `truth-first` instead)

# Systematic Web Research

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="systematic-web-research robot" width="150" />
</div>

Turn a vague question into an answer you can defend, by making the question
answerable, ranking sources before reading them, and verifying at the cited
page rather than trusting a summary.

## What it does

Turns "I found this online" into "here is the source, here is who published
it, here is when they said it". The skill covers the mechanical craft of web
research:

1. **Rewrite the question.** A vague question gets a rewrite that names the
   variable, the timeframe, and the deliverable before the first search.
2. **Rank sources.** Primary (official docs, filings, papers, code) beats
   secondary (journalism, engineering blogs) beats aggregation (SEO
   listicles). Read in rank order, not search-result order.
3. **Triangulate.** Claims that drive decisions need two independent sources.
   Independent means separate origin, not two URLs quoting the same release.
4. **Spot circular reporting.** Most pages about a fast-moving topic are
   humans paraphrasing each other with zero new evidence; follow the citation
   graph to the earliest record instead.
5. **Extract the real claim and date.** Headlines are marketing text. Get the
   sentence that is the claim and the date attached to that sentence.
6. **Use search operators with limits understood.** `site:`, `"exact
   phrase"`, `-term`, `filetype:`; they narrow, never widen, and never
   guarantee absence means nonexistence.
7. **Treat paywalls legally.** Preprints, author copies, archive links,
   abstracts; never a paid wall's content by technical bypass.
8. **Record provenance while reading.** URL, access date, quote location,
   claim, source type, captured at discovery time.
9. **Synthesise.** Answer the question once, using sources as evidence, not
   by stacking paraphrases of each source in sequence.
10. **Separate conflicting sources by diagnosis.** Find why two sources
    disagree before choosing one.

The goal is avoiding the failure where a confident-sounding answer turns out
to be three headlines stacked together, none of which the reader can verify.

## When to use this

Use it when:

- Answering a question "how does X work" that lives outside your own code
- Comparing products, libraries, tools, or techniques on real evidence
- Looking up a statistic, a price, a standard, or a legal requirement
- Fact-checking a draft before it ships to a real audience
- Writing a report or doc that cites more than two external sources
- Verifying something an AI summary told you, before repeating it

Skip it when:

- The answer is in your own repo or own code. You are the primary source.
- The question is a design or preference choice, not an external fact.
- Exploring a new topic casually to build a mental model, i.e. not writing
  anything that will be read and trusted later.

## Quick start

Example: someone asks you to find out whether feature-gating library A or
library B is the right choice. Rough sketch:

**Step 1: make the question answerable.**

```
Which of A and B has the most recent release (per their official repo
release page), supports our feature flags via SDK, and documents a
supported version until when?
```

**Step 2: rank the sources before reading.**

| Rank | Source | Why |
| --- | --- | --- |
| 1 | The repos' own releases pages | Primary: they publish the fact |
| 2 | Official docs on feature flag support | Primary |
| 3 | Each project's maintainer blog | Secondary |
| 4 | Aggregator "A vs B" listicles | Last resort, chasing links up only |

**Step 3: run the search with operators.**

```bash
# release recency
site:github.com "releases" "YourRepoA"
site:github.com "releases" "YourRepoB"
# feature flag support in real docs, not roundup blog posts
site:yourrepo.com "feature flag"
```

Note the operators narrow, they do not guarantee. Union with a source-code
search and a plain search before concluding something does not exist.

**Step 4: extract the actual claims and dates.** Not headlines; sentences.

```
Claim: SDK supports Stripe checkout (docs, version 4.2, page "Payments")
Date:  published date, last-updated date
Origin: yourrepo.com/docs/payments (primary)
```

**Step 5: triangulate anything decision-carrying.** One source is fine for
trivia. A claim that decides the pick of a library needs two independent
origins. If both texts cite the same release note, that is one source, not two.

**Step 6: record provenance as found, not later.**

| URL | Accessed | Quote location | Claim | Type |
| --- | --- | --- | --- | --- |
| `https://.../releases` | accessed date | recent release notes | Adds Stripe SDK | primary |

**Step 7: stop when the answer is load-bearing-ready.**

Every claim that drives the recommendation has a primary source. The only
unknowns are genuinely not-public ones, named and separated. Draft.

## Key concepts

### Source hierarchy

1. Primary: the record that creates the fact (repo, filing, docs, paper)
2. Secondary: analysis of that record (journalism, engineering blogs)
3. Aggregation: restatement of secondaries (listicles, roundup posts)

Aggregators are a tool for finding primaries, not for sourcing facts.

### Circular reporting

When every page in the result list repeats the same paragraph, the citable
origin sits behind the first link in the chain. Follow that link, cite the
earliest record, and treat rewrites as signposts rather than evidence.

### Triangulation

Two sources count as independent only when they have separate origins. Two
news sites quoting the one press release are one source in two locations.

### Provenance

The citation that lets a reader act later: URL, accessed date, quote
location, claim, source type. Recorded during reading, never reconstructed.

### Stopping point

Finish when the load-bearing claims are all verified at a primary source or
two independent origins, and further effort is not adding information.

### Synthesis

Give the answer once, then show the evidence. Not a list of source-by-source
paraphrases stitched together with "additionally".

## Common pitfalls

Each entry shows a bad pattern, its good replacement, and the reason.

### Citing an aggregator
- Bad: According to a roundup, the library processed XML 3x faster.
- Good: The library's own benchmark page reports 3x over stdlib (benchmark.md, method B, version 4.2, accessed today).
- Reason: aggregators restated a source nobody can check anymore. Cite the primary record with its own identifier so a reader can verify in one click.

### Treating two URL copies as two sources
- Bad: Two articles say it, so it is confirmed.
- Good: The first article cites the announcement; the second links the same press release that the first summarized. That is one origin, so I need an actually independent confirmation or accept this as single-source for now.
- Reason: correlation is not independence. Two restatements of the same press release will agree by construction and provide exactly zero added confidence.

### Trusting an AI summary at face value
- Bad: The tool uses a PostGIS backend (per the AI overview).
- Good: The project's README confirms a PostGIS extension [link], accessed today.
- Reason: AI summaries are drafts restated from sources no one re-read in the chain, so what they imply often turns out to differ from what the source says. Follow the link to the original and cite that.

### Reading the headline instead of the claim
- Bad: Headline: "Database X failed hard in recent benchmarks!"
- Good: Article's actual reported result: on the streaming workload only, X trailed Y by 12% p99 latency; on batch workloads X led. Sample of 5 node types, the stated publish date.
- Reason: headlines are written to attract clicks and regularly invert or flatten the nuanced result further down; the sentence that is the claim sits later in the same page and usually has qualifiers and dates attached.

### Writing provenance after the fact
- Bad: I saw this somewhere in that report, will look up the page after I ship.
- Good: Recorded now while reading: URL, accessed today, section 2.3 table 4, claim quoted verbatim, type primary.
- Reason: provenance reconstructed later is full of wrong sections and vague locations, and post-hoc attempts to fill gaps produce plausible-looking details that never existed; record it while you still know where it was.

### Researching past the point of usefulness
- Bad: One more search, probably something better will turn up.
- Good: All load-bearing claims have two independent origins. Known gaps are named and marked not-publicly-available; the deliverable no longer waits on further searches.
- Reason: once the claims that drive the decision are verified, extra searches add time and hedge words, not information; the marginal page usually repeats a source already read or clears a gap that was not blocking.

### Falling back on paywall bypass
- Bad: The article is behind a paywall, so I disabled JS and screenshotted it.
- Good: The paper's preprint is on arXiv [link]; the author copy is on their host; and the abstract itself settles the figure I needed, so I cite the abstract directly.
- Reason: bypassing a paywall breaches terms and copyright, and it is rarely necessary because the same finding almost always exists through a legitimate path if you check the preprint or author copy first.

### Paraphrasing sources in sequence instead of synthesising
- Bad: Source A says latency 12ms. Additionally, source B says latency 18ms.
- Good: Latency answers differ by workload: bulk inserts favor option B (18ms p99, Source B table 3), point reads favor option A (12ms p99, Source A section 2). Both sources benchmarked; neither tested the other's dominant workload.
- Reason: the serial paraphrase stacks two claims that are each true on different workloads and lets a reader draw them as one contradicting finding, while a synthesized answer compares them and surfaces precisely which workload decides the choice.

### Searching once and concluding absence
- Bad: I searched for the paper and found nothing, so it does not exist.
- Good: Nothing came back under the narrow query. I tried the same phrase without quotes, then inurl: parameter variants, and a source-code and repository search; still nothing, so the finding is "nothing publicly available at this time".
- Reason: absent from one query's index is not the same as nonexistent; search operators filter heavily and a first page's index is a shallow slice, so absence claims require several independent routes before they are evidence.

## See also

Sibling skills in `skills/research/`:

- [`truth-first`](../truth-first/SKILL.md) - ground every claim
  in a verifiable source and mark inference; pairs with this skill, which
  covers how to reach the source in the first place
- [`citation-manager`](../citation-manager/SKILL.md) - manage a
  bibliography and verify each entry actually exists and says what is cited
- [`literature-review`](../literature-review/SKILL.md) - structure
  the broader review of many papers, where the null result matters
- [`survey-design`](../survey-design/SKILL.md) - design the
  questionnaire that produced the primary data being cited downstream
- [`technical-writing`](../../writing/technical-writing/SKILL.md) - present
  the synthesized findings in a doc readers can navigate

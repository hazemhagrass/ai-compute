---
name: systematic-web-research
description: Use when web research needs verified, defensible answers.
---

# Systematic Web Research

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="systematic-web-research robot" width="150" />
</div>

Turn a vague question into a researchable one, gather evidence from sources
that deserve their authority, and stop at the point the answer is actually
known. The failure this skill prevents is confident paraphrase: an answer
assembled from headlines and AI summaries that nobody has verified at the source.

## Make the question answerable

A vague question produces vague research, and vague research produces an
answer that pleases nobody. Before searching anything, rewrite the question
until it names a variable you can go measure or look up.

| Vague | Answerable |
| --- | --- |
| Is library X good? | What are X's open issue counts, last release date, and license? |
| How do teams handle retries? | What do at least three documented retry policies specify for backoff intervals? |
| Is this market growing? | What is the reported year-over-year revenue figure from the last three public filings? |

Bad:

> Research the state of the art in text extraction.

Good:

> Which of these five text extraction libraries hold the top three
> positions on the benchmark table dated within the last year, and what
> accuracy do the tables report?

Rules:

- Name the thing to measure, the timeframe, and the deliverable.
- If the answer will be a number, say who publishes the number.
- If the answer will be a comparison, name the axes you compare on.

## Source hierarchy: primary wins

Rank every source before reading it, then spend reading effort in rank order.
A source is primary when it is the thing that makes the claim (official docs,
source code, a filing, a research paper, a firsthand statement). Secondary
sources interpret primaries: journalism, engineering blog posts, textbook
chapters. Aggregation layers (SEO listicles, dev.to roundups, "top 10"
pages) only restate secondaries.

Consequences:

- Never cite an aggregator for a fact; use it only to discover primaries.
- A secondary source earns quoting for its analysis, not for the underlying
  fact. Chase the fact back up to the primary.
- When a primary and all secondaries disagree, believe the primary and
  record why the secondaries got it wrong (usually: they are stale).

## Triangulate claims that matter

A claim that will drive a decision needs two independent sources. Independent
means separate origin, not just two URLs: two news sites quoting the same
press release are one source wearing two hats.

| Claim type | Needed sources |
| --- | --- |
| Opaque trivia (a product's release year) | One primary |
| A number that will drive a decision | Two independent |
| A technical claim others will act on | Two independent, one primary |
| A contested or surprising claim | Two independent, one primary, both dated |

If two sources disagree, do not average them: find out why (below).

## Detect circular SEO reporting

Most search results for a fast-moving topic are a chain of rewrites with no
added evidence. Spotting the loop is cheaper than reading it.

Signs a page is circular:

- It cites "according to reports" or "a recent study" without a link, or
  links to another rewrite.
- Several pages in the result list share the same sentences verbatim.
- The page's only citation is another SEO page, not an original record.
- The claim's date on the page is later than the event it describes and no
  original timestamp appears anywhere.

Bad practice:

> Find five articles stating the claim and call it verified.

Good practice:

> Follow the citation graph to its first link. Cite the primary record
> (press release, filing, dataset, repo) and name each intermediate page
> only if its wording added something the primary did not say.

## Extract the actual claim and its date, not the headline

Headlines are written to be clicked, not distributed as evidence. When reading
a page, write down the sentence that is actually the claim, the number that is
actually the measurement, and the date attached to both.

For a page, capture:

1. The exact claim sentence (quote it, do not paraphrase yet).
2. The publication or last-updated date of that sentence, not of the site.
3. Who said it: author, institution, or source quoted.
4. Whether the number is measured, projected, estimated, or copied.

Example of the difference:

| From a headline: | From the article: |
| --- | --- |
| "AI is eating software engineering!" | "Adoption reached 41% among surveyed firms, up 6 points; margin of error 3, n=2100" |

If the headline claims the article cannot support, the headline is not the
claim. Discard the headline version.

## Search operators that still work

Operators remain useful but none guarantees coverage; use them to narrow,
never to widen, and never assume absence means a result does not exist.

| Operator | Working use | Known limit |
| --- | --- | --- |
| `site:example.com` | Restrict to one domain | Misses other hosts of the same content |
| `"exact phrase"` | Locate a specific sentence or API name | Over-narrow; try loosening quotes |
| `-term` | Remove noise (e.g. `-pinterest` for recipes) | Only filters that one engine's index |
| `filetype:pdf` | Find the actual paper, filing, or manual | Skips HTML equivalents of the same doc |
| `inurl:` | Find parameterised docs endpoints | Fragile; not all engines honor it |

Bad:

> Search "best database" and take the top hit.

Good:

> Search `"connection pool" -site:pinterest.com site:postgresql.org`,
> then also search the same phrase on the official docs and on the
> source-code search engine; union the results before reading.

## Paywalled sources: legal paths first

A paywall is a distribution decision, not a permission slip. Routes before
giving up:

| Route | When it works |
| --- | --- |
| Preprint (arXiv, bioRxiv, SSRN) | Academic papers; adjacent versions exist |
| Author copy on their employer or personal site | Often published with the same findings |
| Archive links (Wayback Machine, archive.today) | Older news pages already archived |
| Widely available abstract or exec summary | If the claim is summarized, cite the abstract |
| Request from the author or rights holder | For a clearly non-commercial use |
| Cite the paywalled source without quoting | Last resort; state what you could not read |

Never: bypass a paywall, scrape behind auth, or republish restricted content.
Also never: silently cite a paywalled title you did not read, on the strength
of someone else's summary of it. Say "I could not access; I am citing the
abstract" and move on.

## Record provenance as you go

Provenance is not a footnote bolt-on; it is written while reading. For every
claim that survives into the answer, keep five fields:

| Field | Example |
| --- | --- |
| URL | `https://example.org/report-2025` |
| Date accessed | `YYYY-MM-DD` |
| Quote location | `§ 2.3, table 4` |
| Claim | "Median latency dropped 30ms post-migration" |
| Source type | primary / secondary / aggregation |

Where to store it (any of these): a scratch file with one line per claim, the
answer's own footnotes section, or a structured notes table if the task
inherits one.

Rules:

- Record when you find it, not later. Later you will not remember the section.
- If you paraphrase, keep the quote too; paraphrase drift is invisible without it.
- If a link might rot, save the page text or archive URL alongside.

## Know when to stop

Stop when the answer carries its answer-weight, or when further effort yields
less than it costs. Concrete stop signals:

- Every load-bearing claim has two independent sources or one solid primary.
- You can name the best available source for each open question.
- Adding more hedges changes no recommendation and no number.
- You have reached the same top three pages via three different routes.
- The remaining gaps are known-invisible (nothing public exists).

Bad:

> One more search, maybe something better turns up.

Good:

> Claims are backed, unknowns are named; stop and draft.

If a gap blocks the deliverable, move to the next task that unblocks it (a
different source, an interview, a paid archive) rather than looping the same
search.

## Synthesise, do not serially paraphrase

The serial-paraphrase trap: rewrite source one, rewrite source two, glue with
"additionally". The result reads as a list at best and contradicts itself at
worst. Synthesis means answering the original question using sources as
evidence, letting them argue where they argue.

Bad:

> Source A says X. Source B says X. Source C says a similar thing.

Good:

> So the answer depends on which workloads dominate: for read-heavy jobs
> measured latency favors X (Source A measured 12ms p99), while write-heavy
> patterns show Y pulling ahead (Source B benchmarked 18ms p99 on bulk
> inserts, see table 3). The two disagree on what "dominant workload" means,
> which is the thread to pull in section 3.

Steps for producing a synthesized answer:

1. State the question as a question.
2. Give the answer in one sentence before any citation.
3. Show the evidence that drove that sentence, with each claim's origin.
4. Note where sources disagreed and what you concluded about the disagreement.
5. Name what remains genuinely unknown and what would resolve it.

## Handle contradictions by finding why they disagree

Two credible sources disagreeing is information, not noise. Diagnose before
choosing a side:

| Kind of disagreement | What to check | Likely conclusion |
| --- | --- | --- |
| Different dates | Publication date of each | Stale data, cite the newer |
| Different units or scope | What each measured | Both right, express both |
| Different populations | Sample frame | Both right, clarify which none applies |
| One cites the other or shares origin | Source chain overlap | Not independent, need a real second |
| Different method | Methodology section | Name the better method for this question |
| Pure factual conflict | What the primary record says | Believe the primary |

Example:

> Source A reports 30,000 users; Source B reports 5,000. Both cite the
> company. A quotes last quarter's investor letter; B quotes the app
> store listing. The first figure is the business metric, the second the
> install base. Say both, distinguish them.

## Verify AI and search summaries at the cited source

AI answers and search-generated summaries assemble text from sources nobody
in the loop has re-checked. They are drafts, not citations.

Rules:

- AI summary text is never a source; get the original pages it cites.
- Search-engine featured snippets strip context and often merge dated info
  from different pages; verify the underlying page and its date.
- If an AI summary cites 8 references and you only open 3, reopen the
  missing 5 or say which claims rest on unverified references.
- AI summaries frequently combine an old figure with a new claim and present
  both as current; date each claim independently.

Bad:

> Use the AI-generated summary as the answer.

Good:

> Where a summary led, follow the link it displayed, read the underlying
> page, and quote the source, not the summary; if the source does not
> exist or does not say what the summary implied, flag the summary as
> unusable and re-search manually.

---
name: blog-post-writer
description: Use when writing a blog post. One idea per post, earn every scroll.
---

# Blog Post Writer

Write posts that a reader chosen at random would finish. Every rule here
exists because a real post failed without it. The skill covers blog posts
only: tutorials, opinion pieces, and explainers. It does not cover
documentation (use `technical-writing`), newsletters, or social copy.

## One idea per post

A post makes exactly one claim and finishes it. Two ideas share one post
poorly: both get less depth than they need, and the reader who came for one
is filtered out by the other. If a second idea appears while outlining, cut
it and give it its own post.

Before drafting, state the idea in one sentence that a stranger could repeat
the next day. If you cannot, the post does not have one yet.

Bad:

> How we migrated our stack to event-driven architecture and what we learned
> about team autonomy along the way.

Good:

> Event-driven architecture pushed decision-making from the platform team
> into the service teams, and that is the real migration.

## The headline states the value

The headline is a promise the first paragraph must pay. Name what the reader
gets or learns, in plain words, without bait.

Bad:

> You Won't Believe What Broke Our Production Database

Good:

> An unindexed `tenant_id` column took our database down. Here is the query
> plan, and the check that would have caught it.

## The intro earns the scroll

Put the problem in the first two sentences: what was happening, and what
went wrong or what the reader wants. A reader who does not feel the problem
by the second sentence leaves.

Bad:

> In this post we will explore the fascinating world of database
> performance tuning, touching on indexes, query planners, and more.

Good:

> Orders checkout at 150ms at 9am and 9 seconds at noon. Nothing changed in
> the code. The difference is an index the noon traffic pattern stops using.

## Outline before prose

Write the section headings, thinking through the argument from idea to
conclusion, before writing any paragraph. A post written straight through
wanders. The outline:

1. Problem (two sentences) and why the reader should care.
2. The idea, stated concretely, with the smallest example that shows it.
3. The steps, evidence, or arguments, one section each.
4. The section where the honest limitation lives.
5. The "so what": what the reader does differently tomorrow.

## Examples and code over adjectives

"Fast", "powerful", "clean" convey nothing; the reader cannot verify an
adjective. Show the thing.

Bad:

> Our new caching layer is blazingly fast and dramatically improved
> performance.

Good:

```python
# Before: 4 sequential API calls, 1.2s total
profile  = api.get(f"/users/{uid}")
settings = api.get(f"/users/{uid}/settings")
plan     = api.get(f"/users/{uid}/plan")
badge    = api.get(f"/users/{uid}/badge")

# After: one batched call, 310ms total
data = api.get(f"/users/{uid}/bundle")  # returns all four in one round trip
```

A code sample must run, or be honest about standing in for something: show
imports, real values, and the shape of the output. Never annotate code the
reader cannot map to their own work.

## The "so what" test at every section end

When a section ends, ask: could a reader skip this section and lose
anything? If yes, the section's takeaway is missing. End each section with
the consequence the reader carries forward, not a summary of what was just
said.

Bad:

> As we have seen, cache invalidation involves several tricky
> considerations.

Good:

> Scope the invalidation key to the tenant, or one customer's import wipes
> every other customer's cache.

## Short paragraphs, concrete nouns

Paragraphs of at most four lines. Nouns the reader can picture run over
nouns they cannot: write "query planner" not "the internal cost-based
optimization subsystem". Abstract nouns stack into sediment no one re-reads.

Bad:

> Our infrastructure utilization optimization initiative leverages
> cutting-edge orchestration paradigms to enhance operational efficiencies.

Good:

> Autoscaling cut idle costs by 40 percent. Same fleet, same load.

## Fact-check your own claims before publishing

Every number, version, benchmark, and API signature in the draft gets
checked against its source before the post ships. A confident wrong number
in a published post is the kind of thing readers quote for years.

- A benchmark claim needs the environment named: hardware, dataset size,
  date. A number without an environment is a rumor.
- A version claim gets re-read from the docs the day of publishing, not
  from memory. APIs change silently between minor releases.
- A quote gets checked against its original source, not the tweet quoting it.
- A claim you cannot source gets cut or marked as an estimate ("in our
  staging cluster, roughly").

## Choose the form and do not blend

Three forms, three different structures. Decide before outlining.

| Form | Reader's question | Shape |
| --- | --- | --- |
| Tutorial | Can I do this after reading? | Prerequisites, numbered steps, working result, troubleshooting |
| Explainer | Do I understand this now? | Problem, mechanism, worked example, where it fails |
| Opinion piece | Is this argument sound? | Claim, evidence, counterargument, what changes your mind |

A tutorial that drifts into opinions mid-lesson abandons the one reader
actually trying to follow along. An opinion piece that slides into steps
dilutes the claim. When both are wanted, the second form is the next post.

## Edit after the draft sleeps

A post published reread-once keeps its first-pass reasoning: the writer
read what they intended to write, not what the screen says.

1. Finish the draft, walk away, sleep on it, reread cold.
2. Fix structure first: order of sections, missing "so what" lines.
3. Cut 10 percent. Sentences that repeat the idea exist to fill silence.
4. Read the whole draft aloud. Whatever you stumble over, the reader
   stumbles over too.
5. Read only the first two sentences of each paragraph, and check the
   skimming reader still tracks the argument.

## SEO without writing for the crawler

Search traffic arrives when the post answers a question people actually
type. That is the whole mechanism. Write the answer well and the SEO
follows; write for the crawler and the post gets worse for readers and for
rank both.

- One clear topic per post beats keyword stuffing: the post about one
  question outranks five posts circling it vaguely.
- Descriptive headings of what the reader is asking beat clever puns.
- Meta description: the post's own first two sentences, trimmed.
- Never degrade a heading, a sentence, or a stack of code with a keyword
  the reader did not ask about.

## Images earn their width

An image whose alt text is decoration ("image", "diagram of our idea")
stops a screen reader and fills a search bot with noise. Every image:

- carries alt text a listener can navigate by: what the image shows and
  why it is there, or an attribute of the real content (chart axes, table
  rows);
- is the smallest image that carries the point, not the full screenshot
  with dead space;
- gets referenced by the surrounding prose. An image the text does not
  mention is a random image.

Bad:

> `alt="screenshot"` next to a 4000px screenshot of a dashboard.

Good:

> `alt="Latency graph showing p99 rising from 150ms to 9s at noon, matching
> the cron window"` next to a crop of just that chart.

## Quick checklist

- One idea, stated in one sentence a stranger could repeat.
- Headline promises, intro pays within two sentences.
- Outline approved before any paragraph written.
- Each section's "so what" is on the page.
- Every number, version, benchmark re-checked the day of publishing.
- Form chosen: tutorial, explainer, or opinion piece, and not blended.
- Draft slept on, 10 percent cut, read aloud.
- Every image carries instructive alt text.

## See also

- `technical-writing` for the sibling skill when the artifact is
  documentation rather than a post: same concrete specificity, a reader who
  is stuck rather than a reader who is curious.
- `truth-first` for the fact-checking habit this skill compresses into one
  section.
- `systematic-web-research` for verifying claims and sources about things
  too current to know from memory.
- `presentation-design` when the post's argument will also become talk
  slides.
- `review-comment-phrasing` for the bad/good pairing habit this skill
  borrows throughout.

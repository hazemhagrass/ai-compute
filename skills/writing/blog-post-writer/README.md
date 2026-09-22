# Blog Post Writer

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Write blog posts a reader chosen at random would finish: one idea per post,
the problem stated in the first two sentences, facts checked before they
ship. This folder holds two files, `SKILL.md` for working sessions and this
README for the overview.

## What it does

Applies a fixed set of rules to any blog post you draft, outline, or review.
Each rule exists because real posts fail without it, and each pairs a bad
pattern with a good one so a draft can be matched against it rather than
reasoned about.

| Rule | Prevents |
| --- | --- |
| One idea per post | Two half-developed thoughts crowding each other out |
| Headline states the value | Bait the first paragraph cannot pay back |
| Intro names the problem in two sentences | Readers gone before they had a reason to stay |
| Outline before prose | A post that wanders into a second idea mid-argument |
| Examples and code over adjectives | "Fast" and "powerful" standing in for evidence |
| The "so what" test at each section end | Sections the reader finishes and forgets |
| Short paragraphs, concrete nouns | Abstract noun stacks nobody re-reads |
| Fact-check before publishing | A wrong number getting quoted for years |
| Choose the form, do not blend | Tutorial steps drowned in opinion |
| Sleep, reread, cut 10 percent | First-pass reasoning published as-is |
| Images with real alt text | Decoration injected into screen readers |

## When to use this

- Drafting a post on your own blog or a company blog.
- Turning a talk, a post-mortem, or a benchmark run into a post.
- Reviewing someone else's draft and needing concrete feedback rather than
  taste.
- Deciding a mass of material needs to be one post or two.

Do not use it for API reference or operational docs (that is
`technical-writing`), marketing copy, newsletters, or social threads. The
form's contract, "one reader, one idea, one post", does not transfer.

## Quick start

You have a benchmark result and a rough sense of two ideas it could support.
Start here.

1. State the one idea in one sentence a stranger could repeat the next day.
   Anything that does not serve that sentence goes to a second post.
2. Pick the form: tutorial, explainer, or opinion piece.
3. Write section headings in order, problem to "so what", before any
   paragraph.
4. Draft. Every claim about speed, correctness, or cost gets code, a
   number, or a table.
5. Sleep. Reread cold. Cut 10 percent. Read aloud.
6. Fact-check every number, version, and API name against its source on the
   day of publishing, then ship.

## Key concepts

**One idea per post.** Not one topic: one sentence about that topic. The
migration post is not "how we went event-driven and what it taught us about
teams"; it is "going event-driven moved decisions into the service teams".
The second idea is the next post, not the second half of this one. Depth on
a single claim beats coverage of a shared surface area.

**The scroll is earned.** A reader arrives with nothing invested. The
headline states what they get; the first two sentences state the problem
they feel. Only after both are paid does the post have the right to ask for
a third screen. Everything in the outline that delays the problem or
delivers it late gets cut there.

**Adjectives are not evidence.** "Fast", "clean", and "powerful" transfer
nothing. A code sample, a number with its environment, or a table transfers
something checkable. The reader should be able to disagree with a sentence;
that is when it carries information.

**The "so what" is on the page.** Every section ends with what the reader
carries forward, not a recap. If a section could be skipped without losing
anything, either the takeaway is missing or the section is.

**The form is a contract.** A tutorial promises the reader can follow along,
an explainer promises understanding, an opinion piece promises an argument
with its counterargument faced. Blending two forms breaks the one being
read. Outline in the chosen form's shape and keep the count at one.

**The sleep between drafts.** Fresh off writing, a writer reads intention,
not text. Sleeping on the draft, cutting 10 percent, and reading it aloud
are the three cheapest edits available and they catch structural problems
no pass of the same day catches.

## Common pitfalls

### Two ideas sharing one post

Bad:

> A post titled "What we learned rewriting our ingestion pipeline" that is
> half a tutorial on the new pipeline and half opinions about team structure.

Good:

> Two posts. First: the pipeline rewrite as a tutorial, steps in order,
> working result. Second: what the rewrite changed about who makes
> decisions, as an opinion piece with its counterargument.

The tutorial reader leaves at the first digression; the opinion reader
already knew the pipeline. Both formats write worse together.

### The adjective paragraph

Bad:

> Our rewrite made the system much faster, cleaner, and far more robust
> than before, delivering a dramatically improved customer experience.

Good:

> Before: p99 checkout latency of 9s at noon. After: 300ms, same load,
> measured over the same week. The rewrite removed one index scan per
> request.

The reader can argue with numbers. They cannot argue with "much faster",
which means they stop trying.

### The skipped "so what"

Bad:

> Ending a section with "Cache invalidation involves several tricky
> considerations." The reader nods and moves on, nothing gained.

Good:

> Ending it with "Scope the invalidation key to the tenant, or one
> customer's import wipes everyone's cache." The reader now knows one thing
> they will look for in their own code tomorrow.

A recap repeats. A "so what" converts. If a section cannot produce one, it
is a section that should not exist.

### The number without an environment

Bad:

> "Our new cache layer is 40x faster." No hardware named, no dataset size,
> no date. A reader cannot compare it to anything, including their own
> workload.

Good:

> "40x on the current staging cluster (8 vCPU, 32GB RAM, 5M-row customers
> table). Your numbers will differ; the shape of the win is what
> transfers."

The first version arrives confident and leaves unverifiable. The second
arrives falsifiable, which is what makes it credible.

### The alt text as decoration

Bad:

> `alt="screenshot"` on a full-page screenshot of a dashboard.

Good:

> `alt="p99 latency rising from 150ms to 9s at noon, matching the cron
> window"` on a cropped chart of just that span.

The first version injects noise into every screen reader passing through
and tells a search bot nothing. The second tells a listener what the image
is for and lets the post survive without images rendering at all.

## See also

- [`technical-writing`](../technical-writing/SKILL.md) for the sibling
  skill when the artifact is documentation the reader is stuck in, not a
  post they are curious about.
- [`truth-first`](../../research/truth-first/SKILL.md) for the fact
  discipline behind the fact-checking rule.
- [`systematic-web-research`](../../research/systematic-web-research/SKILL.md)
  for verifying claims about things too current to know from memory.
- [`presentation-design`](../../design/presentation-design/SKILL.md) when
  the post's argument will also become talk slides.
- [`review-comment-phrasing`](../review-comment-phrasing/SKILL.md) for the
  bad/good pairing habit that most sections above borrow.

# YouTube SEO Optimizer

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for packaging YouTube videos for search and recommendations: titles, thumbnails, descriptions, chapters, tags, and reading Studio analytics honestly. Use it when preparing an upload or when a creator asks why a video is not performing.

## What it does

| Input | Rule |
| --- | --- |
| A draft title | States the value in the first half and still reads after truncation. |
| A thumbnail brief | Carries the promise and does not repeat the title's words. |
| A description | Opens with a plain-language answer, then chapters with timestamps. |
| A tag list | Treated as a weak signal, useful mainly for misspellings. |
| A Short versus a long-form video | Different surfaces, different behavioural claims, no cross-format number comparisons. |
| A Studio metrics report | Click-through rate and average view duration read together, never alone. |

Every platform-behaviour claim in the skill is written as "commonly reported,
verify against current platform documentation". YouTube's guidance changes
without notice, so the skill never states a signal weight, a hard keyword
count, or a fixed ranking rule as if it were permanent.

The skill is prescriptive, like the other writing skills in this repo: a
bad/good pair for each rule, each bad example annotated with the failure it
exhibits.

## When to use this

- Writing or revising a title, thumbnail brief, description, or chapter list
  for a video before upload.
- Reviewing the packaging of an existing video whose impressions or
  click-through rate look wrong.
- Interpreting a YouTube Studio report without over-reading it.
- Deciding whether a topic belongs in a Short or a long-form video.

Do not use it for: growing a channel through paid ads or external promotion,
thumbnail visual design craft (see the design skills), or scraping competitor
channels. Those are different problems, and this skill does not cover them.

## Quick start

You have been asked to optimise the packaging for a Postgres tutorial video.
The draft, the review, and the result follow.

### Before

```text
Title:      You WON'T BELIEVE this database trick !!
Thumbnail:  Red arrows, huge text "POSTGRES RLS", shocked face
Description: hey guys welcome back!! don't forget to subscribe.
             in this video we talk about some database stuff.
Tags:       postgres, sql, database, viral, trending, new, 2026
```

Failures: the title states no value and shouts, the thumbnail repeats the
title verbatim onto noise, the description has no searchable first line and
no chapters, and the tags are chasing a strategy that is not there.

### After

```text
Title:      Postgres row-level security: a working setup you can copy
Thumbnail:  Screenshot of query results, small overlay text "it works"
Description: How to set up row-level security in PostgreSQL so users
             only see their own rows. Full working SQL below.

             0:00 The problem row-level security solves
             3:12 Creating the policy
             9:40 Testing it as three different users
             14:05 Common mistakes
Tags:       postgresql row level security, posgres rls
```

What changed: the title names the topic and the payoff, the thumbnail and the
title now divide work instead of duplicating it, the description leads with
the answer a searcher wants, and the only tag strategy is covering a common
misspelling.

## Key concepts

**Searchable first paragraph.** The part of the description shown before
"more" doubles as search-relevant text. Write it as what the viewer will
learn, in words they would search for. Channel greetings and subscribe asks
waste the strongest line of the description.

**Chapters as second search surface.** Chapter lists with timestamps give the
viewer navigation and name segments with searchable wording. Manual chapters
override anything the platform generates on its own.

**The title-thumbnail pair.** The thumbnail shows the promise, the title
gives the precision. Designing either after the other is locked wastes half
the impression.

**Signals read as a chain.** A high click-through rate with a low average
view duration means the packaging overpromised. A low click-through rate with
a high average view duration means the packaging undersold the content. One
metric alone cannot tell you which fix applies.

**Weak signals deserve weak effort.** Tags are officially minimal. Spend the
hour on the first thirty seconds of the video instead.

**Honesty protects reach.** Engagement bait earns clicks that exit fast, and
that behaviour pattern damages the video's next impression round. Misleading
titles are the most expensive short-term trick on the platform.

## Common pitfalls

### Reading one metric alone

Bad:

> Video has a 2 percent click-through rate. The packaging is bad.

Good:

> 2 percent CTR on a small impression count, with above-average view
> duration, and most impressions from Home. Read as an audience match issue,
> not a packaging one. Compare within a similar video size before changing
> anything.

### Writing descriptions nobody searches

Bad:

> hey guys, back with another banger! smash that like button.

Good:

> Three ways to recover a deleted git branch, fastest first. Includes the
> case where the commit was never on any branch.

### Duplicating thumbnail and title

Bad: thumbnail text "BEFORE AND AFTER" on a title "Before and after my
studio setup".

Good: thumbnail showing the messy setup, title "Studio setup: what I would
buy again".

### Chasing tag lists

Bad:

> Spent two hours finding 30 tags for a video.

Good:

> Five minutes of tags covering misspellings and a couple of alternate
> phrasings, then the hour saved went into re-recording the opening 30
> seconds.

### Comparing a Short to a long-form video

Bad:

> The Short got 40 thousand views and 30 second watch time, the long-form
> video got 8 thousand views and 6 minute watch time. The Short won.

Good:

> Those numbers measure different surfaces, and neither format is a
> substitute for the other. Decide from what the topic needs: a single idea
> that stands alone is Short material; a topic a viewer studies and revisits
> is long-form material.

## See also

- [title-thumbnail pair rules and full description template](./SKILL.md) in this skill for the detailed bad/good pairs behind each rule above.
- [YouTube tags help article](https://support.google.com/youtube/answer/146402), where the platform itself states that tags play a minimal role, as of reading, verify again before quoting.
- [Search and discovery documentation on the parts of the video mattering most](https://support.google.com/youtube/answer/141805), covering how titles, descriptions, and content match against viewer searches.
- [Shorts discovery guidance](https://support.google.com/youtube/answer/11914225), which names the feed signals commonly used to explain Short behaviour.
- [technical-writing](../../writing/technical-writing/SKILL.md) for writing description structures a hurried reader can act on, since the description's first paragraph follows those rules.

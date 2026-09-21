---
name: presentation-design
description: "Use when building slides or a deck. Lead with the conclusion, one idea per slide, and titles that assert a message instead of naming a topic."
---

# Presentation Design

A slide is not a document. It is a visual aid for a person talking in a room
where attention is scarce and the back row is far away. Design for the decision
you want, not for the completeness of the record.

## Lead with the conclusion

Put the answer on the first content slide, then spend the rest of the deck
supporting it. Audiences decide whether to keep listening in the first minute,
and a deck that builds suspense spends that minute earning nothing. If the
meeting is cut to five minutes you still delivered the point.

Bad (slide 1 of 14, "Agenda"):

> 1. Background
> 2. Market context
> 3. Methodology
> 4. Findings
> 5. Recommendation

Good (slide 1 of 14):

> **Cut the EU tier to two SKUs by Q3**
>
> EU revenue fell 12% while SKU count grew 3x. Two SKUs cover 87% of orders.
> Ask: approval to sunset 6 SKUs, decision needed by March 14.

The background did not vanish. It moved to slides 5 through 9, where anyone who
wants it can follow, and to an appendix for anyone who wants all of it.

## One idea per slide

Each slide advances exactly one claim. Two claims on one slide means the audience
is reading the second while you speak the first, and they retain neither. If you
cannot write the slide's claim as a single sentence, it is two slides.

Bad:

> **Q3 Performance and 2027 Plan**
> - Revenue up 4% overall, down 12% in EU
> - Churn improved to 2.1%
> - Next year we will consolidate SKUs and open a Berlin office
> - Hiring plan attached

Good: four slides, each titled with its claim.

> **Growth is entirely outside the EU** (then the regional split)
>
> **Churn is no longer the constraint** (then the churn trend)
>
> **SKU sprawl is the EU cost driver** (then SKU vs margin)
>
> **Consolidating to two SKUs frees 4 headcount** (then the plan)

## The title carries the message, not the topic

Write the title as a full assertion the audience can disagree with. A topic label
like "EU Revenue" makes the audience hunt the chart for the point; an assertion
tells them the point and turns the chart into evidence. Read the titles alone
top to bottom: they should form the argument.

| Topic label (bad) | Assertion (good) |
| --- | --- |
| EU Revenue | Revenue fell 12% in EU while other regions grew |
| Customer Survey Results | Customers leave over onboarding time, not price |
| Architecture Overview | Every write path now goes through one queue |
| Next Steps | We need a hiring decision by March 14 |
| Cost Analysis | Storage, not compute, drives 70% of the bill |

Keep titles under about 10 words so they fit one line at a readable size. A
title that wraps to three lines has become a paragraph.

## Cut bullets to phrases

Slides are read, not listened to, whenever there is text on them. Full sentences
force the audience to choose between reading you and hearing you. Strip each
bullet to the noun phrase that anchors what you say aloud, and keep the sentence
in your speaker notes.

Bad:

> - We have observed that customer churn in the enterprise segment has decreased
>   from 3.4% to 2.1% over the last three quarters, which we believe is largely
>   attributable to the new onboarding flow that shipped in January.
> - It is worth noting that self-serve churn has remained flat during the same
>   period, suggesting the improvement is specific to guided onboarding.

Good:

> - Enterprise churn: 3.4% to 2.1% (3 quarters)
> - Self-serve: flat
> - Driver: guided onboarding, shipped January

Limits that hold up in a real room: at most 6 bullets, at most 2 lines each, no
sub-sub-bullets. If you need a third level of nesting the content is a document.

## Choose the chart by the comparison you are making

Pick the form from the question, not from habit. The wrong form makes the
audience do arithmetic in their heads, and they will stop.

| Question | Use | Not |
| --- | --- | --- |
| How did this change over time? | Line | Stacked bar |
| Which category is biggest? | Horizontal bar, sorted | Pie with 8 slices |
| What is the split of a whole? | Stacked bar or 2-slice pie | Donut with labels outside |
| Do these two vary together? | Scatter | Two lines on twin axes |
| How does one number compare to a target? | Bullet or single bar plus rule line | Gauge |
| What is the exact value someone will cite? | Table or callout number | Any chart |

Use a chart when the shape is the point (trend, gap, outlier). Use a table when
the values are the point, and then keep it to about 5 rows by 4 columns on a
slide; anything larger goes to the appendix with the three cells that matter
pulled onto the slide as text.

Bad: a 12 by 9 table of monthly revenue by region, read aloud.

Good: a line chart of the two diverging regions, titled "EU diverged from every
other region in April", with the full table in the appendix.

## Spend ink on data, not on decoration

Every element that is not data competes with data for attention. Remove anything
that carries no information: gridline lattices, 3D effects, drop shadows,
gradient fills, background images behind text, borders around every box, and
legends you can replace by labeling the lines directly.

Bad: 3D stacked bars, a legend in the corner, dark gridlines every 10 units, an
axis starting at a rounded 0 that squashes the whole story into the top 15%.

Good: flat bars, the two relevant series labeled at their line ends, one light
gridline at the target, the single number you want remembered set large, and the
one bar that matters colored while the rest are grey.

Rules that survive contact with real decks:

- Color means something or it is not used. One accent color for the point, grey
  for context.
- Label directly at the data, so the eye never travels to a legend and back.
- Never truncate a bar chart's axis: bars encode length, so a cut axis lies.
  Truncating a line chart's axis is fine when you label the range.
- Round to the precision of the decision. "12%" not "11.73%" unless someone will
  spend money on the second decimal.

## Keep visual hierarchy consistent across the deck

Repeat the same size, position, and weight for the same role of element on every
slide. Each inconsistency costs the audience a moment of re-orientation, and
those moments come out of your argument's budget.

- One title position, one title size, everywhere.
- Two type sizes for body text, not five.
- Two fonts maximum in the deck; one is usually better.
- Same left margin on every slide, so titles do not jitter as you advance.
- Sentence case throughout. Mixed Title Case and sentence case reads as sloppy
  even when nobody can say why.

## Design for the back of the room

Your slide will be projected, washed out by daylight, and viewed from 15 meters
or in a video call thumbnail. Design against that, not against your monitor.

- Body text no smaller than 24pt, titles around 36pt to 44pt. If it does not
  fit, cut words, do not shrink type.
- Dark text on light background for lit rooms, light on dark for dark rooms.
  Either way, keep strong contrast and never place text over a busy photo.
- No thin hairlines or 1px strokes; projectors lose them.
- Test it: stand back from your screen at three times its width, or shrink the
  slide to 25% zoom. Anything you cannot read is not on the slide.

## Push detail to an appendix

Detail that would clutter the argument still needs to exist for the skeptic and
for the record. Put it after a clear divider slide, never in the main flow, and
reference it by slide number so you can jump there when challenged.

Bad: a methodology slide with 11 footnotes wedged between the finding and the
recommendation, which everyone skips and which breaks the narrative anyway.

Good: the finding slide says "Method and sensitivity analysis: slides 22 to 27",
and slide 21 is a divider reading "Appendix". The skeptic gets everything; the
decision maker gets a clean line to the ask.

## Put the narrative in speaker notes

Sparse slides only work when the words exist somewhere. Write the full sentences
in the notes pane, so the slide stays a visual aid and you stay coherent even
when you are nervous. Notes also make the deck handover-safe: someone else can
present it.

For each slide, notes should hold: the one sentence you say to land the claim,
the number you want remembered, and the question you expect plus the answer.

Bad: no notes, and the slide grows to contain the script until it becomes a
document projected on a wall.

Good:

> Notes: EU is the only region that shrank, down 12% year over year, while APAC
> grew 9%. Number to land: 12%. Expected question: is this FX? No, constant
> currency is minus 10%. Backup: slide 24.

## Rehearse against a time budget

Assign minutes per slide before you build, then rehearse aloud with a timer.
Decks overrun because they were written without a budget, and an overrun always
eats the recommendation at the end, which is the only part that mattered.

- Budget roughly one to two minutes per content slide, then count your slides
  against the meeting length and cut to fit.
- Reserve a third of the slot for discussion. A 30-minute meeting is a 20-minute
  deck at most.
- Rehearse aloud, not in your head: silent reading runs about twice as fast as
  speech and will lie to you.
- Cut whole slides, not words, when you are over. Trimming words keeps the same
  number of transitions, which is where time actually goes.

## Know whether you are writing a deck or a document

A presented deck and a read-ahead document are different artifacts with different
rules. Trying to make one file do both produces the slide that is too dense to
present and too fragmented to read.

| | Presented deck | Read-ahead document |
| --- | --- | --- |
| Text | Phrases, notes carry prose | Full sentences and paragraphs |
| One idea per | Slide | Section |
| Charts | One per slide, huge | Inline, can be dense |
| Detail | Appendix | Footnotes and body |
| Works without you | No | Yes |

If people will read it without you in the room, write prose and send a document.
If you will talk over it, keep the slides sparse. When someone asks for "the
deck" after a meeting, send the deck plus the notes, or write the memo.

## Quick checklist

- Slide 1 states the conclusion and the ask, with a date.
- Every slide title is an assertion, under about 10 words.
- Reading titles alone reproduces the argument.
- One claim per slide, at most 6 bullets, at most 2 lines each.
- Chart form matches the comparison; tables only for values people will cite.
- No 3D, no gradients, no legend you could replace with direct labels.
- Body text 24pt or larger, readable at 25% zoom.
- Detail lives in a labeled appendix referenced by slide number.
- Speaker notes carry the sentence, the number, and the expected question.
- Rehearsed aloud, inside two thirds of the meeting slot.

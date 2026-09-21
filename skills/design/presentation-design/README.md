# Presentation Design

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building decks that land a decision in a room, by leading with the conclusion, keeping one idea per slide, and writing titles that assert the message.

## What it does

This skill applies eleven craft rules to any deck you build or review. Each rule
targets a specific way slides fail the person in the back row who has to decide
something.

| Rule | Prevents |
| --- | --- |
| Lead with the conclusion | Spending the only minute you have on background |
| One idea per slide | Audiences reading claim two while you speak claim one |
| The title carries the message | "EU Revenue" making people hunt the chart for the point |
| Cut bullets to phrases | Slides the audience reads instead of listening to you |
| Choose the chart by the comparison | Pie charts with eight slices, twin-axis line charts |
| Spend ink on data | 3D bars, gradients, and legends eating attention |
| Consistent visual hierarchy | Titles jittering as you advance, five type sizes |
| Design for the back of the room | 14pt text that vanished on the projector |
| Push detail to an appendix | Methodology slides breaking the narrative mid-argument |
| Narrative in speaker notes | Slides growing into a script projected on a wall |
| Rehearse against a time budget | Overrunning and cutting the recommendation |

It is prescriptive and gives a bad/good pair for every rule, so you can
pattern-match against your own draft instead of reasoning from principles.

## When to use this

Use it when you are:

- Building a deck for a decision, review, or readout.
- Rewriting a deck that someone says is "too dense" or "hard to follow".
- Reviewing someone else's deck and needing concrete, non-subjective feedback.
- Converting a document into slides, or slides into a document.
- Choosing a chart form for a number you need people to act on.

Do not use it for: a read-ahead memo (write prose instead, see the last rule),
a poster or one-pager meant to be studied alone, or a training deck that must
work without a presenter. Those legitimately carry full text.

This is the craft skill. The sibling tooling skill covers building the file with
python-pptx: templates, layouts, placeholders, and export. Decide the content
here first, then build it there.

## Quick start

You have a five-slide deck from a colleague. Here is the outline, then the same
argument rebuilt slide by slide.

### Before

```text
Slide 1  Agenda: Background, Market, Methodology, Findings, Next Steps
Slide 2  About Our Team (history, org chart, 3 photos)
Slide 3  Q3 Performance and 2027 Plan
         - We have observed that customer churn in the enterprise segment
           decreased from 3.4% to 2.1% over three quarters, which we believe
           is attributable to the new onboarding flow shipped in January
         - Revenue was up 4% overall although down 12% in the EU region
         - Next year we plan to consolidate SKUs and open a Berlin office
         - Hiring plan is attached in the notes
Slide 4  Cost Analysis (12 x 9 table of monthly spend by region, 9pt text)
Slide 5  Next Steps (5 bullets, no owners, no dates)
```

Failures: the conclusion is nowhere, slide 3 carries four claims, every title is
a topic label, the table is unreadable, and nothing states an ask.

### After

```text
Slide 1  Cut the EU tier to two SKUs by Q3
         EU revenue fell 12% while SKU count grew 3x.
         Two SKUs cover 87% of orders.
         Ask: approval to sunset 6 SKUs. Decision by March 14.
         Notes: open with the 12%. If we only get five minutes, this is the deck.

Slide 2  Growth is entirely outside the EU
         Line chart, EU and rest-of-world, EU line labeled at its end.
         Notes: 4% overall hides the split. EU minus 12%, APAC plus 9%.
         Expected question: is this FX? Constant currency is minus 10%. See 12.

Slide 3  SKU sprawl is the EU cost driver
         Sorted horizontal bar: margin by SKU, the 6 losers in accent color.
         Notes: 6 SKUs, 13% of orders, negative margin each.

Slide 4  Churn is no longer the constraint
         Single line, 3.4% to 2.1%, one rule line at the 2.5% target.
         Notes: guided onboarding shipped January. Self-serve flat, so the
         gain is specific. Do not spend meeting time here.

Slide 5  Storage, not compute, drives 70% of the bill
         Two-slice split plus one callout number: 70%.
         Notes: full 12 x 9 monthly table is slide 14.

Slide 6  We need the sunset approved by March 14
         Three rows: action, owner, date. Nothing else.
         Notes: the only slide with an ask. Stop here and wait.

Slide 7  Appendix (divider)
Slides 8 to 15  Methodology, sensitivity, full cost table, hiring plan, org chart
```

Nothing was deleted. The team history, the 12 by 9 table, and the hiring plan
all moved behind the appendix divider, where a skeptic can reach them and a
decision maker is not blocked by them. Six content slides at one to two minutes
each fits a 30-minute meeting with time left to argue.

## Key concepts

**BLUF, bottom line up front.** The conclusion and the ask go on the first
content slide, with a date. Everything after it is support. A deck that builds
to its point loses anyone who leaves early, and someone always leaves early.

**Assertion titles.** A title is a claim the audience can disagree with, not a
label for the contents. "Revenue fell 12% in EU" turns the chart into evidence;
"EU Revenue" makes the chart a puzzle. Read your titles alone, in order: if they
do not reproduce the argument, the argument is not in the deck.

**One claim per slide.** Two claims on a slide means the audience reads one while
hearing the other and retains neither. If the claim will not fit in one sentence,
it is two slides. Splitting is free; slides are not a scarce resource, attention
is.

**Form follows comparison.** Trend takes a line. Ranking takes a sorted bar.
Correlation takes a scatter. Exact values people will cite take a table or a
callout number. Picking by habit forces mental arithmetic, and the audience quits
instead.

**Data-ink.** Every non-data element competes with data. Delete 3D, gradients,
shadows, heavy gridlines, and legends replaceable by direct labels. One accent
color for the point, grey for context. Never truncate a bar axis: bars encode
length, so a cut axis is a false statement.

**Designing for the room.** Body text 24pt minimum, titles 36pt to 44pt, strong
contrast, no hairlines. Test by viewing at 25% zoom or standing back three screen
widths. Whatever you cannot read there is not on the slide.

**Appendix and notes as pressure valves.** Detail goes behind a divider and is
referenced by slide number. Prose goes in speaker notes: the sentence that lands
the claim, the number to remember, the expected question and its answer. Both
exist so the slide can stay sparse without the content being lost.

**Deck versus document.** If people read it without you, write prose. If you talk
over it, keep slides sparse. One file cannot do both: it ends up too dense to
present and too fragmented to read.

## Common pitfalls

### Opening with an agenda instead of the answer

Bad:

> **Agenda**
> 1. Background 2. Market context 3. Methodology 4. Findings 5. Recommendation

Good:

> **Cut the EU tier to two SKUs by Q3**
> EU revenue fell 12%, SKU count grew 3x, two SKUs cover 87% of orders.
> Ask: approval to sunset 6 SKUs by March 14.

Reason: the audience decides whether to keep listening in minute one, and an
agenda spends that minute saying nothing.

### Titling the topic instead of the message

Bad: `Customer Survey Results`

Good: `Customers leave over onboarding time, not price`

Reason: a label makes the reader find the point themselves, and half of them
find a different one.

### Writing paragraphs as bullets

Bad:

> - We have observed that customer churn in the enterprise segment has decreased
>   from 3.4% to 2.1% over the last three quarters, which we believe is largely
>   attributable to the new onboarding flow that shipped in January.

Good:

> - Enterprise churn: 3.4% to 2.1% (3 quarters)
> - Driver: guided onboarding, shipped January

Reason: text on a slide gets read, and reading beats listening, so your voice
becomes background noise.

### Projecting a spreadsheet

Bad: a 12 by 9 table of monthly spend by region at 9pt, read aloud.

Good: a two-slice split with the callout number 70%, titled "Storage, not
compute, drives 70% of the bill", with the full table on slide 14.

Reason: nobody reads a 108-cell table from 15 meters, so the three cells that
mattered get lost with the other 105.

### Decorating the chart

Bad: 3D stacked bars, corner legend, dark gridlines every 10 units, axis starting
at 40 so the change looks enormous.

Good: flat bars, series labeled at their ends, one light rule line at the target,
the one relevant bar in accent color and the rest grey, axis from zero.

Reason: decoration competes with data for attention, and a truncated bar axis
misstates the size of the change.

### Letting the slide carry the script

Bad: eight lines of full sentences on the slide, notes pane empty.

Good: three phrases on the slide, and in the notes: "EU is the only region that
shrank, down 12% while APAC grew 9%. Number to land: 12%. Expected question: is
this FX? Constant currency is minus 10%. Backup: slide 24."

Reason: the words have to live somewhere, and the notes pane is the only place
that does not cost the audience's attention.

### Building without a time budget

Bad: 22 content slides for a 30-minute slot, so the recommendation gets three
rushed minutes at the end.

Good: 6 content slides at one to two minutes each, a third of the slot reserved
for discussion, rehearsed aloud with a timer.

Reason: overruns always eat the last slide, and the last slide is the ask.

### Shipping the deck as the read-ahead

Bad: one file emailed as pre-reading and also presented, dense enough to read and
fragmented enough to confuse.

Good: a prose memo for the read-ahead, a sparse deck for the room, notes attached
when people ask for the deck afterwards.

Reason: the two artifacts have opposite rules for text density, so one file fails
at both jobs.

## See also

Sibling skills in `skills/productivity/`:

- [technical-writing](../../writing/technical-writing/SKILL.md) for the prose version of the
  same discipline, and for the read-ahead memo when a deck is the wrong artifact.
- [planning](../../workflow/planning/SKILL.md) for building the plan that a recommendation
  slide asks approval for.
- [truth-first](../../research/truth-first/SKILL.md) for not overstating a number, which is
  the failure behind most truncated axes and rounded-up claims.
- [readme-generator](../../meta/readme-generator/SKILL.md) for a project summary that
  does not need a presenter in the room.
- [grill-me](../../workflow/grill-me/SKILL.md) for stress-testing an argument before you
  present it, which is how you find the questions your notes should answer.

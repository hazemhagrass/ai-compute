# Slide Deck Designer

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="slide-deck-designer robot" width="200">
</div>

A skill for planning what a deck says: assertion titles, one idea per slide,
slide count derived from a rehearsed runtime, and live demos that survive a
hostile projector.

## What it does

Treats a talk as an argument delivered by a person, not a document projected
on a wall. It names the failure modes and gives the replacement for each:

- **Assertion-evidence slides.** The title is a full sentence stating the
  conclusion; the body is the evidence that proves it. Replaces topic titles
  over bullet walls.
- **One idea per slide.** Two claims on one slide means the room reads the
  second while you speak the first, and keeps neither.
- **Decks are not documents.** If someone needs the detail standalone, send a
  document; do not stretch slides into one.
- **Slide count from runtime.** Derive the count from the minutes you have,
  confirmed by a stopwatch rehearsal, not from a folklore constant.
- **Back-row legibility.** A size floor and a measured contrast ratio rather
  than a guess made on a laptop screen.
- **Speaker notes carry the reasoning.** Conclusion on the slide, argument in
  the notes. This is also what makes a deck handable to someone else.
- **Diagrams over bullet prose.** Architecture and workflow claims are spatial
  claims and should be drawn.
- **Rehearsal, Q&A, and demo fallbacks.** Per-section timings, the three
  hardest questions drafted in advance, and a recorded demo on local disk.

## When to use this

- Planning the content of a talk, webinar, lecture, or conference session.
- Turning a written document into a talk, or deciding a document is the right
  thing to send instead.
- Preparing a live demo that is part of a talk.
- Reviewing a colleague's outline and needing specific feedback rather than
  "looks good".

Skip it for:

- Visual craft: layout, hierarchy, and chart-to-slide discipline belong to
  `design/presentation-design`, which wins on slide-level craft.
- Which chart form to choose: `data/data-visualization-principles`.
- Accessibility beyond the contrast floor here: `design/accessibility-audit`.
- Producing the file itself: the `office` category covers format and API.
- A document meant to be read with no presenter: the `writing` category.

## Quick start

A colleague hands you one slide from a "Q3 Performance" deck:

```text
Q3 Performance

- Latency
- Costs
- Migration
- Hiring
```

Four unrelated topics, no claim, nothing proven. Rebuild it:

1. For each bullet, write the sentence you would actually say out loud. That
   sentence becomes a slide title.
2. Under each title put the chart, diagram, or short table that proves it. If
   nothing proves it, delete the slide.
3. Move the reasoning into speaker notes.
4. Count the slides against the minutes the agenda gives you, rehearse with a
   stopwatch, and cut from the middle if you run long.
5. If there is a live demo, record it first and wire in the fallback.

The result:

```text
p95 checkout latency fell from 1.9s to 0.64s after the index change
  [line chart, zero baseline, deploy marked]

The same change cut read replica spend by a third
  [before/after bar, dollars labelled]
```

The titles now read as an argument on their own, which is the test: a reader
skimming only the titles should get the whole case.

## Key concepts

**Assertion-evidence.** The title states the finding as a sentence; the body
shows the evidence. A topic title ("Latency") tells the room what the slide is
about. An assertion title ("p95 latency fell 66% after the index change") tells
them what to conclude, which is the only reason the slide exists.

**The title-only test.** Read only the slide titles in order. If they do not
form a coherent argument, the deck has no spine and the talk will wander.

**Runtime drives slide count.** Slides are not a budget you fill, they are a
consequence of what you can say in the minutes you have. The only reliable
instrument is a stopwatch and one full rehearsal.

**Appendix slides.** Slides you expect never to present, placed after the end,
reachable during Q&A. They let you cut the main line without losing the
material.

**Demo fallback.** A recording on local disk, dependencies cached and warm,
and a screenshot path for the case where the live demo buys nothing. Network
and projector failures are routine, not exceptional.

## Common pitfalls

**Topic titles instead of assertions.**
Bad: a slide titled `Migration Status` above five bullets.
Good: `The migration finished two weeks early with no rollback`.
Reason: the topic title makes the audience derive the point while you talk
over them, so they miss both.

**Reading the slide aloud.**
Bad: every word you say is already projected behind you.
Good: the conclusion is on the slide, the argument is in your mouth and the
speaker notes.
Reason: the room reads faster than you speak, finishes the slide, and stops
listening.

**Slide count guessed from a rule.**
Bad: "one slide per minute", so 30 slides for 30 minutes.
Good: rehearse with a stopwatch and count what you actually got through.
Reason: a dense architecture slide can take four minutes and a photo takes
ten seconds; the average is not a plan.

**Designing on a laptop for a projector.**
Bad: 14pt body text and a light grey on white that looks fine at arm's length.
Good: a size floor checked from the back of a room, and a measured contrast
ratio.
Reason: projector gamma and ambient light destroy low-contrast text that
looked acceptable on a calibrated screen.

**Live demo with no fallback.**
Bad: the demo runs against staging over conference wifi.
Good: a local recording ready to play, dependencies warmed before you walk in.
Reason: conference networks fail often enough that betting the talk on one is
a choice, not bad luck.

**Cutting the ask instead of the middle.**
Bad: running long, so the closing recommendation gets rushed or skipped.
Good: cut a supporting section, keep the ask intact.
Reason: the ask is the reason the meeting exists; supporting detail is what
the appendix is for.

## See also

- [`presentation-design`](../../design/presentation-design/README.md): slide
  layout, hierarchy, and visual craft. It wins wherever the two overlap.
- [`data-visualization-principles`](../../data/data-visualization-principles/README.md):
  choosing the chart form that proves the assertion.
- [`accessibility-audit`](../../design/accessibility-audit/README.md): contrast
  and legibility beyond the floor named here.
- [`technical-writing`](../../writing/technical-writing/README.md): for the
  document you send instead of stretching the deck.

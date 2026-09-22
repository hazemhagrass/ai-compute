---
name: slide-deck-designer
description: "Use when planning the content of a talk or a deck. Assertion-evidence slides, one idea per slide, slide count against runtime, rehearsal, and live-demo fallbacks."
---

# Slide Deck Designer

This is about what the slides SAY, not how they look or how the file is built.
Decks that fail fail on contention for attention: the audience is reading a
paragraph while the speaker is talking about something else. The fix is to
treat every slide as a claim with evidence, and to keep the words that carry
the reasoning off the slide and in the speaker's notes.

Boundaries:

- Visual polish, layout, and slide-level craft: `skills/design/presentation-design`
  (this skill defers to it on the rules they share, such as one idea per slide
  and assertion titles).
- Which chart form to use for a given comparison:
  `skills/data/data-visualization-principles`. Never re-decide the chart form
  here; name the question the chart must answer and defer to that skill.
- Building the .pptx or .key file itself: the `office` category skills.

## The slide is a claim, the evidence is visual

An assertion-evidence slide has a title that is a complete sentence stating the
conclusion, and a body that is a chart, photo, diagram, or short table that
proves it. Developed and tested by Michael Alley at Penn State; see
https://www.assertion-evidence.com and the
https://hplgit.github.io/MAlley-slide-templates/html5/AE_presentation_template-deck-beige.html
template.
Topic title plus bullet wall forces the audience to find the point themselves;
an assertion title hands it over and lets the body serve as proof.

Bad:

> **Q3 Performance**
> - Revenue: $4.2M
> - Churn analysis performed
> - EU market deep dive
> - Team updates

Good:

> **EU churn fell after guided onboarding shipped, but self-serve did not move**
>
> (one chart: two churn lines diverging at the January onboarding release)

Why: the bullet wall is a script masquerading as a slide, four unrelated topics
under one topic label, and the chart that would prove the churn claim is absent.
The assertion title says what happened; the single chart is the evidence. If
the titles alone, read top to bottom, read like the argument of the talk, the
deck is doing its job.

## One idea per slide

If two claims share a slide, the audience reads the second while you speak the
first and retains neither. If you cannot state what a slide proves in one
sentence, split it. A slide that needs sub-sub-bullets is a document; move it.

## Slides are not the handout

A deck projected in a room and a document read alone are different artefacts.
When someone asks for "a copy of the slides", what they usually need is a
written doc; slides stripped of speech are almost unreadable, and slides that
are readable alone are too dense to present. Offer to send the prose document
instead, and keep the deck lean for the room.

## Slide count is a runtime decision

Decompose the talk into minutes first: a rehearsal-free rule is roughly
one main slide per minute for a data-heavy talk, and half that where the talk
is discussion-driven. 10 slides in 60 minutes feels thin; 60 slides in 60
minutes guarantees you talk at the screen instead of to the room. Budget:
title, one summary slide up front per the assertion-evidence pattern, then one
slide per claim, then appendix slides that never get presented but do get
answered from, during Q&A.

## The 10-20-30 folklore, reframed

Guy Kawasaki's rule of 10 slides, 20 minutes, 30 point font
(https://guykawasaki.com/the-only-10-slides-you-need-in-your-pitch/) is often
quoted as law. Treat it as a default for a pitch in a fixed short slot, not as
a theorem: a 60-minute technical tutorial may legitimately want 30-40 slides,
whereas a 5 minute lightning talk wants 5. Keep the invariant it protects,
which is that slides per minute stays low so you talk faster than you flip,
and pick the actual counts from the runtime.

## Legibility beats decoration

Rule of thumb from the assertion-evidence workshops: if a person in the back
row cannot read the smallest text on the screen without effort, the smallest
text does not belong on the screen. Practical checks:

- Minimum body size legible from the back row (about 24 point as the practical
  floor for body text on a projector); when you go below it, the content
  belongs in speaker notes, not on screen.
- Strong contrast between text and background, checked against ratios rather
  than vibes: verify with https://webaim.org/resources/contrastchecker/, and
  use `skills/design/accessibility-audit` for the full audit method.
- Restraint: every colour beyond an accent should be earning attention, not
  decorating.

## Speaker notes hold the reasoning; slides hold the conclusion

The slide says WHAT was concluded; the notes say WHY and HOW, in sentences you
can speak. Slides that carry the reasoning accrete bullets, and the speaker ends
up reading rather than talking. When a talk is handed to another presenter later,
notes are what make the handoff survivable.

## Diagrams over bullet prose for any structure

Architecture, workflow, org chart, decision tree: these are spatial claims and
drawn as diagrams beat them as bullet lists. Again, the assertion
title carries the takeaway, and the diagram carries the shape.

## Rehearse against the time budget

A talk you have not timed will exceed its slot, and the part that gets cut is
usually the closing ask. Rehearse with a stopwatch at least once, from slide 1
to the last, out loud, and record per-section times:

- If the middle runs long, cut content from the middle, not the conclusion.
- Leave explicit buffer before Q&A; end early is better than run over.
- Mark appendix slides as never-present; navigate to them only on demand.

## Prepare for question attack

Write down the three questions you least want, and draft an answer for each,
with an appendix slide ready to support the answer. Put anticipated questions in
speaker notes on the relevant slide rather than a separate doc, so the
answering pair stays adjacent during actual Q&A.

## Live demos fail: build the fallback

Software demos fail when you need them most. Every live demo must have a
fallback design:

- Record a clean run of the demo and keep the recording ready on the machine
  you will present from, not upstream in the cloud.
- Pre-load cached dependencies: install everything while you have network, and
  warm the places that warm up slowly (containers, index pages, dashboards).
- Where a screenshot is sufficient, present it and skip the risk.
- If the demo must be live, rehearse on the presenters' actual machine,
  display config, and network, not a personal laptop with different settings.

Bad: demoing on the conference projector's mirrored display, resolution
changed, fonts substituted, network captive-portal wifi, half the node_modules
restored from a cold cache.

Good: the exact laptop, the exact adapter, a saved recording as fallback, the
app already warm, and a rehearsal run an hour earlier.

## Quick checklist

- Every title is a full assertion the audience could disagree with.
- One claim per slide; three-level bullets means content is a doc.
- Slide count justified against a rehearsed runtime, not a rule.
- Reasoning in speaker notes; conclusion on slide.
- Smallest on-slide text readable from the back; high contrast.
- Live demo has a recording fallback and warmed dependencies.
- Rehearsed end-to-end with a stopwatch, with appendix marked skip-to.

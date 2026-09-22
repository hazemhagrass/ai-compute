# Interview Prep

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="interview-prep robot" width="200">
</div>

Prepare for a job interview by rehearsing a bank of true stories, so your answers in the room are recalled rather than invented.

## What it does

Turns interview preparation from reading advice into rehearsal. The output is a
story bank of six to ten real situations mapped to the competencies the target
role actually screens for, each compressed to a four line entry you can retrieve
under pressure and expand into a properly budgeted STAR answer. It then covers
the rest of the loop with the same rehearsal first principle: the question you
dread, the questions you ask, the coding and system design rounds, salary
deflection, logistics, and a debrief note after every round.

It is the preparation counterpart to [`grill-me`](../../workflow/grill-me/SKILL.md).
grill-me interrogates a plan until no branch is silently assumed; this skill
makes sure the candidate, not just the plan, can stand up to that level of
questioning.

## When to use this

- You have an interview scheduled, at any round from recruiter screen to final
- You have been burned before by knowing all the advice and still blanking in
  the room
- You are preparing for a loop that includes behavioural, technical, or system
  design rounds, or all three
- You are avoiding a specific question you hope they will not ask
- You are running out of honest answers to the question "tell me about a time"

## Quick start

Take one raw memory from your own history and turn it into a delivered STAR
answer. Here is the full path for one entry, from a vague recollection to a
rehearsed 100 second response.

### 1. Start with the raw memory

> Something about the payments team changing the webhook format, and me being
> annoyed about the timeline. It worked out eventually.

Note what is missing: no stakes, no numbers, no specific action. That vagueness
is what comes out of your mouth when you have not prepared.

### 2. Anchor it in the job description

The posting asks for "influence across teams" and "comfort with ambiguity". This
memory is both. Tag it `conflict, influence without authority`.

### 3. Pull the real facts until the story is specific

- What was at stake? The cutover would silently drop about 4% of retried events.
- What did I actually do? Pulled the retry numbers, proposed dual write instead
  of arguing, got an overlap window agreed in writing, wrote the shim.
- What was the outcome? Zero dropped webhooks, their original date held, and
  overlap windows became the default for format changes.

### 4. Compress to a four line bank entry

```text
TAG:    conflict, influence without authority
S:      Payments team wanted the new webhook format in 3 weeks; our consumer
        could not migrate that fast without dropping retries.
T:      I owned the consumer, no authority over their roadmap.
A:      Pulled the real retry numbers, took their lead a dual-write option,
        agreed a 6-week overlap in writing, wrote the translation shim.
R:      Zero dropped webhooks at cutover, their date held, overlap windows
        are now our default for format changes.
NUMBER: webhook-consumer-errors dashboard, cutover week
```

### 5. Budget the delivery and say it out loud

Situation and Task in two sentences, about 20 seconds. Action in first person
singular, every verb "I", about 60 seconds. Result with the number and the
durable change, about 20 seconds. Rehearse once against a timer. Then close the
file and trust the four lines, because the full sentences should come out
slightly differently every time. A memorised script reads as memorised.

## Key concepts

- **Story bank**: six to ten real situations, each tagged to competencies the
  job description screens for. Retrieval, not composition. Every competency is
  covered twice where possible, because interviewers across rounds compare
  notes.
- **STAR with a time budget**: Situation and Task 20 seconds, Action 60 seconds
  in first person singular, Result 20 seconds. The failure mode is four
  sentences of Situation and one of Result.
- **Honest quantification**: a before and after pair beats a percentage, a named
  source beats an unnamed one, and an audible hedge beats a confident wrong
  number. When a number is confidential, give its shape and withhold its
  magnitude; when there is no metric at all, count scope instead.
- **The dreaded question**: written first, not last. Short ownership, concrete
  change, evidence the change stuck. Avoidance is visible in delivery.
- **Due diligence in both directions**: your questions are scored by them and
  should be scoring them, especially the ones asked of peers.
- **The transcript is the artefact**: in coding rounds, narration, stated
  assumptions, and clean recovery from a wrong path are competencies in
  themselves. In system design rounds, scope and numbers come before boxes.
- **Salary deflected to the offer**: naming a number before they want you sets
  your ceiling with the least information you will ever have.
- **Debrief every round**: stories used, stumble points, what they revealed, and
  the open question the next round should close.

## Common pitfalls

- **Story bank of twenty entries, none rehearsed.** Bad: a sprawling document
  where every career event gets a page. Good: six to ten entries covering each
  competency twice, because an interviewer who hears the same story in round one
  and round three notices.
- **Inventing a number to sound rigorous.** Bad: "we increased conversion by
  300%", which unravels under one follow up and discredits every other claim.
  Good: "checkout went from about 61% to about 68% over two months, but a
  pricing change shipped in the same window so I would not claim all of it."
- **Fencing off the question you dread.** Bad: "we mutually agreed it was no
  longer a good fit", which every interviewer reads as evasion and probes
  harder. Good: "I was laid off in a reduction that cut my group from eleven to
  four, and I was the newest hire. My manager is happy to speak to it."
- **Clarifying questions after ten minutes of coding.** Bad: writing code
  immediately and discovering at minute 15 that the input can contain
  duplicates. Good: two minutes on input size, types, and edge cases before
  writing anything.
- **Saying "we" for work you did alone.** Bad: "we built the migration tool",
  which leaves the interviewer unable to credit you. Good: "I built the
  migration tool, two teammates ran the trial groups."
- **Sketching boxes before agreeing on scope.** Bad: drawing the architecture
  you assumed and defending it for the rest of the hour. Good: two minutes on
  functional scope and numbers, then the simplest design that satisfies them,
  loaded until it breaks.
- **Naming a salary figure in round one.** Bad: an anchor set before anyone has
  decided they want you, which caps every later conversation. Good: deflecting
  politely and asking what range is budgeted for the level.
- **Skipping the debrief.** Bad: walking out and doing nothing, then repeating
  the same story in round three. Good: ten minutes writing down what was asked,
  what stumbled, and what they revealed, while it is still fresh.

## See also

- [`../salary-negotiation/SKILL.md`](../salary-negotiation/SKILL.md), for what
  happens once an offer exists and numbers are on the table
- [`../latex-resume/SKILL.md`](../latex-resume/SKILL.md), the document on the
  other side of the funnel
- [`../../workflow/grill-me/SKILL.md`](../../workflow/grill-me/SKILL.md), for
  stress-testing the plan you intend to pitch in a final round
- [`../../writing/technical-writing/SKILL.md`](../../writing/technical-writing/SKILL.md),
  for the debrief note you send after each round
- [`../../research/truth-first/SKILL.md`](../../research/truth-first/SKILL.md),
  for the rule this skill applies to every number you say out loud

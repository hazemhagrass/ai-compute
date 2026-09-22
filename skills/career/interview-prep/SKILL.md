---
name: interview-prep
description: Use when preparing for a job interview. Rehearse a story bank of real situations so the preparation survives contact with the room.
---

# Interview Prep

Interview preparation fails in a predictable way: you read advice, you agree with
it, then in the room you invent an answer from scratch under time pressure while
a stranger watches. The fix is not more advice. It is having already said the
words out loud, about a real thing that happened to you, before anyone asks.

This skill prepares a candidate. It is not
[`grill-me`](../../workflow/grill-me/SKILL.md), which interrogates an argument:
grill-me walks a design tree until no branch is silently assumed, and its output
is shared understanding of a plan. Here the subject is you, the material is your
own history, and the output is rehearsed, truthful, compressible stories. Use
grill-me on the plan you will pitch in a final round; use this skill on the loop.

## Build a story bank before you build answers

A behavioural question is a retrieval problem disguised as a creativity problem.
Interviewers ask about a small closed set of competencies, and the same six to
ten situations from your career cover almost all of them. Write the situations
down once, then map them, so in the room you are recalling rather than composing.
Start from the job description, not from memory.

- Read the posting and list every repeated demand: ambiguity, cross team
  influence, mentoring, on call, migration under load, customer contact. For
  each, find a situation you lived through personally, with a start, a decision
  you made, and an outcome you can describe.
- Cover each competency twice where you can, because an interviewer who hears a
  story in round one and again in round three will notice. Keep it to six to ten:
  twenty stories means none of them is rehearsed.

A bank entry is four lines. The essay is what you deliver; the four lines are
what you memorise.

```text
TAG:    conflict, influence without authority
S:      Payments team wanted to ship the new webhook format in 3 weeks;
        our consumer could not migrate before Q3 without dropping retries.
T:      I owned the consumer. I had no authority over their roadmap.
A:      Pulled the actual retry numbers, took them a dual-write option,
        agreed a 6-week overlap window in writing, wrote the shim.
R:      Both formats live for 6 weeks, zero dropped webhooks in the cutover,
        their date held. We now default to overlap windows for format changes.
NUMBER: dashboard "webhook-consumer-errors", cutover week
```

## Structure with STAR, and spend the time on R

STAR is Situation, Task, Action, Result. Almost everyone who has heard of it
still fails the same way: four sentences of Situation, one of Result. The
Situation is the part you remember most vividly, so it expands under stress, and
it is the part the interviewer cares about least. They score Action and Result.
Budget the answer: a good behavioural answer runs 90 to 120 seconds.

- Situation and Task together: about 20 seconds, two sentences, enough context
  that the stakes are legible and no more.
- Action: about 60 seconds, and every verb is "I", not "we". "We" hides whether
  you did the work or watched it.
- Result: about 20 seconds, with the outcome, the number if you have one, and
  what changed afterwards because of it.

Rehearse against a timer once per story: you are calibrating how long your own
Situation runs when nervous, which is always longer than you think.

**Question: "Tell me about a time you disagreed with a coworker."**

Weak answer:

> So we had this webhook integration with the payments team, and the way it
> worked was they published events and we consumed them, and there was a lot of
> history there because the original format was designed before I joined, back
> when the team was much smaller, and honestly it had a lot of problems. The
> payments team lead and I had never really seen eye to eye, and he wanted to push
> out a new format really fast. It was difficult politically because his manager
> was pushing hard for the quarter. Eventually we worked it out.

Strong answer:

> The payments team planned to cut over to a new webhook format in three weeks.
> I owned the consumer, and we could not migrate that fast without dropping
> retries, but I had no authority over their roadmap. So I stopped arguing about
> the date and pulled the numbers: our retry path handled about 4% of events, and
> under their plan those would fail silently. I took their lead a dual-write
> option with numbers instead of a complaint, and we agreed in writing to an
> overlap where both formats ran for six weeks. I wrote the translation shim that
> week. The cutover dropped zero webhooks, and their original date held.

Why the strong one works: it reaches the disagreement in one sentence, the Action
is a sequence of things the candidate personally did, the conflict resolves by
evidence rather than by escalation or by vanishing into "we worked it out", and
the Result names both the outcome and the durable change. The weak answer spends
its whole budget on backstory and ends with no verifiable claim.

## Quantify the Result honestly, including when you cannot

An invented number is a question you cannot survive a follow up on, and one
unravelled claim discredits every other story you told. Cite a metric only if you
could name the dashboard, the query, or the ticket behind it.

- Prefer a before and after pair over a percentage: "1.9s to 640ms" is checkable,
  while "improved by 70%" invites "from what baseline?"
- When the number is confidential, give the shape and withhold the magnitude: "I
  can't share revenue, but it was the largest single account in the region,
  roughly a quarter of our book." That is a real answer, not a dodge.
- With no metric at all, substitute countable scope: team size, services owned,
  request volume, customers, duration of on call.
- Say the honest hedge out loud: "I don't have the exact figure in front of me,
  it was around a third" beats a confident wrong number, because the interviewer
  is scoring calibration as well as impact.

Bad: "We increased conversion by 300%."

Good: "Checkout completion went from about 61% to about 68% over the two months
after launch. That was our main funnel dashboard, and I'd caveat that we shipped
a pricing change in the same window, so I wouldn't claim all of it." Volunteering
the confounder is what makes the rest of your numbers believable.

## Rehearse the question you dread

There is one question you are hoping they skip: the failure, the conflict that
went badly, the gap, the time you were let go. Avoidance is visible. Your
delivery changes, you get vague, you talk longer. Write that answer first. The
structure that works is short ownership, then what you changed, then evidence the
change stuck. No blaming a manager, no "my greatest weakness is that I care too
much", no relitigating who was right.

**Question: "Tell me about a time you failed."**

Weak answer:

> I'd say my biggest failure was probably a project where the requirements kept
> changing. We were building a reporting feature, stakeholders kept moving the
> goalposts, and leadership never really prioritised it. We shipped late, but I
> learned a lot about the importance of communication.

Strong answer:

> I shipped a schema migration that took the orders API down for about forty
> minutes. I'd tested it against a staging database with a few thousand rows, and
> the production table had nine million, so the ALTER took a full table lock far
> longer than I expected. I'd never checked the row count. What I changed: I
> write the rollback in advance now, always, and I test migrations against a
> production-sized restore, not staging. I also added a row count and estimated
> lock duration to our migration template, so the next person has to look at it.
> We've run about thirty migrations since on that template with no repeat.

Why the strong one works: it names a real failure with a real consequence and
takes the blame in the first sentence, rather than distributing it across
stakeholders and leadership. The diagnosis is specific and technical, so it
sounds like something that happened rather than something composed. The lesson is
a mechanism, not a sentiment: a changed template that binds other people, with
evidence it held. The weak answer blames someone else and learns nothing.

**Question: "Why did you leave your last role?" (after being let go)**

Weak answer:

> It was a mutual decision. The team was going in a different direction and it
> just wasn't a good fit anymore, so we agreed it was time to part ways.

Strong answer:

> I was laid off in a reduction that cut our platform group from eleven to four.
> I was the most recent hire on the team. I'd have liked more time on the data
> pipeline work I'd started, and my manager is happy to speak to that. In the
> four months since I've shipped two contract projects.

Why the strong one works: it is direct and brief, so it does not read as
concealment, and it gives the one fact that contextualises the decision without
sounding defensive. It offers a reference and accounts for the interval. The weak
answer uses language every interviewer reads as evasion, which invites exactly
the probing it was meant to avoid.

## Research the company until you have real questions

The test of your research is not that you can recite the mission statement, it is
that you arrived with a question no one could ask without having looked.

- Read the actual product. Sign up, use the free tier, hit the API, and bring one
  concrete observation from doing so.
- Read the engineering blog and changelog, and find the thing they are clearly
  proud of or clearly struggling with. Understand how the company makes money,
  from filings or funding news if they exist: the team you join is funded by
  something.
- Look up who you are meeting: their talks, posts, and commits tell you what they
  will ask about, and the competitors tell you what "how do you think about X
  versus Y" will mean.

## Treat your questions as signal and as due diligence

The questions you ask are scored, and they also matter to you: this is the only
chance to find out whether the job is good. Ask the diligence ones of peers
rather than the hiring manager. Signal questions show how you think about the
work:

- "What does the on call rotation actually look like in a bad week?"
- "What's the thing about the codebase you'd warn me about on day one?"
- "How does a decision like [specific thing from the blog] get made here?"

Diligence questions find out whether to accept:

- "Who was in this role before, and where are they now?"
- "What's the last project that got cancelled, and how was it handled?"
- "What would make you say, in six months, that this hire went badly?"

Avoid questions answered by the careers page, and avoid asking about time off or
remote policy before an offer exists. Those belong in the negotiation.

## Run the technical loop out loud

In a coding interview the transcript is the artefact. A correct solution produced
in silence scores below a working solution narrated clearly, because the
interviewer is hiring a colleague, not a compiler.

- Clarify before writing anything. Input size, types, duplicates, empty input,
  whether it is sorted, whether you can mutate it. Two minutes here saves you
  from solving the wrong problem.
- State the brute force and its complexity, then say you will improve it. Now you
  always have something working if time runs out.
- Say assumptions aloud as you make them: "I'm assuming the ids fit in memory,
  push back if that's wrong." That invites the correction early.
- Narrate the plan before you type, so the interviewer can redirect you before
  you spend ten minutes going the wrong way, and test by hand on a small case and
  one edge case before announcing you are done.

Recovering from a wrong path is itself a scored competency, and the wrong move is
to defend the approach. Bad: "No, it works, let me just fix this bit." Good:
"This is getting complicated because I'm sorting inside the loop. That's the
wrong shape. Let me back up and use a heap instead, that keeps it n log k."
Naming why the path failed proves you can diagnose your own work.

## Treat system design as a conversation, not a diagram

System design rounds go badly when the candidate starts drawing boxes. Start with
requirements, get agreement, then design.

- Establish functional scope first, and say what you are explicitly leaving out.
  Agreeing on a narrow scope is not conceding, it is the job.
- Get numbers on the table: users, requests per second, read to write ratio,
  payload size, retention. Ask for them; do not invent them silently.
- Sketch the simplest thing that satisfies those numbers, then apply load and let
  it break. The interesting conversation is where it breaks.
- Name your tradeoffs as tradeoffs. "I'll take eventual consistency on the feed
  for write throughput, which means a user may not see their own post
  immediately, and I'd fix that by reading your own writes from the primary."
- Flag what you do not know: "I've not operated Kafka at that scale, so I'd check
  the partition count assumption" buys credibility on everything else.

## Deflect salary until an offer exists

Naming a number before they have decided they want you sets your ceiling with the
least information you will ever have. Deflect politely, twice if needed, then
answer with a researched range if the deflection does not hold.

> "I'd rather hold off on numbers until we both know this is a fit. If it helps,
> I'm confident we can make the compensation work once we get there. What range
> is budgeted for this level?"

Where disclosure is legally required of them, ask for their range first, and do
not lie about current compensation. Ranges, counteroffers, competing offers, and
equity belong in [`salary-negotiation`](../salary-negotiation/SKILL.md); this
skill hands off the moment an offer appears.

## Fix the logistics the day before

Logistics failures cost you the first five minutes of a round you cannot extend,
and they read as a signal about how you prepare.

- Confirm the timezone in writing, in both timezones, and the total duration, and
  get the interviewers' names plus a phone number for the recruiter in case the
  call fails.
- Test the exact meeting platform in the exact browser, with camera and
  microphone, the day before and again 15 minutes prior.
- Camera at eye level, light in front of you and not behind, plain background,
  wired network if you have one, phone on a hotspot as fallback. Close
  notifications and anything that can appear over a shared screen, and keep your
  notes on paper or a second screen, not the screen you will share.

## Write the debrief before you do anything else

Memory of an interview decays within the hour, and later rounds ask about earlier
ones, so spend ten minutes immediately after each round.

```text
ROUND:     2 of 4, systems design, with the staff engineer
ASKED:     multi-region failover; where I'd put the write path
STORIES:   webhook overlap (do not reuse), migration failure
STUMBLED:  could not give a real number for replication lag budget
THEY SAID: team is 7, two open reqs, they lost a senior last quarter
FOLLOW UP: send the note on quorum reads I promised
OPEN Q:    still do not know who I would report to
```

The stories line prevents repeating yourself across the loop. The "they said"
line accumulates into the diligence picture you need when an offer arrives. The
open line becomes the question you ask in the next round.

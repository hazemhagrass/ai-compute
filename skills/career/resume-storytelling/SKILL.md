---
name: resume-storytelling
description: Use when a resume reads as a job list, not a story. Turn duties into a narrative a reader infers correctly.
---

# Resume Storytelling

A resume that lists duties leaves the reader to infer the story, and readers infer badly. A career change reads as drift. A gap reads as a problem. A lateral move reads as a demotion. A short tenure reads as a firing. None of those inferences were written on the page; the reader supplied them. This skill is about controlling that inference, in one direction only: honestly. Framing is choosing which true facts to foreground. Lying is putting a false fact on the page. The test for everything here: every line must survive a direct question in the interview room. If a rewrite would not survive "walk me through that," it is not a rewrite, it is a fabrication.

This skill owns the narrative. `career/latex-resume` owns the typesetting and ATS mechanics of the resulting document, `career/word-resume-optimizer` owns the .docx variant, and `career/cover-letter-generator` owns letters; do not write letters here. `writing/technical-writing` owns the prose craft the summary and bullets depend on.

## Find the through-line

A non-linear career is one person solving a moving set of problems with a growing toolkit, not a list of unrelated jobs. The through-line is usually a capability or a problem domain, rarely a job title. The test: write one sentence naming what the career is about. If every major bullet could be an instance of that sentence, you have it. If two roles contradict it, either the sentence is wrong or those roles were detours, and detours are exactly what the summary should acknowledge and claim. The through-line goes at the top, before any bullet.

```text
# Bad: no through-line, the reader invents one ("drift")
DB administrator, 2016-2019 -> Support lead, 2019-2021 -> Backend eng.
# Good: the summary claims the arc; every bullet instantiates it
Summary: Engineer who works closest to the customer: started where the
customers are, moved into the code that answers them, and still measures
backend work by user-reported outcomes, not server metrics.
```

## Frame a career change around the transferable problem

The reader's bad inference is "they left because they failed" or "they will leave me too." The fix is not explaining feelings; it is naming the problem you now solve and showing yesterday's work as evidence for it. Lead with the destination, never the departure. The old title is context, in second position, dressed in terms the new field already uses.

```text
# Bad: leads with the departure; reads as escape
Wanted a new challenge, so I moved from marketing to data engineering.
# Good: names the destination problem; the old work is the evidence
Data engineer specializing in pipelines for messy human-entered data.
Five years in marketing analytics means I have personally suffered every
way a campaign source can be miscoded, and I build schemas that survive it.
# Bad: pure old-domain duty, nothing the new field's reader can use
Ran the biweekly email newsletter and the yearly conference booth.
# Good: the transferable part of the same role, foregrounded
Segmented 80k subscribers by behavior in SQL, lifting event attendance
22% against the prior year's attendee list; this is what pulled me into
data work full time.
```

## Handle gaps directly, without apology or concealment

An unexplained gap is a sentence the reader writes about you without your input, and readers write worse sentences than the truth. Caregiving, illness, layoff, sabbatical, and study are ordinary events; the apology is the only thing that makes them look abnormal. One line, facts only, same format as any other entry.

```text
# Bad: concealment; invites the worst guess, and the background check confirms it
2021-2022    (omitted)
# Bad: apology framing; makes an ordinary event a story about fault
2021-2022    Away from work for personal reasons, happy to discuss
# Good: one declarative line; real evidence from the period goes on the entry
2021-2022    Full-time caregiver for a parent; returned to paid work 2022
2021-2022    Sabbatical: completed X certification, built [portfolio]
2019-2020    Parental leave; completed evening coursework in statistics
```
Three rules at the gap boundary: one line, never narrating how hard it was (the reader cannot evaluate that, and it reads as current instability); real evidence from the gap goes on the entry because it converts dead time into partly active time, but only what actually happened; and never shift dates to shrink a gap. Date-shifting is the one framing fix that is a fabrication, and the one background checks catch mechanically.

## Short tenures are verdicts on the fit, not on you

"Job hopper" is beaten by making each departure read as a decision. "The role was not what I expected" reads as poor judgment in the person who joined; "I took it, learned X, and my next move corrected for X" reads as someone who recalibrates fast.

```text
# Bad: bare four-month entry; the reader fills in "fired"
Acme Corp, Engineer, 2022 (4 months)
# Good: context plus what was carried forward, all true
Acme Corp, Engineer (contract-to-hire), Mar-Jun 2022. Team dissolved in
the company's restructuring. Kept the event-driven ingestion design I
built there; it became the core of my next role's system.
```
Two consecutive short stints shown this way read as search, not hop. Five read as hop anyway; group them (below) rather than explaining each.

## Contract, freelance, and agency work

Fragmentation is a formatting artifact as much as a story problem. Six engagements under six client names read as six jobs; the same work under one umbrella entry reads as one role with a portfolio.

```text
# Bad: six entries; the reader counts six job changes
Jan 2024    Beta startup, engagement    Aug 2023    Agency X, engagement ...
# Good: one umbrella period; engagements as scoped sub-bullets
Contract software engineer, 2022-present
 Clients: fintech (payments reconciliation), healthtech (HL7 ingestion)
 - Rebuilt payments reconciliation for [fintech], cutting unmatched
    transactions ~70% (per their finance close reports)
 - Pattern across clients: hired for migrations and integrations, work
    whose scope is known but whose execution is not
```
The umbrella honors "consultant" by showing what was consulted on, and the pattern bullet gives the interview a thesis you can defend because it is your real repeat shape, not positioning.

## The summary: when it earns its space

The summary is the reader's map for everything below. When it works it is three lines: who you are, what problem you solve, and pointers at the evidence. When it fails, it is adjectives plus restatement of the bullets. Both cost the same page space; only one buys anything.

```text
# Bad: adjectives and faith-based claims, zero map
Results-driven multitasker with a passion for excellence seeking growth
in a dynamic environment.
# Good: the through-line sentence plus proof pointers
Payments engineer moving toward risk systems: I have owned money-moving
jobs end to end since 2019 (two fraud-spike mitigations below), and I
want the problem where risk is the whole job, not a side effect.
```
Cut it when it would only restate the first role (one clear career, no reader problem) and spend the space on stronger bullets. A summary earns its slot when the history needs narrative help: career change, gap, contractor portfolio, pivoted seniority.

## Bullets: outcome plus mechanism, never duty

"Responsible for" is the tell of the duty bullet. The fix pairs the outcome (what changed for someone) with the mechanism (how you made it change). Outcome alone reads as strut; mechanism alone reads as motion. One sentence per bullet, one claim per sentence; fused results read as padding even when both are real.

```text
# Bad: duty, no outcome
Responsible for the CI pipeline.
# Bad: motion, no outcome
Migrated CI from Jenkins to GitHub Actions, restructured the job graph,
added self-hosted runner pools, and documented the setup.
# Good: outcome plus mechanism
Cut PR feedback from 25 min to 7 min by moving from one shared Jenkins
box to per-queue GitHub Actions runners, which retired the daily
"who is hogging CI" thread.
# Bad: the tell twice over
Responsible for coordinating between design and engineering teams.
# Good: outcome, mechanism, and institutional consequence
Shipped the mobile redesign 6 weeks early by running a hybrid spec
process (design Figma wires mapped to engineering acceptance criteria);
the org adopted that process for its subsequent product launches.
```

## Quantify honestly when the numbers are confidential

The honesty problem is symmetric: a made-up "40%" is fabrication, and so is a real 40% you are not permitted to disclose. The honest recasts are ratios to a countable whole ("3 of the 7 teams in the org adopted it"), relative state ("from unusable to the default tool the org reaches for"), scale bands ("several hundred concurrent sessions," "low tens of ms"), and percent change without the baseline ("cut unmatched transactions ~70%").

```text
# Bad: invented precision to fill the metric slot
Reduced infrastructure spend by $247,383 annually.
# Bad: a real figure you are not permitted to share
Reduced infrastructure spend by $4.1M annually.   (confidential)
# Good: relative change, no confidential baseline revealed
Cut the infrastructure bill by roughly a quarter by moving batch jobs
to spot capacity; the baseline was seven figures, that much I can say.
```
A scale band you cannot defend crumbles as fast as a number. If you cannot do better than "significant," state a go/no-go fact instead: scope, ownership, velocity. "Owned on-call for 14 services." "Shipped 9 releases in 6 months."

## Ordering and grouping

Strict reverse chronology is the default. Override it only for the reader, in three ways, each with its disclosure:

- Group by relevance when the most relevant roles are not the most recent,
with a small "Earlier: relevant background" section at the bottom so the timeline still exists, just not first.
- Group contractor engagements under an umbrella entry (above). Within a role, lead with the two bullets mapping to the target job, not the
two most recent. Reordering evidence within a truthful set is legitimate selection.

The limit: if a top-to-bottom reading reconstructs a false chronology, the order is lying even though every entry is true. Fix by grouping or a clarifying line, never by hiding a date.

```text
# Bad: two interleaved tracks in date order read as ping-ponging
Track A role, 2024 / Track B role, 2023 / Track A role, 2022
# Good: two sections, each internally chronological, dates intact
Core engineering track
 2022-2024  Track A, Senior Engineer
Ads platform track
 2021-2022  Track B, Engineer
```

## The hard cases

### Demotion

Say what happened, or say nothing and let the reader infer the worst. The honest frame is what changed and what you did about it, as a plan, not a complaint about the title.

```text
# Bad: omission; reads as "their performance declined"
Senior Engineer 2020-2023, Engineer 2023-present (duties unchanged)
# Good: one line on the entry, then evidence you kept the scope
Engineer, 2023-present. Returned voluntarily to the technical track
while staying lead on the payments program; IC title, scope unchanged.
- Continued to own the payments migration, cutting failed payment
 retries 60% in 2024.
```
"Voluntarily," "scope unchanged," and the next role's facts are doing the work. This is summary material too: a reader not yet told the truth fills "performance problems" into the silence.

### Failed startup

Written as work done rather than money lost, a failed startup is usually a better story than a mediocre tenure. The learning is not the point; the shipped artifact and the decisions you owned are.

```text
# Bad: apologia
Founder at StartupCo. Learned hard lessons about market fit, runway,
and humility in an ultimately unsuccessful venture.
# Good: scope and shipped evidence; closure in one word
Founder, StartupCo: built and shipped a developer-facing analytics tool
to 40 paying customers over 18 months; ran the whole stack plus sales.
Shut down in 2023 when the growth path priced the next raise out of reach.
```

### Firing

Never fudge an involuntary exit; a fudge makes references surface it later. Name the situation without blame, then let the next role's outcomes correct it.

```text
# Good: short, true, forward-pointing, owned
Company A, Engineer, 2021-2022. Position eliminated in the 2022
reorganization, the only round in which my team was affected. Moved to
a role doing X, where I have shipped Y inside 6 months.
```
Say it once, in neutral words. Omitting it is legal, but the silence reads as concealment the moment the interviewer asks and you answer live.

## Seniority language that matches the evidence

Overclaiming ("led," "architected," "built from scratch") is the first thing a technical interviewer probes. Claim only what a reference in the room would recognize as true, and state the true mechanism with the scale intact.

```text
# Bad: contractor claiming a team they never held
Led a cross-functional team of 15 engineers.
# Good: the real mechanism, scale intact
Coordinated work across 3 client teams (15 engineers total) as
technical lead of my own 4-person pod.
# Bad: inflated title unmoored from the org
Head of Data (sole person handling data at an 8-person company)
# Good: truthful title and true scope, both on the line
Data lead, company of 8: sole engineer on data, one analyst reporting to me.
```
Down-claim in the catch-up direction too: an IC promoted into a C-suite title at a 3-person startup gets band-misread by enterprise recruiters. Naming the company size inside the entry fixes it without losing the title.

## Retargeting one history at two roles

The facts never change; the selection and the first sentence do. For each target, note what the posting emphasizes, then re-front evidence that already exists.

```text
Target 1: ML infrastructure engineer
 Summary: engineer who has operated training and serving infrastructure
 under real load.
 Lead bullet: migrated model serving for 3 flagship models to a shared
 inference cluster, cutting cold-start latency 65%.
 (Modeling work compresses to one line; it exists, it is not who this
 resume is.)
Target 2: senior data analyst, growth team
 Summary: analyst turned builder who ships their models and owns them
 in production.
 Lead bullet: shipped and maintained 4 recurring forecast models in
 production end to end: features, validation, alerting, refresh.
 (The serving migration shrinks to one clause; the models expand.)
```
Same history, same employers, same dates, same truth. Two readings, selected by the receiver's priorities.

## Workflow

1. Dump every true line about the career, gaps and demotions included, as one
flat unordered list of facts.
2. Write the one through-line sentence.
3. For each gap or short tenure, write the one factual line.
4. Write the summary as if the reader had never seen the bullets.
5. Rewrite bullets as outcome plus mechanism; kill every "responsible for."
6. Reorder for the target; check no reading of the page constructs a false
chronology.
7. Read it as a tired reader in 30 seconds: does it build the intended
inference without needing your side of the story anywhere?
8. For every claim: if asked "how did you do that," can you answer in one
sentence without hedging? If not, down-claim or delete.

## Checklist

- One true through-line sentence sits at the top; every major bullet
instantiates it.
- Every career change is framed by the destination problem, not the departure.
- Every gap has a one-line own-voice explanation: no apology, no narration.
- No date shifted; no number invented; confidential figures cast as ratios,
  scale bands, or relative change.
- Every "Responsible for" is dead; each bullet gives outcome plus mechanism.
- Reordering passes the false-chronology check.
- Every claim survives the room test with a nameable source or method.

## See also

- `career/latex-resume`: typesetting the document so ATS parsers survive it
- `career/word-resume-optimizer`: the .docx variant of the same problem
- `career/cover-letter-generator`: one-page letters sharing the same narrative
- `career/interview-prep`: defending these claims out loud in the room
- `career/salary-negotiation`: what happens when the story works
- `career/linkedin-profile-optimizer`: the same narrative on a profile page
- `career/portfolio-website-builder`: hosting the work samples the bullets claim
- `writing/technical-writing`: prose craft for the summary and bullets
- `research/truth-first`: the invented-statistics failure mode this skill forbids

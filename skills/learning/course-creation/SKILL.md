---
name: course-creation
description: "Use when designing a course or lesson. Design backwards from observable learner behaviour: objectives with verbs, one objective per lesson, practice before performance, and feedback that works without you in the room."
---

# Course Creation

A course is not a body of content. It is a claim that after it, someone can do
something they could not do before. Everything here follows from that: you
decide the doing first, then work backwards to what must be taught.

Boundaries:

- Explanatory prose craft, code samples that run, failure tables, README shape:
  `skills/writing/technical-writing`. Every written lesson page obeys it; do
  not re-derive those rules here.
- Deck structure, assertion titles, slide count against runtime, demo
  fallbacks: `skills/presentation/slide-deck-designer`. If the course is
  delivered live from slides, that skill owns the deck.
- Scripting a video lesson for the ear: `skills/content/video-script-writer`.
- Measuring what learners report afterwards: `skills/research/survey-design`.

## Design backwards from what the learner will DO

Write the final capability first, in the form of a task you could watch someone
perform. Then ask what they must be able to do immediately before that, and
repeat until you reach the starting state you are willing to assume. The course
is that chain, reversed.

Building forwards from what you know produces a tour of your own expertise
ordered by how you learned it, which is almost never the order that gets
someone else to competence.

Bad: "Week 1 history and ecosystem, Week 2 syntax, Week 3 the standard library,
Week 4 a project if there is time."

Good: "End state: ship a CLI that reads a CSV and writes a filtered CSV, with
tests. Immediately before: write a test that fails. Before: run the file.
Before: install the toolchain. Start state: comfortable in a terminal."

## Objectives are observable behaviour, not coverage

An objective names something you could watch happen and agree on. Coverage
language ("understands", "is familiar with", "is aware of", "learns about",
"appreciates") names something inside a head, which you cannot observe, cannot
practise, and cannot assess.

The verb test: if you cannot imagine filming the learner doing the verb, it is
not an objective yet. "Understand" fails. "Write", "trace", "diagnose",
"choose between", "predict the output of", "refactor" pass.

| Coverage phrasing | Observable rewrite |
| --- | --- |
| Understands SQL joins | Can write a query that joins three tables and explain why rows dropped |
| Is familiar with Git branching | Can resolve a merge conflict in a file both branches edited |
| Learns about memory safety | Can point to the line that causes a use-after-free in a given snippet |
| Appreciates good API design | Can rewrite an endpoint that returns 200 on failure so it does not |

Rewriting coverage into behaviour usually changes the course, not just the
wording. "Understands joins" is satisfied by a diagram; "can explain why rows
dropped" forces you to teach the inner/outer distinction with real data where
rows actually disappear.

## A topic list is not an outline

A topic list is ordered by subject matter. A course is ordered by capability.
The topic list produces a lecture because each item's natural completion is
"I have now said everything about this", and nobody's attention survives the
gap between item three and the first time they do anything.

Symptoms that you have a topic list wearing an outline's clothes:

- Items are nouns ("Closures", "Indexes", "The event loop").
- You cannot say which item to cut, because none of them is for anything.
- The project or exercise is at the end, in a section called "Putting it all
  together", which is where courses go to be abandoned.

Fix: convert every noun to a verb phrase, then delete any item that no
downstream objective needs. A topic that supports nothing is your interest, not
the learner's path. Keep it as optional reading if you cannot bear to lose it.

## State prerequisites honestly, then test them in lesson one

Vague prerequisites ("some programming experience helpful") let the wrong
learner enrol, fail in week three, and conclude they are bad at the subject.
Name prerequisites as behaviours, at the same specificity as your objectives,
and put a short diagnostic in the first lesson that exercises each one.

Bad: "Basic Python knowledge required."

Good: "You should already be able to: write a function with a default argument,
read a traceback and name the failing line, and install a package with pip. The
first lesson is a 10 minute self-check on exactly these. If two of the three are
uncomfortable, take [prior course] first; you will not enjoy this one."

The point of the diagnostic is to make leaving cheap and early. A learner who
leaves in lesson one is a success; one who leaves in module four has lost weeks
and blames themselves.

## One objective per lesson

A lesson teaches one thing, gives practice on that thing, and confirms the
learner can do it. The sizing rule: if you cannot state the lesson's objective
in one sentence without "and", it is two lessons.

"Learners can configure the linter and write a custom rule" is two lessons.
Splitting them is not padding; it means the learner who stalls on configuration
stalls in a 20 minute lesson instead of a 90 minute one, and knows exactly what
they stalled on.

Module sizing follows: a module is a set of lessons whose objectives combine
into one capability worth naming. If the module's name is a topic rather than a
capability, the lessons inside it are probably unrelated.

## Practice before performance

Every lesson needs an exercise where the learner produces something: code that
runs, a query that returns rows, a diagram they drew, a decision with a stated
reason. Watching, reading, and scrubbing a video are not practice. A lesson
with no artefact at the end is a lecture with a progress bar.

Ordering within the lesson, worked example first:

1. **Worked example.** You do it completely, narrating the decisions, with
   nothing hidden. The learner follows along or reads.
2. **Faded practice.** The same task with one part removed and left to them.
   Then the same task with more removed. Each step removes scaffolding, not
   support.
3. **Independent problem.** A new instance of the task with no scaffolding,
   phrased in the learner's likely context rather than the teaching example.

Dropping a beginner straight to step 3 is where most self-paced courses lose
people: they have seen it done once and are now being asked to invent the
procedure, which is a much harder task than the one you meant to set.

## Feedback the learner can get without you

Self-paced learners are alone with the exercise at midnight. Design the
feedback loop for that moment. Every exercise ships with at least one of:

- **Expected output**, exact enough to compare against. "Your script should
  print 3 rows; the last one is `dallas,42`."
- **A self-check the learner can run.** A test file, a checksum, an assertion
  in the notebook, a checklist of observable properties.
- **A worked solution, revealed after an attempt.** Behind a details block, a
  separate file, or the next page, so the learner meets it after struggling
  rather than instead of struggling.
- **Diagnostic branches for the common wrong answers.** "If you got an empty
  result, your join is inner and the fixture has a NULL in `region_id`."

The diagnostic branch is the part everyone skips and the part that rescues the
most learners. Write it by doing the exercise wrong on purpose, in the three
ways a beginner most plausibly would, and recording what each one looks like.

## Assess the objective, not what is easy to grade

Multiple choice is easy to grade and almost never matches an objective phrased
as "can write". If the objective is to write a query, the assessment is writing
a query against data you supply. If the objective is to diagnose, the
assessment is a broken thing and a question about why.

Misalignment is visible when the assessment could be passed by someone who
cannot do the objective, or failed by someone who can. A timed quiz on flag
names fails a competent engineer who reads `--help`; it is measuring recall you
never claimed to teach.

Where automated grading forces a narrow format, grade the artefact's observable
properties instead of its text: does the test suite pass, does the output match,
does the endpoint return the right status. That keeps the assessment on the
behaviour even when the grader is a script.

## Structure failures to check for by hand

**The tutorial that only works on the author's machine.** An environment
variable set months ago, a globally installed tool, a data file in the home
directory. Test by running the whole course in a clean container or a fresh
account, from the written steps only, touching nothing you know from memory.

**The exercise that needs a step never taught.** Usually an install, a flag, or
a file layout that you absorbed silently. Build a map of every skill each
exercise requires against the lesson that taught it; an unmatched requirement
is the bug.

**The capstone that needs five untaught skills.** Deployment, auth, CSS, a
cloud account, and error handling suddenly appear in the final project. Either
teach them or cut them from the capstone. A capstone should be a recombination
of taught skills, with at most one new small thing.

**The lesson that cannot fail.** If there is no way to get the exercise wrong,
it is not exercising anything.

## Accessibility is part of the design, not a pass at the end

- Captions on every video, and a transcript as text, which also makes the
  course searchable and usable by people on a train with no headphones.
- Readable code contrast in slides, screenshots, and embedded snippets; verify
  the ratio rather than eyeballing it, and see
  `skills/design/accessibility-audit` for the method.
- Code as selectable text, not as an image, so it can be copied, enlarged, and
  read by a screen reader.
- Do not carry meaning in colour alone (red line, green line) in a diagram a
  learner must interpret.
- Give timing slack: a learner using assistive technology should not be failed
  by a countdown that was set from your own typing speed.

## Iterate on watching a real learner get stuck

Ratings, completion counts, and your own re-read tell you almost nothing about
where the course breaks. The reliable signal is one representative learner,
working through the material while you watch and stay silent, narrating what
they are trying.

- Recruit someone who genuinely meets the stated prerequisites and no more.
- Ask them to think aloud; resist answering, because your answer is the thing
  the course was supposed to contain.
- Record where they pause, re-read, scroll back, or guess. Every one of those
  is a defect with a location.
- Fix the first stall before testing again; stalls are serial, and the later
  ones often disappear once the first is gone.

Three such sessions will change the course more than a year of ratings.

## Quick checklist

- The end capability is written as a task you could watch someone perform.
- Every objective passes the verb test; no "understands" or "is familiar with".
- No outline item is a bare noun.
- Prerequisites stated as behaviours and tested in lesson one.
- One objective per lesson; no objective sentence contains "and".
- Every lesson ends with an artefact the learner produced.
- Worked example, then faded practice, then independent problem.
- Every exercise has expected output, a self-check, or a revealed solution.
- Assessment matches the objective's verb, not the grader's convenience.
- Course runs end to end on a clean machine from the written steps.
- Capstone needs only taught skills.
- Captions, transcripts, contrast checked, code as text.
- At least one real learner observed, silently, before release.

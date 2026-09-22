# Course Creation

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="course-creation robot" width="200">
</div>

A skill for designing courses backwards from what the learner will be able to
do, so the outline produces competence instead of coverage.

## What it does

Turns "I should teach X" into a structure someone can actually finish. It names
the failure modes of course design and gives the replacement for each:

- **Backwards design.** Write the final capability as a task you could watch
  someone perform, then chain backwards to the starting state you assume.
- **Objectives as observable behaviour.** "Can write a query that joins three
  tables" instead of "understands SQL joins". The verb test decides.
- **Topic lists are not outlines.** A list of nouns produces a lecture because
  no item is for anything; verb phrases produce a path.
- **Honest prerequisites, tested in lesson one.** A short diagnostic so the
  wrong learner leaves in ten minutes rather than failing in week four.
- **One objective per lesson.** If the objective sentence needs "and", it is
  two lessons.
- **Practice before performance.** Every lesson ends with an artefact the
  learner produced. Watching a video is not practice.
- **Worked example, faded practice, independent problem.** Scaffolding is
  removed in steps rather than absent from the start.
- **Feedback without you present.** Expected output, a runnable self-check, a
  solution revealed after the attempt, and branches for the common wrong turns.
- **Assessment aligned to the objective**, not to what a grader finds easy.
- **Accessibility and iteration.** Captions, transcripts, contrast, code as
  text; then watch a real learner get stuck and fix the first stall.

## When to use this

- Designing a course, workshop, tutorial series, or onboarding curriculum.
- Rescuing a course that people start and do not finish.
- Reviewing someone else's outline and needing specific feedback instead of
  "looks thorough".
- Converting internal documentation into something that teaches rather than
  describes.
- Writing the exercises and assessments for material that already exists.

Skip it for:

- Prose craft inside a written lesson: `writing/technical-writing` owns
  explanation, runnable samples, and failure tables.
- Deck structure for a live session: `presentation/slide-deck-designer` owns
  slide count, assertion titles, and demo fallbacks.
- Writing a video lesson script for the ear: `content/video-script-writer`.
- Measuring learner satisfaction afterwards: `research/survey-design`.

## Quick start

A colleague has a topic list for "Intro to Postgres Performance":

```text
1. How indexes work
2. EXPLAIN
3. Query planning
4. Vacuum and bloat
5. Putting it all together
```

Five nouns, no learner does anything until section 5. Rebuild it:

1. Write the end capability as a watchable task: **"Given a slow query and a
   real table, the learner can find the cause with EXPLAIN and make it faster."**
2. Chain backwards. To do that they must read an EXPLAIN plan; to read one they
   must know what a sequential scan costs against an index scan; to see that
   difference they need a table big enough for it to matter.
3. Turn each link into one objective with a verb, one per lesson.
4. Give each lesson an exercise with an artefact and a self-check.
5. State prerequisites as behaviours and test them first.

The result:

```text
Prerequisites (self-check, lesson 0): can connect with psql, can write a
SELECT with a WHERE clause, can create a table.

L1  Can load a 1M-row table and time a query two ways.
    Exercise: load the fixture, run the query with and without \timing.
    Self-check: your timing is over 200ms. If it is under 5ms you loaded
    10k rows, not 1M; re-run the generator.

L2  Can read an EXPLAIN plan and name the scan type.
    Exercise: run EXPLAIN on three given queries, write down the scan type.
    Self-check: answers are seq, index, bitmap heap. Solution below the fold.

L3  Can add an index that changes the plan from seq scan to index scan.
    Exercise: add one index, re-run EXPLAIN, paste the before and after.
    Self-check: cost estimate drops by at least an order of magnitude.

L4  Can identify a query an index will NOT help and say why.
    Exercise: three queries, one of them unhelpable; pick it and justify.
```

Note what changed: "Putting it all together" is gone because every lesson
already put something together, and lesson 4 exists because the objective was
"diagnose", which includes the negative case.

## Key concepts

**Backwards design.** Decide the end behaviour, then derive the content. The
forwards alternative orders material by how you learned it, which is rarely the
order that gets someone else to competence.

**The verb test.** If you cannot imagine filming the learner doing the verb, it
is not an objective. "Understands", "is familiar with", and "appreciates" all
fail; "writes", "traces", "diagnoses", "predicts", "chooses between" pass.

**One objective per lesson.** The sizing rule is mechanical: an objective
sentence containing "and" is two lessons. Small lessons mean a learner who
stalls knows exactly what they stalled on.

**Faded practice.** Between the worked example and the independent problem sits
a version of the task with part of the scaffolding removed. Skipping it asks a
beginner to invent a procedure they have seen once.

**Feedback without the instructor.** The learner is alone at midnight. Expected
output, a self-check they can run, a solution revealed after attempting, and
diagnostic branches for the plausible wrong answers.

**Aligned assessment.** The assessment's verb matches the objective's verb. If
someone who cannot do the objective can pass, or someone who can do it can
fail, the assessment is measuring something else.

## Common pitfalls

**Objectives written as coverage.**
Bad: "Students will understand authentication."
Good: "Students can add a login route that rejects an expired token."
Reason: "understand" cannot be practised or assessed, so the lesson drifts into
explanation and the exercise gets invented later, if at all.

**An outline that is a list of nouns.**
Bad: `Closures / Prototypes / The event loop / Async`.
Good: `Can explain why a counter built with a closure keeps its value`.
Reason: a noun's natural end is "I have said everything about this", so it
becomes a lecture and no item can be cut on principle.

**Vague prerequisites.**
Bad: "Some familiarity with the command line is helpful."
Good: "You can already cd into a directory, run a script, and read a
traceback. Lesson 0 checks this in ten minutes."
Reason: the under-prepared learner discovers the gap in week three and blames
themselves instead of the enrolment copy.

**Passive content counted as practice.**
Bad: a 40 minute video, then a quiz on what the video said.
Good: a 10 minute video, then build the thing the video built, on your machine.
Reason: recall of narration is not the capability you claimed; the learner
finds this out at the capstone.

**Independent problem with no worked example first.**
Bad: "Now write a parser for this grammar."
Good: parse one grammar together line by line, then the same grammar with the
rules removed, then a new grammar alone.
Reason: without the fade, the learner is inventing the procedure rather than
practising it, and quits believing the subject is beyond them.

**Exercises with no way to self-check.**
Bad: "Try implementing it and see how you go."
Good: "Your output should be 3 lines, last one `dallas,42`. Empty result means
your join is inner and the fixture has a NULL in `region_id`."
Reason: a learner who cannot tell right from wrong either stops or cements a
mistake, and both are worse than a hint.

**The tutorial that only runs on the author's machine.**
Bad: steps that quietly assume a global install and an env var set last year.
Good: run the whole course in a clean container from the written steps only.
Reason: the first thing every learner hits is setup, and setup failure reads
as "this course is broken" before any teaching happens.

**The capstone that needs untaught skills.**
Bad: a final project requiring deployment, auth, and CSS, none of them taught.
Good: a capstone recombining taught skills, with at most one small new thing.
Reason: the capstone is where the course's promise is either kept or exposed,
and untaught requirements turn it into a second, harder course.

**Assessment chosen for grading convenience.**
Bad: a multiple-choice quiz on flag names for a "can write a query" objective.
Good: a query written against supplied data, graded on the rows it returns.
Reason: it measures recall you never taught and fails competent people who
would have read `--help`.

**Iterating on ratings instead of observation.**
Bad: reading the star average and the one angry review.
Good: sitting silently while one qualifying learner works through it aloud.
Reason: ratings tell you someone was unhappy; watching tells you which
paragraph, which is the only thing you can fix.

## See also

- [`technical-writing`](../../writing/technical-writing/README.md): the prose,
  runnable samples, and failure tables inside each written lesson.
- [`slide-deck-designer`](../../presentation/slide-deck-designer/README.md):
  structure for a course delivered live from slides.
- [`video-script-writer`](../../content/video-script-writer/README.md):
  scripting a video lesson for the ear.
- [`accessibility-audit`](../../design/accessibility-audit/README.md): the
  method behind the captions, contrast, and keyboard checks named here.
- [`survey-design`](../../research/survey-design/README.md): asking learners
  questions afterwards without leading them.
- [`presentation-design`](../../design/presentation-design/README.md): visual
  craft for any slides the course ships.

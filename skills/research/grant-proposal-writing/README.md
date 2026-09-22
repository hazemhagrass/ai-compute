# Grant Proposal Writing

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="grant-proposal-writing robot" width="200">
</div>

Write a research grant proposal that survives a review panel: an answer to the
published scoring criteria, readable under skim conditions, with a budget and
timeline that hold up against the aims.

## What it does

Turns a folder of good intentions into a document a panel can score. The skill
applies rules across the life of a proposal:

1. **Read the funder first.** The published evaluation criteria become the
   proposal's section structure, the order they are listed in sets the order
   of emphasis, and three funded abstracts from the same programme set the
   register the panel expects.
2. **Compress the project to one sentence.** If it cannot survive that, it is
   several projects and the panel will see the seams. Every aim then faces the
   sentence and either serves it or gets cut.
3. **Separate aims, objectives, and methods.** An aim is the change in
   knowledge, an objective is the deliverable that marks it done, a method is
   the reproducible procedure. Proposals that blur the three are the most
   common rejection of the batch.
4. **Argue significance in the panel's vocabulary, not yours.** The panel
   knows your field, not your subfield, so the problem gets stated in terms a
   non-specialist scientist recognises, with a named user of the result.
5. **Prove feasibility without promising outcomes.** Preliminary data pointed
   at the specific risk they retire, named people against named risks, and a
   timeline with fallbacks, while the text carefully never writes a result in
   the past tense before it exists.
6. **Argue the budget line by line.** Every personnel line tied to an aim by
   fraction, equipment justified by the measurement it enables, and animals or
   subjects reconciled against the sample size in the methods.
7. **Resubmit with discipline.** Reviews sorted into three response piles, a
   point-by-point reply in the funder's format, and the headline of what
   changed on the first page.

It also covers the reading conditions: the abstract as the highest-leverage
paragraph, sections that survive being entered cold, and headings that carry
the argument for a skimmer.

## When to use this

Use it when:

- Writing a research grant proposal, fellowship application, or project
  funding request
- Revising a proposal after review comments arrived, for resubmission
- Reviewing a colleague's draft before submission, especially one that reads
  well but has no measurement plan
- Turning a funder's call text into a document outline
- Writing or checking a budget justification, letters of support, or a
  broader impact section

Skip it when:

- Writing the papers the grant will produce: use
  [`academic-paper-writing`](../academic-paper-writing/SKILL.md)
- Designing the study's statistical analysis in detail: use
  [`sql-for-analysts`](../../data/sql-for-analysts/SKILL.md) or the
  data-analysis skills for that layer
- Writing any document other than a funding proposal: use
  [`technical-writing`](../../writing/technical-writing/SKILL.md)
- Assembling or validating the bibliography behind the proposal: use
  [`citation-manager`](../citation-manager/SKILL.md)

## Quick start

**The draft you probably have:** aims that begin "This project aims to
explore", a significance paragraph addressed to your subfield, and a budget
written by the grants office from your headcount.

**Step 1, get the specification.** Copy the funder's evaluation criteria into
your outline as headings, in their listed order. Read three funded abstracts
from the programme and note how specific the aims are and how much preliminary
data a funded proposal carries.

**Step 2, write the one sentence.** "We will determine whether X causes Y, by
Z, in population W." Reject the version joined by "and", because it is two
grants in one envelope. Cut or split aims that fail the sentence.

**Step 3, fix the aims.** Each aim gets a deliverable with a number or named
artefact, a measurement instrument, a sample size or scale, and a stated
interpretation of its own null result. Delete the aim that cannot be marked
done.

**Step 4, write for the skip-reader.** Abstract last, as the highest-leverage
paragraph. Claims in headings. Each section opens with a sentence that
orients a reader who skipped the previous section.

**Step 5, make the budget an argument.** Personnel by named role and fraction
per aim, equipment justified by the measurement it enables, subjects
reconciled against the methods, travel justified by reason rather than
destination.

**Step 6, schedule like someone who has run a project.** Round, pessimistic
early phases; inspectable milestones; a contingency paragraph for the one risk
panels always ask about.

**Step 7, before submitting,** run the checklist at the end of
[`SKILL.md`](SKILL.md) and verify every budget-to-methods consistency and
formatting-rule item by hand.

## Key concepts

- **Evaluation criteria as specification.** The funder's published scoring
  rubric is the document's skeleton; sections that do not map to a criterion
  are either cut or repositioned under one that does.
- **The one-sentence test.** A project describable in one sentence is one
  project; a sentence with two independent claims is two applications sharing
  a form, which reads as incoherence to a panel.
- **Aim versus objective versus method.** Why, what, and how. A deliverable
  is what an objective adds: without one, an aim can absorb any amount of
  time and cannot be judged completed.
- **Measurement plan.** Instrument, detectable effect size, and null-result
  handling, per aim. Its absence is the most reliably fatal single defect in
  proposal review.
- **The gap is a limitation, not a complaint.** "Little is known" reads as
  undone reading; "current methods fail above T (ref)" reads as a question
  with an address.
- **Preliminary data retire risk.** Every preliminary figure exists to show a
  specific aim risk is bounded, not to display past glory.
- **Feasibility versus promise.** Evidence that the risky parts are bounded is
  required; a result written in the past tense before it exists is discounting
  the application.
- **Budget justification as feasibility case.** The money page is scored, and
  each line answers why this amount and what happens to the science if cut.
- **Skim-proof structure.** Panels read under minutes-per-proposal pressure:
  openings carry the argument, headings are claims, sections survive cold
  entry, and the abstract does the work for every reviewer who reads nothing
  else.
- **Broader impact as checkable commitments.** Named people trained, named
  repository and licence for sharing, named community and channel. Claims
  without an accountable person score nothing.
- **Resubmission point by point.** Every review comment quoted and answered,
  changes located in the revised text, contradictions between reviewers named
  and resolved.

## Common pitfalls

**Vague aims that no panel can score.**
Bad: "This project aims to explore the role of X in Y."
Good: "Aim 1. Determine whether X levels above 5 ng/mL predict Y within 90
days, using archived cohort data (n=1,400)."
Reason: "explore" gives no deliverable, no threshold, and no endpoint, so
there is nothing a panel can score and nothing to mark done.

**No measurement plan behind an aim.**
Bad: "We will assess the effect of the intervention on wellbeing."
Good: "...using the WHO-5 index, detecting a 0.3 SD shift with 90% power at
n=120, with a prespecified secondary analysis if the primary result is null."
Reason: without an instrument, a size, and a null interpretation, the aim is
a hope, and "approach lacks detail" is among the standard lines reviewers
write.

**A significance paragraph written for the subfield.**
Bad: "The interplay of A-pathway scaffolding remains underexplored."
Good: "Infections acquired in hospital sicken 7 in 100 admissions because
current rapid tests miss strain class B; a test that sees B changes same-day
isolation decisions for every admission unit in the panel's own institutions."
Reason: the panel is not inside the subfield; a frame in terms of outcomes,
costs, or failures a general scientist recognises is the one that establishes
significance.

**A budget disconnected from the methods.**
Bad: a full-time research assistant line with no aim fractions, while
methods describe one study.
Good: "RA (40%): recruitment and follow-up for Aims 1 and 2, 60 interviews
and transcription, per consent schedule."
Reason: panels audit whether the money buys the science; unexplained effort
and unreconciled subject counts are the inconsistencies they remember.

**Overclaimed feasibility without de-risking.**
Bad: "The PIs have extensive experience in all relevant methods."
Good: "Risk: recruitment. Mitigation: two sites, 90% of target achieved in
our pilot, letters committing serve capacity (Appendix C)."
Reason: an experience claim is unverifiable, while a named risk with a
mitigation and a committed letter is the evidence a feasibility score is
looking for.

**A timeline with nowhere to fail.**
Bad: eighteen sequential months, every estimate optimistic, no fallback.
Good: overlapping phases, round estimates early, "if recruitment hits 60% by
month 12, Aim 2b proceeds on the pilot cohort and the power falls from 0.90
to 0.80, which we state."
Reason: panels have seen schedules fail; a proposal that shows the downside
path reads as run by someone who has run a project.

**Resubmitting without visibly engaging the summary criticism.**
Bad: a revision letter that answers three of seven comments and leaves the
rest, and a revised text whose pages never mention the central complaint.
Good: every comment quoted and answered with a location, and the first page
carrying a summary of what changed.
Reason: the reviewer who wrote the criticism often rereads it; an unresolved
headline issue gets the revision the same score as the original.

## See also

- [`academic-paper-writing`](../academic-paper-writing/SKILL.md) for the
  peer-reviewed output the grant promises to produce
- [`truth-first`](../truth-first/SKILL.md) for whether preliminary data and
  track-record claims are grounded in what was actually done
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for sentence
  craft underneath the proposal structure
- [`citation-manager`](../citation-manager/SKILL.md) for the bibliography
  mechanics behind the references a proposal cites
- [`planning`](../../workflow/planning/SKILL.md) for breaking the funded work
  into checkable stages, which is what the timeline and milestones are
- [`grill-me`](../../workflow/grill-me/SKILL.md) for adversarial
  interrogation of your own aims before the panel does it
- [`skill-authoring`](../../meta/skill-authoring/SKILL.md) for writing skills
  like this one

# Review Comment Phrasing

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="review-comment-phrasing robot" width="200">
</div>

A skill for wording code review feedback so it produces a commit instead of a defence.

## What it does

This skill governs the sentence you type into a review thread. It assumes you
have already decided that something is wrong; its only job is the wording. Each
rule targets a specific phrasing failure that turns a correct finding into a
stalled thread.

| Rule | Prevents |
| --- | --- |
| Attack the code, never the author | "This was written badly": a target with no defect |
| State the problem and its consequence, then the fix | A bare mandate the author cannot evaluate |
| Label blocking versus optional in the first token | Authors treating every nit as gating |
| Ask real questions, never rhetorical ones | "Why a map here?" reading as an accusation |
| Give the reason so the lesson transfers | Fixing one line and reviewing the same thing next week |
| Never leave a verdict without a pointer | "This is confusing" with nothing to act on |
| Praise specifically, and rarely | Ritual "nice work" that carries no information |
| Suggest a diff for trivia | Paragraph-long arguments about a variable name |
| Escalate to a conversation after two round trips | A thread that grows an audience instead of a decision |
| Account for the weight your words carry | A senior "hmm" read as a veto |
| Reviewing someone more senior | Hedging that buries the finding under apology |
| Disagreeing as the author | Silent thread resolution and tone arguments |

Every rule ships with a bad/good pair of real comment text, because the comment
text is the entire substance of the skill. You pattern-match your draft against
the pairs rather than reasoning from principles while annoyed.

## When to use this

Use it when you are:

- About to post an inline comment and the finding is more sensitive than a typo.
- Reviewing work by someone junior to you, where your phrasing sets the norm.
- Reviewing work by someone senior to you, and tempted to soften it into nothing.
- The author of a diff, replying to feedback you think is wrong.
- Writing the review guidelines for a team, or coaching a reviewer whose
  comments keep starting arguments.
- Rereading a thread that has gone three exchanges with no resolution.

Do not use it to decide what to flag. That is a different question with a
different answer, and this skill has no opinion on it.

## Quick start

Before posting any comment, run it through four checks:

1. **Subject check.** Is the grammatical subject a piece of code? If the subject
   is "you", "someone", or an implied person, rewrite it around the symbol or
   the line.

2. **Label check.** Does the comment start with one of these?

   | Prefix | Means | Author must |
   | --- | --- | --- |
   | `blocking:` | Correctness, security, data loss, unchangeable API | Fix before merge |
   | `suggestion:` | Real improvement, not a gate | Respond, may defer |
   | `nit:` | Preference | Nothing; may close silently |
   | `question:` | You genuinely do not know | Answer |
   | `praise:` | A specific good decision | Nothing |

3. **Consequence check.** Does the comment say what breaks and what that costs,
   before it says what to do? If it only says what to do, the author cannot tell
   a requirement from your taste.

4. **Question check.** If the comment ends in a question mark, do you already
   know the answer? If yes, it is an assertion wearing a question mark. Rewrite
   it as the assertion.

Worked example. The draft:

> Why are you not locking this? This is confusing and clearly unsafe.

Fails all four checks: the subject is "you", there is no label, no consequence,
and the question is rhetorical. Rewritten:

> `question:` I traced `flush` from the scheduler and it looks reachable from
> two goroutines, which would make the `count` increment at line 45 racy. Is
> there something upstream that serialises those callers?

If it turns out you do know the answer, the same finding as an assertion:

> `blocking:` `flush` is called from both the scheduler and the HTTP handler, so
> the `count` increment at line 45 races and the metric undercounts. Taking
> `self._lock` around the increment is the smallest fix.

## Key concepts

- **Code as subject.** The sentence's subject decides whether the comment is
  actionable. Code can be changed by a commit; a person can only be defended.

- **Consequence before fix.** A consequence is independently verifiable, so the
  author can confirm it without trusting you. A fix with no consequence attached
  is indistinguishable from a preference, and gets treated as one.

- **Explicit severity.** Authors cannot read severity from tone, and when in
  doubt they guess high. An unlabelled nit therefore costs a rewrite of working
  code. The prefix is cheap; the guess is not.

- **Genuine versus rhetorical questions.** A question you know the answer to
  spends a round trip on the author decoding your intent. Genuine questions
  probe things the diff cannot answer: concurrency, failure ordering, deploy
  sequencing, upstream guarantees.

- **Transferable reasons.** The fix teaches one line. The reason behind it
  teaches the next twenty diffs and takes you out of the loop.

- **Pointer discipline.** Verdict words ("confusing", "messy", "smells") are
  conclusions with the evidence removed. Describe your own reading failure
  instead: what you expected, what you found, where.

- **Asymmetric weight.** The same four characters mean different things from
  different people. Seniority, tenure, approval rights, and being a native
  speaker of the review language all amplify terseness into judgement, so state
  opinion strength explicitly rather than relying on tone.

- **Round-trip budget.** Text has a failure point, and it is roughly two
  exchanges. Past that, switching medium is cheaper than a third attempt at the
  same paragraph.

## Common pitfalls

- **Softening until the requirement disappears.** "Maybe we could possibly think
  about not dropping the table" is ambiguity, not kindness. Politeness lives in
  the framing, never in the strength of the claim.

- **The compliment sandwich.** Praise glued to the front of a `blocking:`
  comment reads as technique and devalues the praise you gave honestly last
  week. Post them as separate comments.

- **Label inflation.** Marking a third of your comments `blocking:` empties the
  label, and the author starts negotiating all of them instead of fixing the two
  that matter.

- **Label contradiction.** "`nit:` though I would not merge this" is a blocking
  comment in disguise. It teaches the author that your labels are decoration.

- **Paragraph-length nits.** Length signals importance regardless of the prefix.
  If the point is trivial, it fits in one line or arrives as a suggested diff.

- **Bare reactions.** "hmm", a shrug, or a lone emoji on a line asks the author
  to guess at a fault you did not name. Either state the concern or drop it.

- **Sarcasm and idiom.** "Did you mean to leak this?" and "surely this cannot be
  right" are the first things lost when a colleague is reading in a second
  language, and the first things read as contempt.

- **Repeating yourself louder.** Linking to your earlier comment and restating
  it is the failure mode that two-round-trip escalation exists to prevent.

- **Silent thread resolution.** As the author, closing a reviewer's thread with
  no reply is the author-side rhetorical question: it communicates a position
  while refusing to state it.

- **Arguing about the phrasing instead of the defect.** If a reviewer's comment
  was rude but its claim was correct, answer the claim first. The phrasing
  conversation is a separate one, and often better had off-thread.

## See also

- [`engineering/code-review`](../../engineering/code-review/) for what to look
  for, in what order, and how to scope and close a review. That skill decides
  the finding; this one words it.
- [`writing/technical-writing`](../technical-writing/) for the same
  specific-and-actionable instinct applied to docs, READMEs, and changelogs.
- [`workflow/grill-me`](../../workflow/grill-me/) for the inverse posture:
  pressure-testing a design when you want the objections aimed at you.
- [`engineering/debugging`](../../engineering/debugging/) for building the
  evidence behind a consequence claim before you assert it in a thread.
- [`engineering/refactoring`](../../engineering/refactoring/) for judging whether
  a structural suggestion is worth raising in review at all.

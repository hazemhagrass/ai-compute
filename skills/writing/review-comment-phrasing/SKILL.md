---
name: review-comment-phrasing
description: "Use when phrasing review feedback. Blame code not people. Label severity, state the consequence before the fix, and ask only real questions."
---

# Review Comment Phrasing

This skill is about the sentence, not the search. Deciding what to flag belongs
to code review proper; this is how you word the flag so it produces a commit
instead of a defence. A correct finding phrased badly costs you the finding and
some of the relationship.

For what to look for, in what order, and which severity label to attach, see
`../../engineering/code-review/SKILL.md`.

## Attack the code, never the author

- Make code the grammatical subject: "this loop" can be changed by a commit,
  "you" can only be defended.
- Never use the passive voice to hide a judgement of the person. "This was
  written badly" has no actionable content and an unmistakable target, which is
  the worst possible combination.
- Drop every adjective that grades effort or care: sloppy, lazy, careless,
  obvious, trivial, basic. They add zero information about the defect.

Bad:
> This was written badly, someone clearly did not think about performance.

Good:
> `blocking:` this loop calls `append` on a fresh slice each iteration, so it
> reallocates once per row. Hoisting the allocation above the loop and
> preallocating to `len(rows)` makes it one allocation.

Bad: "You clearly do not understand how our auth middleware works."

Good: "`blocking:` this route registers before `requireSession`, so the handler
runs for anonymous callers. Moving the registration below line 40 puts it inside
the authenticated group."

## State the problem and its consequence, then the fix

- Lead with what breaks and what that costs. A consequence is verifiable, so the
  author can confirm it themselves instead of taking your word.
- Offer the fix as one option, not the only one. The author holds context you
  do not, and may have a cheaper route to the same outcome.
- Never send a fix with no stated problem. The author then cannot tell whether
  it is a correctness requirement or your taste, so they guess, and half the
  time they guess wrong.

Bad:
> Use a `defer` here.

Good:
> `blocking:` if `decode` returns an error at line 31 the file handle opened on
> line 24 stays open, so a malformed upload leaks a descriptor per request. A
> `defer f.Close()` right after the open is the smallest fix; moving the decode
> into its own function also works if you prefer that shape.

Bad: "Move this into a service class."

Good: "`suggestion:` the handler now owns both HTTP parsing and the discount
rules, so the discount tests have to build a request object to run. Whatever
shape you like, pulling the rule evaluation behind a plain function would let
those tests pass values directly."

## Label blocking versus optional in the first token

- Prefix every comment with one of `blocking:`, `suggestion:`, `nit:`,
  `question:`, `praise:`. Authors cannot infer severity from tone, and they
  consistently guess high, so unlabelled nits get treated as gating.
- Say explicitly that a nit may be closed without reply, or a junior author will
  rewrite a working function over a naming preference.
- Keep `blocking:` scarce. If a third of your comments block, the label stops
  meaning anything and the author starts negotiating all of them.
- Never let the prefix contradict the body. "`nit:` but I really would not merge
  this" is a blocking comment wearing a costume, and it teaches the author to
  distrust your labels.

Bad:
> I would call this `userRecord`. Also the retry has no ceiling, that will spin
> forever against a dead upstream. And the comment on line 12 is stale.

Good:
> `blocking:` the retry loop at line 88 has no attempt ceiling, so a permanently
> failing upstream spins until the request times out.

> `nit:` `u` reads as a user ID to me; `userRecord` would have saved me a
> lookup. Close this without replying if you disagree.

> `nit:` comment on line 12 still describes the old cache key.

## Ask real questions, never rhetorical ones

- Ask a question only when you do not know the answer. A question you already
  know the answer to reads as a trap, and the author spends the round trip
  working out what you actually want.
- Convert "why did you" into a statement of the cost. "Why" invites
  justification of the person; a stated cost invites a change to the code.
- Good questions probe a scenario you genuinely cannot resolve from the diff:
  concurrency, failure order, deployment sequencing, upstream guarantees.

Bad:
> Why a map here?

Good:
> `question:` is the key set bounded? If callers can pass arbitrary tenant IDs
> this map grows for the process lifetime, and I could not tell from the callers
> in this diff.

Bad: "Did you mean to swallow this exception?"

Good: "`blocking:` the `except Exception: pass` at line 60 hides write failures,
so a failed publish looks like a success to the caller. If some failures really
are ignorable, catching those specific types and logging the rest keeps the
signal."

Bad: "Is this thread safe?"

Good: "`question:` what happens if two writers reach line 45 at the same time? I
see the read guarded by `self._lock` but not the increment, and I do not know
whether this class is ever shared across workers."

## Give the reason so the lesson transfers

- Attach the underlying rule to the specific fix. A fix teaches one line; a
  reason teaches the next twenty diffs and removes you from the loop.
- Skip the lecture when the author already demonstrated the rule elsewhere in
  the diff. Point at their own line instead.

Bad: "Use `Decimal` here."

Good: "`blocking:` `price * quantity` in float loses cents on repeated addition,
and this total feeds the invoice. Money in this repo goes through `Decimal` for
that reason; `billing/totals.py` is the existing example."

## Never leave a verdict without a pointer

- Replace "confusing", "messy", "smells", "not idiomatic" with the specific
  thing that confused you and the moment it happened. A verdict with no pointer
  cannot be acted on, so the author either guesses at a rewrite or ignores you.
- Describe your own reading failure rather than grading the code. "I expected X
  and found Y" is checkable; "this is unclear" is not.

Bad:
> This whole function is confusing.

Good:
> `suggestion:` I misread `sync` twice: the name says it pushes local state up,
> but it also deletes remote rows that are missing locally. Either
> `reconcile` as a name or a one-line comment about the delete would have
> stopped me re-reading it.

Bad: "This does not feel idiomatic."

Good: "`nit:` the manual index loop at line 70 is the only one in this package;
every other iteration here uses a range loop, so this one made me look for a
reason."

## Praise specifically, and rarely

- Praise a decision, not the diff. "Nice work" carries no information and, said
  on every review, becomes a ritual the author learns to skip.
- Praise the non-obvious choice: the deleted code, the test for the ugly case,
  the boring solution chosen over a clever one. That is the behaviour worth
  reinforcing.
- Never use praise as an anaesthetic for the criticism that follows. A
  compliment glued to a `blocking:` comment reads as technique, and it devalues
  the real praise you gave last week.

Bad:
> Great job on this! Just one tiny thing, the query is unindexed and will table
> scan.

Good:
> `praise:` deleting the old `LegacyAdapter` path in the same change is what
> makes this readable; thank you for not leaving both.

> `blocking:` the new `WHERE tenant_id = ?` has no index behind it, so this
> table scans at current row counts.

## Suggest a diff for trivia instead of describing it

- Use the platform's suggested-change block for anything mechanical: a name, a
  typo, an argument order, a missing `await`. One click ends it, where a prose
  description invites a counter-proposal about something that does not matter.
- If you cannot be bothered to write the suggested diff, that is strong evidence
  the comment is not worth making at all.
- Never write a paragraph arguing for a preference. Paragraph length signals
  importance, so a long comment about a variable name reads as blocking.

Bad:
> I think the parameter order would be more natural the other way around, since
> most of our other helpers take the context first, and it reads better when the
> subject comes after the context, although either is fine really.

Good:
> `nit:` context first, to match the other helpers in this file.
>
> ```suggestion
> func applyDiscount(ctx context.Context, order Order) (Order, error) {
> ```

## Escalate to a conversation after two round trips

- Move to a call, a shared screen, or a pairing session once a single thread has
  two failed exchanges. Text has already failed at that point, and a third
  attempt usually adds an audience rather than a resolution.
- Say why you are moving it, so the switch does not read as escalation to
  authority: "I think we are describing different failure modes, quicker to
  sketch it."
- Write the outcome back into the thread afterwards. The next reader of the
  history needs the decision, and an unresolved thread that ends in silence
  looks like the reviewer gave up.
- Never continue a disagreement across multiple inline threads. Collapse it into
  one, in the PR description or a single top-level comment.

Bad:
> As I said above, this still does not handle the partial-failure case. See my
> earlier comment.

Good:
> `blocking:` I think we are talking past each other on what "partial" means
> here. Free for ten minutes to sketch the sequence? I will post whatever we
> land on back in this thread.

## Account for the weight your words carry

- Assume your terse reaction lands harder than you intend when you have
  seniority, tenure, or approval rights. A staff engineer's "hmm, not sure about
  this" is read as a veto, and the author silently rewrites working code.
- Spell out the strength of the opinion when you are senior to the author:
  "weak preference, your call" or "this one I do want changed before merge".
  Explicit strength beats tone every time.
- Never post a reaction with no content: a bare "hmm", a shrug, or a lone emoji
  on a line makes the author guess at a fault you did not name.
- Write for colleagues reading in a second language: short sentences, no idiom,
  no sarcasm, no "surely". Irony is the first thing lost in translation and the
  first thing read as contempt.
- Drop softeners that obscure a hard requirement. "Maybe we could possibly think
  about not dropping the table" is not kindness, it is ambiguity about a
  blocking defect.

Bad:
> hmm

Good:
> `question:` weak opinion, your call, but I paused at the second cache layer
> here. What does it buy over the existing `userCache`?

## Reviewing someone more senior

- Use the same labels and the same directness. Hedging invents a hierarchy the
  author did not ask for and buries the finding under apology.
- State your evidence and your uncertainty separately, so a knowledge gap does
  not discredit a real observation.
- Ask rather than assert when the design may encode context you lack, but ask
  about the code, not for permission to comment.

Bad:
> Sorry, this is probably just me not understanding, feel free to ignore, but
> should this maybe possibly be locked?

Good:
> `question:` I traced `flush` from the scheduler and it looks reachable from
> two goroutines, which would make the counter increment racy. Is there a
> constraint upstream that serialises those callers?

## Disagreeing as the author

- Answer the stated consequence, not the tone. If the reviewer claimed a leak,
  show why it does not leak; arguing about how the comment was phrased loses
  you the technical point.
- Reply with the constraint that drove your choice, and say what would change
  your mind. That converts a standoff into a shared decision.
- Say plainly when you will not change it, and why, rather than going quiet.
  Silence on a thread reads as either agreement or contempt, and reviewers
  cannot tell which.
- Ask for the rule when you get an unexplained mandate. "What breaks if I leave
  it?" is a fair question and usually resolves the thread in one exchange.
- Never resolve a reviewer's thread without a reply. Closing it silently is the
  author-side version of a rhetorical question.

Bad: "Disagree, this is fine."

Good: "I kept the duplicate validation on purpose: the queue consumer can be
invoked from the replay tool, which bypasses the HTTP layer entirely, so the
handler check does not cover it. Happy to pull both into one shared validator if
you would rather have a single home for it."

## Quick checklist

- Code is the subject of every sentence; no adjective grades the author.
- Every comment opens with `blocking:`, `suggestion:`, `nit:`, `question:`, or
  `praise:`, and the body matches the label.
- Each finding names the symbol or line, the consequence, then optionally a fix.
- Every question is one you cannot answer yourself, and every ask carries its
  reason or a link to the convention.
- No verdict word ("confusing", "messy") without the specific pointer.
- Trivia arrives as a suggested diff or not at all.
- Two failed round trips means a call, with the outcome written back.

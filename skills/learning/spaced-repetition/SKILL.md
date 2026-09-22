---
name: spaced-repetition
description: "Use when building flashcards for spaced repetition. Write cards that force recall of one fact, and prune the deck before review debt buries you."
---

# Spaced Repetition

For anyone who has installed Anki, Mochi, or a homegrown scheduler and is about
to type their first card. You will end with cards that survive six months of
review and a deck small enough that you still open it.

Not for: learning a skill (playing guitar, writing code, diagnosing a patient),
building judgement, or understanding a concept for the first time. Those need
practice, feedback, and explanation. Spaced repetition retains discrete facts
you already understand. It does nothing else.

## The algorithm is not the skill

Every scheduler implements the same shape: answer a card correctly and its next
review moves further away; fail it and the interval collapses back toward a day.
SM-2, FSRS, Leitner boxes, and a hand-drawn set of paper boxes all do this. They
differ in how they pick the next date.

That difference is real but small compared with what you control. A well-written
card is cheap to review and hard to fail for the wrong reason. A badly written
card wastes every repetition the scheduler ever hands it, on any scheduler.

So: pick whatever tool you will actually open daily, accept its defaults, and
spend your attention on the cards. This skill has nothing to say about which
scheduler is better, because tuning the scheduler is not where your losses are.

Two findings underpin the whole practice, and both are established enough to
state plainly without a citation being needed to make them credible:

- The **spacing effect**: material reviewed at intervals is retained better than
  the same material reviewed in one block.
- The **testing effect**: retrieving an answer from memory strengthens it more
  than re-reading the same material.

Do not attach percentages, dates, author names, or forgetting-curve numbers to
those two sentences unless you have the source in front of you. The effects are
well supported; the precise figures people quote usually are not.

## One fact per card

This is the minimum information principle, and it is the single rule that
decides whether a deck works.

A card holding three facts fails when any one of the three is forgotten. Worse,
you cannot tell which one. The scheduler sees "failed", resets the interval, and
drags the two facts you already knew back through short intervals with the one
you did not. You pay triple for one gap, and the gap never gets isolated.

Split the card. Three cards each carrying one fact fail independently. The two
you know drift out to long intervals and stop costing you anything; the one you
do not know comes back tomorrow, which is exactly what you wanted.

### Worked rewrite

Before, one card:

> **Front:** HTTP 429
>
> **Back:** Too Many Requests. Sent when a client exceeds a rate limit. The
> response may include a `Retry-After` header giving seconds or an HTTP date.

Three facts are hiding in that back: the status name, the condition that
triggers it, and the header that accompanies it. Miss the header and the whole
card is marked failed.

After, three cards:

> **Front:** HTTP status code for a client exceeding a rate limit?
>
> **Back:** 429

> **Front:** What does HTTP 429 mean?
>
> **Back:** Too Many Requests

> **Front:** Which header tells a client when to retry after a 429?
>
> **Back:** `Retry-After`

Each one can be failed alone. Each one is answerable in under three seconds,
which is what makes a 200-card daily queue survivable.

Note the first card is phrased from the need (a rate limit) to the code, not
from the code to the meaning. Decide which direction you actually use. If you
read logs, you need code to meaning. If you write servers, you need situation to
code. If you need both, make both cards deliberately, not by reflex.

## Cloze deletion, and when it wins

A cloze card hides part of a sentence:

> The TCP handshake is SYN, {{c1::SYN-ACK}}, ACK.

Cloze wins when the fact lives inside a structure you also want to keep: an
ordered sequence, a formula, a line of code, a legal subsection. The surrounding
text is the retrieval cue, and writing it as question/answer would force you to
invent an awkward question ("What is the second step of the TCP handshake?")
that you would never ask yourself in real life.

Question/answer wins when the cue is a genuine question you face in the wild:
"What does this error mean?", "What is the dose for an adult?", "What is the
Spanish for shoulder?" Here the question form matches the moment of use, and a
cloze would leave you recalling a sentence rather than an answer.

Cloze fails badly in one specific way: over-deleting. A sentence with five
deletions is a multi-fact card wearing a disguise. Keep it to one deletion per
card unless the deletions are trivially linked (a two-word phrase).

## Copying text verbatim produces recognition, not recall

Pasting a paragraph from a textbook onto a card and putting a heading on the
front does not make a flashcard. It makes a re-reading prompt. You look at the
back, feel the familiarity of text you have seen before, and mark it correct.
That feeling is recognition. It is not what you need at 3am on a ward or in a
production incident, where nothing is in front of you to recognise.

The test is mechanical: can you answer out loud, before revealing the back, in a
few words? If the back is a paragraph, the answer is no, and you will never
honestly grade it.

Rewrite pasted text into a question whose answer is short enough to say. If the
paragraph contains five facts worth keeping, that is five cards, and probably it
contains one.

## Cards that matter versus trivia

Run every candidate card through one filter: **would knowing this change what I
do?**

Passes:

- The keyword that makes a Postgres index partial. You will type it.
- The Spanish word for "receipt". You will ask for one.
- The statutory notice period for a particular contract type. You will advise on
  it.
- The first-line drug for a condition you treat.

Fails:

- The year an RFC was published, when you never cite years.
- The exact default value of a config flag you can read in one second.
- Every one of the fifty methods on an API when you use six.
- Trivia about a language you are learning that a native speaker would not know.

Facts you can look up in five seconds, from a source you always have open, are
usually not worth a permanent daily obligation. Facts you need mid-sentence,
mid-procedure, or mid-conversation are.

## Never memorise what you have not understood

A card for a fact you do not understand is a card you will fail forever. There
is no cue to reconstruct the answer from, so each review is a coin flip, and the
scheduler responds by showing it to you more often. This is how a deck rots: a
handful of un-understood cards consume a growing share of every session.

These are **leeches**. Most tools tag a card as a leech automatically after a
threshold of lapses.

Handle a leech in exactly one of three ways:

1. **Go and understand it.** Read the explanation, work the example, ask
   someone. Then rewrite the card from your understanding. Most leeches are
   comprehension failures, not memory failures.
2. **Rewrite it.** If the fact is understood but the card is ambiguous,
   overloaded, or has a cue that matches two different answers, fix the card. An
   interfering pair (two cards with near-identical fronts) is a common cause;
   add distinguishing context to both fronts.
3. **Delete it.** A fact you do not need enough to go and understand is a fact
   you should not be reviewing.

Suspending a leech and leaving it suspended is deletion with extra steps. That
is fine; just be honest that you dropped it.

## Review debt is real and it compounds

Every card you add is a promise to review it, in some form, for as long as you
want to retain it. That obligation does not expire.

Mature cards are cheap individually and expensive in aggregate. Rough shape,
without claiming precise figures: a card settling into a multi-month interval
still lands on some day. Thousands of such cards land every day.

The failure mode is always the same. You add 50 cards a day for two weeks
because you are motivated. Those 700 cards come back, layered on top of each
other, at intervals that overlap. The daily queue hits an hour. You skip a day.
The queue hits ninety minutes. You skip a week. Now the backlog is unrecoverable
and you delete the deck.

Defences, in order of effectiveness:

- **Cap new cards per day** in the scheduler and leave the cap alone. A low
  number you sustain beats a high number you abandon.
- **Add cards only when you meet the fact in real work.** Cards harvested from a
  textbook chapter you have not used are the ones that become leeches.
- **Prune on sight.** When a card comes up and you think "I do not need this",
  delete it during the review. Do not defer to a cleanup session.
- **Cap total deck size** for a given subject. Hitting the cap forces the
  question of what is least useful, which is a better question than "what else
  could I add".

A deck of 300 cards you review daily is worth more than 3,000 you review never.

## Honest scope

Spaced repetition retains discrete, well-understood facts. State that boundary
to anyone you recommend it to, because overselling it is how people conclude the
whole method is useless.

| Good fit | Why |
| --- | --- |
| Language vocabulary and inflections | Discrete pairs, high volume, needed instantly in speech |
| Medical terminology, drug names, doses | Discrete, high stakes, needed without lookup |
| API surface you use often | Discrete, and lookup breaks flow |
| Legal codes, section numbers, deadlines | Discrete, exact wording matters |
| Anatomy, taxonomy, named parts | Discrete labels attached to a structure |

| Poor fit | Use instead |
| --- | --- |
| Writing idiomatic code | Write code, get review |
| Clinical judgement | Supervised practice, case discussion |
| Understanding a proof or an architecture | Work it through, explain it to someone |
| Conversational fluency | Conversation |
| Anything you have not understood yet | Learn it first, then card it |

A deck can support the fits in the second table by removing the lookup tax on
facts those skills depend on. It cannot replace the practice.

## Checklist before you add a card

- The fact carries exactly one thing to recall.
- You understand why it is true, not just that it is.
- The answer is short enough to say out loud.
- The front is not copied text with a heading pasted above it.
- Knowing it would change something you do.
- You are under your daily new-card cap.

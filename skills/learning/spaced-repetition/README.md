# Spaced Repetition

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="spaced-repetition robot" width="200">
</div>

A skill for writing flashcards that hold one fact each, survive months of review, and stay in a deck small enough that you keep opening it.

## What it does

Most advice about spaced repetition is about schedulers. This skill is about
cards, because that is where the losses actually are. It covers:

- **The minimum information principle**: one fact per card, and why a card
  carrying three facts fails whenever any one of them is forgotten while telling
  you nothing about which one.
- **A worked rewrite**: an overloaded card split into three, with the actual
  front and back text before and after.
- **Cloze deletion versus question/answer**: which cue form matches which kind
  of fact, and the over-deletion mistake that turns a cloze back into a
  multi-fact card.
- **Verbatim text**: why pasting a paragraph onto the back produces recognition
  when you revealed it, not recall before you revealed it, and the out-loud test
  that catches it.
- **The usefulness filter**: "would knowing this change what I do", applied to
  separate cards worth a permanent obligation from trivia.
- **Understanding before memorising**: why a card for an unexplained fact is a
  card you will fail forever, and how those leeches consume a growing share of
  every session.
- **Leech handling**: understand it, rewrite it, or delete it. Never keep
  failing it.
- **Review debt**: cards are a daily obligation that compounds, the arithmetic
  of adding 50 a day, and the caps and pruning habits that keep a deck alive.
- **The algorithm in plain terms**: intervals grow on success and collapse on
  failure, with no claim that any particular scheduler is superior.
- **Honest scope**: which subjects fit (vocabulary, terminology, API surface,
  legal codes) and which do not (skills, judgement, understanding).

Two findings sit under the whole practice and are stated as established without
invented numbers: the spacing effect (spaced review beats massed review) and the
testing effect (retrieval beats re-reading). The skill deliberately attaches no
percentages, dates, or forgetting-curve figures to either.

## When to use this

Concrete triggers:

- You are about to type your first card into Anki, Mochi, or anything similar.
- A card keeps coming back and you keep failing it, and you have started
  pressing "again" without reading it.
- Your daily queue has crossed an hour and you are beginning to skip days.
- You have a backlog of several hundred due cards and are deciding whether to
  reset the deck.
- You pasted a textbook paragraph onto a card back and it felt wrong.
- You are copying a vocabulary list or a drug formulary into a deck wholesale.
- Someone asked you to recommend a study method and you want to describe what it
  does and does not do.
- You are about to spend an evening tuning scheduler parameters instead of
  fixing cards.
- A card's front could honestly be answered two different ways and you grade it
  differently each time.

Skip it when:

- You are learning a skill: writing code, playing an instrument, examining a
  patient. Practice with feedback, not cards.
- You do not yet understand the material. Understand it first; a card built on
  confusion has no cue to reconstruct from.
- You need the fact once, for an exam next week. Cramming is a different tool
  and is fine for that job.
- The fact is one keystroke away in a reference you always have open and the
  lookup does not break your flow.

## Quick start

Take one card you already have and split it. Here is the full rewrite.

The card before, as typed by someone reading HTTP documentation:

```
Front: HTTP 429

Back:  Too Many Requests. Sent when a client exceeds a rate limit. The
       response may include a Retry-After header giving either a number of
       seconds or an HTTP date.
```

Three separate facts live in that back: the status name, the condition that
triggers it, and the header that comes with it. Forget the header and the card
is marked failed, the interval resets, and the two facts you did know come back
tomorrow alongside the one you did not.

The cards after:

```
Front: HTTP status code for a client exceeding a rate limit?

Back:  429
```

```
Front: What does HTTP 429 mean?

Back:  Too Many Requests
```

```
Front: Which header tells a client when to retry after a 429?

Back:  Retry-After
```

Each one fails alone. Each answer can be said out loud in under three seconds,
which is what makes a queue of a few hundred cards survivable.

One decision is embedded in the first card: it runs from the situation (a rate
limit) to the code, not from the code to its meaning. Pick the direction you
actually need. Reading logs needs code to meaning; writing servers needs
situation to code. If you genuinely need both, make both cards on purpose
rather than by reflex.

Then do three things before you add anything else:

1. Set the new-cards-per-day cap in your tool to a number you would still accept
   on your worst week, and leave it there.
2. Run each existing card through the out-loud test. If the answer is a
   paragraph, rewrite it or delete it.
3. Check your leech-tagged cards. Each one gets understood, rewritten, or
   deleted today.

## Key concepts

**Minimum information principle.** One fact per card. A multi-fact card fails as
a unit and gives you no information about which part is weak, so you pay for
every fact whenever any fact is forgotten.

**Recall versus recognition.** Revealing a paragraph and feeling that it looks
familiar is recognition. Producing a short answer from nothing is recall. Only
the second transfers to a situation where the material is not in front of you.

**Cloze deletion.** Hiding part of a sentence so the surrounding text provides
the cue. Best for ordered sequences, formulas, code lines, and statutory text
where the structure matters. One deletion per card; several deletions rebuild
the multi-fact problem.

**Question/answer.** Best when the cue is a question you actually face: what
does this error mean, what is the dose, what is the word for this. The card
matches the moment of use.

**The usefulness filter.** "Would knowing this change what I do?" Passing cards
get a permanent daily obligation. Failing cards get a lookup.

**Leech.** A card you keep failing, usually because the underlying fact was
never understood or because the card is ambiguous. Tools tag these after a
threshold of lapses. Three legitimate responses: understand it and rewrite,
rewrite for clarity, or delete.

**Review debt.** The compounding daily cost of a growing deck. Mature cards are
individually cheap and collectively expensive, and the queue does not forgive
skipped days. This is the mechanism behind almost every abandoned deck.

**The algorithm, plainly.** Answer correctly and the next review moves further
out; fail and the interval collapses back toward a day. SM-2, FSRS, and physical
Leitner boxes all implement that shape and differ only in how they pick the
next date. Use whichever tool you will actually open.

**Scope.** Retention of discrete facts you already understand. Not skill, not
judgement, not first-time understanding.

## Common pitfalls

- **Tuning the scheduler instead of fixing cards.** The scheduler cannot rescue
  a card that is ambiguous or overloaded. Effort spent on parameters is almost
  always effort taken from card quality.
- **Adding 50 cards a day because you are motivated this week.** Those cards
  come back, overlapping, for months. Motivation is not a review budget.
- **Pasting source text onto the back.** It produces a re-reading prompt you
  will grade generously and never honestly fail.
- **Making both directions of every card automatically.** Half of them test a
  retrieval you never perform, and each one still costs daily time.
- **Over-deleting a cloze.** Five deletions in one sentence is a multi-fact card
  with different syntax.
- **Keeping a leech on suspension and calling it handled.** That is deletion
  with extra steps. Fine to do; be honest that you did it.
- **Carding material you have not understood.** There is no cue to reconstruct
  from, so every review is a coin flip and the scheduler responds by showing it
  more often.
- **Interfering pairs.** Two cards with near-identical fronts and different
  answers will each pull the other down. Add distinguishing context to both
  fronts or merge them.
- **Deferring pruning to a cleanup session.** The session never happens. Delete
  during review, at the moment you think "I do not need this".
- **Selling it as a way to learn a subject.** Overselling is why people try it,
  find it does not build understanding, and conclude the whole method is
  worthless.
- **Quoting retention percentages and forgetting-curve numbers.** The spacing
  and testing effects are well supported; the precise figures passed around
  online usually trace back to nothing checkable.

## See also

- [SKILL.md](SKILL.md) - the full skill: the minimum information principle, the
  worked card rewrite, cloze versus question/answer, leech handling, review debt
  arithmetic, and the scope table.
- [technical-writing](../../writing/technical-writing/SKILL.md) - the same
  discipline applied to documents: lead with the action, state what a thing is
  not for, and keep every example runnable as written.
- [truth-first](../../research/truth-first/SKILL.md) - how to state an
  established finding without inventing a citation, and why numbers are the most
  dangerous claims to repeat unchecked.
- [literature-review](../../research/literature-review/SKILL.md) - for tracking
  down the primary sources behind the spacing and testing effects if you need to
  cite them rather than simply apply them.

# Cover Letter Generator

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="cover-letter-generator robot" width="200">
</div>

Write a cover letter that says something the resume cannot, or decide honestly not to send one.

## What it does

Treats the cover letter as a document with exactly one job: explaining why this
role, at this company, and what you would do inside it. The resume already lists
what you did. A letter that restates it in paragraph form spends the reader's
attention to deliver information they are holding in their other hand.

The skill applies rules in four stages:

1. **Find the content only a letter can carry.** The reasoning the bullets have
   no room for: why you are pointed at this problem, what you would touch first,
   why the strange line on the resume is not strange.
2. **Research until the letter is unforgeable.** Twenty minutes in the posting,
   the engineering blog, the docs, and the product itself, until the first line
   could not be pasted into another application by swapping the company name.
3. **Write to a fixed shape.** Four short paragraphs, roughly 250 to 400 words:
   a factual opening, two or three requirements mirrored in the posting's own
   nouns with evidence attached, the letter's own content (a gap, a transition,
   or the first thirty days), and one specific ask.
4. **Decide whether to send it at all.** Tailoring costs most of an hour. The
   skill names which situations make a letter load-bearing and which make it
   optional, because twenty generic letters are worse than none.

It is the companion to [`latex-resume`](../latex-resume/SKILL.md): that skill
handles the document a machine reads first, this one handles the document that
only ever has a human reader, and therefore has to earn its first sentence.

## When to use this

Use it when:

- Applying to a role where the fit is not obvious from the resume alone
- Changing careers, industries, or company size, so the resume reads as a
  mismatch until someone explains it
- Applying through a referral, or to a posting that names a person
- Applying to a small company where a founder or hiring manager reads directly
- Closing a question the resume raises: an employment gap, a layoff, a title
  that undersells or oversells the work
- Deciding whether an "optional" cover letter field is worth the hour

Not for: resume content itself (see `latex-resume`), interview preparation,
salary negotiation, or high-volume applications to near-identical roles, where
the skill's advice is to send no letter rather than a template.

## Quick start

A real posting excerpt, then the letter written from it.

**Job description excerpt, Platform Engineer at a logistics startup:**

> You will own the reliability of our ingestion pipeline, which takes tracking
> events from 30+ carrier APIs with wildly different reliability guarantees. We
> are looking for someone who has carried a pager for a system like this and has
> opinions about idempotency, replay, and dead letter handling. Small team: you
> will write the runbooks as well as the code. Experience with Go and Kafka.

**The letter:**

> Dear Sam Okoye,
>
> Carrier APIs fail in ways that break the usual retry advice: the same tracking
> event arrives twice with different timestamps, and a naive dedupe on event ID
> silently drops the corrected one. I learned that at Globex by dropping about
> 4,000 of them before we caught it.
>
> On ingestion reliability, I owned a pipeline pulling 40k events a minute from
> 12 partner feeds, and moved dedupe out of the consumer into a keyed write with
> a last-write-wins window, which took the weekly replay backlog to zero. On the
> "carry a pager" part, I was primary on-call for it for two years and wrote the
> runbook the rest of the team used at 3am, including the dead letter drain that
> nobody had to page me to run.
>
> I have not used Kafka in production; my pipeline was on Kinesis. The consumer
> group semantics and the offset management are the parts I would need to learn,
> and I have been reading your partition key writeup to see how you handle
> per-carrier ordering.
>
> I would like 20 minutes to talk about how you handle carriers that replay a
> full day of events after an outage, since that is where my last design broke.
> I am free most afternoons.
>
> Pat Lee

Why it works: the opening is a fact about the reader's specific problem domain,
not an announcement. It mirrors "ingestion reliability", "replay", "dead letter"
and "runbooks" in the posting's own words. It names the Kafka gap instead of
hoping nobody checks. It closes with one 20-minute ask. It is 290 words.

## Key concepts

- **The paste test.** If the letter can be sent to another company by changing
  the name, it carries no information. Run the test on the first line alone.
- **Mirroring.** Use the posting's own nouns for the two or three requirements
  that repeat across its sections. Paraphrase makes the reader translate on your
  behalf. Two or three is a cap: a letter answering nine requirements answers
  none with evidence.
- **The opening line is the whole game.** It decides whether the rest is read.
  Open with a fact, put the most specific noun early, never open with "I am
  writing to apply for".
- **Head-on gap handling.** A career change or a gap gets one or two factual
  sentences, no apology, then the letter moves. An unexplained gap is filled in
  by the reader's imagination, which is worse than the truth.
- **Load-bearing versus optional.** Career change, referral, small company, or
  non-obvious fit make the letter load-bearing. A large portal's optional field
  on a role you match cleanly does not. Skip cleanly rather than templating.
- **The tailoring tradeoff.** A good letter costs most of an hour including
  research, so a week buys about twenty. Either tailor few or apply broadly with
  no letter. Tailoring in name only at volume is the worst of both.

## Common pitfalls

**Opening with an announcement.** Bad: "I am writing to apply for the Senior
Backend Engineer position advertised on your careers page." Good: "Your posting
asks for someone who has run a database migration with no downtime; I have run
four, and the third one taught me why the first two were luck." The bad version
spends the one sentence you are guaranteed on what the subject line already says.

**Self-reported qualities in place of evidence.** Bad: "I am passionate about
distributed systems and have a proven track record of delivering results." Good:
"I maintain the retry backoff library your SDK vendors." Adjectives about
yourself are unfalsifiable, so a reader discounts them entirely; the space they
occupy is where the evidence was supposed to go.

**Praise that fits any company.** Bad: "I have long admired your commitment to
innovation." Good: "I switched our reporting jobs to your Parquet export last
spring to stop maintaining a CSV parser that broke on embedded newlines."
Generic praise proves no research was done, which is the opposite of the signal
the letter exists to send.

**Paraphrasing the requirement into your own vocabulary.** Bad: "extensive
experience with high-throughput asynchronous message processing" against a
posting that said "own the reliability of our ingestion pipeline". Good: write
about ingestion and reliability. The match is made by a person scanning for the
words they wrote.

**Apologising for the transition.** Bad: "I know my teaching background is
unusual and I may not be the traditional candidate." Good: "I taught physics for
six years. The transferable part is not communication skills: it is six years of
finding out which explanation survives contact with someone who does not already
believe it." Apology asks the reader to overlook something; a reason asks them
to reconsider it.

**Fading out at the close.** Bad: "Thank you for your time and consideration. I
look forward to hearing from you." Good: "I would like 20 minutes to talk about
how you handle replay ordering during the billing migration." A fade leaves the
next step undefined, so the default next step is nothing.

**Sending a `.docx` named `cover_letter_final_v3`.** Good: a PDF named
`lee-pat-cover-letter-acme.pdf`. Word files reflow on the reader's machine, and
a version-suffixed filename tells them they are receiving a recycled document.

**Leaving the previous company's name in.** There is no good version of this
one. Search the draft for every company name before export; a letter addressed
to the wrong company ends the application on the first line.

## See also

- [`latex-resume`](../latex-resume/SKILL.md) for the document the letter sits
  beside, including the rule that a number you cannot source is a question you
  cannot answer in the interview.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for leading
  with the action rather than the background, which is the same discipline as
  the opening line, and for cutting filler.
- [`truth-first`](../../research/truth-first/SKILL.md) for keeping every claim
  attached to evidence you could actually produce on request.
- [`review-comment-phrasing`](../../writing/review-comment-phrasing/SKILL.md)
  for the general habit of replacing evaluative adjectives with specifics.

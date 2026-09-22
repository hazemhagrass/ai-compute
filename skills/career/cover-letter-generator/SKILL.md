---
name: cover-letter-generator
description: "Use when writing a cover letter for a job application. Say the thing the resume cannot, or send nothing."
---

# Cover Letter Generator

A resume lists what you did. A cover letter has one job the resume cannot do:
explain why this role, at this company, and what you would do inside it. If a
draft does not do that, it is a decorated restatement of the attachment beside
it, and the honest move is to send no letter at all.

## Say something the resume cannot

Everything already on the resume is already on the resume. Repeating it in
paragraph form spends a reader's attention to deliver information they hold in
the other hand. The letter's territory is the reasoning the bullets have no room
for: why you are pointed at this problem, what you would touch first, why a
strange line on the resume is not strange.

Bad:

> I have five years of backend experience at Acme and Globex, where I worked on
> payments infrastructure and led a team of four engineers. I am confident my
> skills make me a strong fit for this position.

Good:

> I spent two years making a payments ledger idempotent after we double-charged
> 1,900 customers in one afternoon. Your engineering post about moving billing
> off the monolith describes the state we were in before that work, down to the
> retry storm on webhook delivery. That is the part of the job I want.

The second version is not on the resume and could not be. It also tells the
reader what the first thirty days would look like without promising anything.

## Research until the first line cannot be pasted elsewhere

Run one test on every draft: could this letter be sent to a different company by
changing the name? If yes, it carries no information. The fix is specific, cheap
research, twenty minutes at most:

- The job description itself, read twice, for the requirements repeated in more
  than one section.
- The company's engineering blog, changelog, docs, or status page.
- The product, actually used, on the free tier if there is one.
- The team's public work: talks, open source repos, release notes.
- The person who wrote the posting, if the posting names them.

Then name one concrete thing. Not "your innovative culture", which is available
about every company; something only a reader inside that company would recognise.

Bad:

> I have long admired your company's commitment to innovation and your strong
> reputation in the industry.

Good:

> I switched our reporting jobs to your Parquet export last spring, mostly to
> stop maintaining a CSV parser that broke on embedded newlines. The migration
> guide told me to expect column-order drift and it happened exactly where the
> guide said it would, which is rarer than it should be.

## Treat the opening line as the whole game

The opening line decides whether the rest gets read. Spending it on a
throat-clearing announcement of what the reader can see from the subject line
wastes the only sentence you are guaranteed.

Bad:

> I am writing to apply for the Senior Backend Engineer position that I saw
> advertised on your careers page.

Good:

> Your posting asks for someone who has run a database migration with no
> downtime; I have run four, and the third one taught me why the first two were
> luck.

Bad:

> Dear Hiring Manager, I am a passionate software engineer with a proven track
> record of delivering results in fast-paced environments.

Good:

> I maintain the open source library your SDK vendors for retry backoff, which
> is a strange way to introduce myself, so here is the relevant part: I have
> spent three years on the failure modes your integrations team files bugs about.

Bad:

> As a recent graduate with a degree in Computer Science, I am eager to begin my
> career at an organisation like yours.

Good:

> I built the scheduling tool my university's chemistry department still uses to
> assign 400 lab slots a term, because the spreadsheet it replaced lost an
> entire section's bookings the week before finals.

Three rules hold across all of these: open with a fact, not a feeling; put the
most specific noun in the sentence early; never open with "I am writing to".

## Mirror the description's own language for the two or three things that matter

Job descriptions are written by someone who had to decide what mattered. The
requirements that repeat across the summary, the responsibilities, and the
qualifications are the real ones. Take those two or three, use the posting's own
nouns, and attach evidence to each.

If the posting says "own the reliability of our ingestion pipeline", write about
reliability and ingestion, not "distributed systems robustness". The match is
being made by a person scanning for the words they wrote, and paraphrase makes
them do translation work on your behalf.

Bad, paraphrased into a different vocabulary:

> I have extensive experience with high-throughput asynchronous message
> processing and fault-tolerant architectures.

Good, mirroring and evidenced:

> On ingestion reliability: I owned a pipeline taking 40k events a minute from
> 12 partner feeds, and cut the weekly replay backlog to zero by moving dedupe
> from the consumer into a keyed write. On the on-call side of "own", I wrote
> the runbook the rest of the team used at 3am.

Two or three is the cap. A letter answering nine requirements answers none of
them with evidence, and turns back into a resume.

## Address the gap or the transition head-on

A career change, an eighteen month gap, a title that does not match, a move from
a much larger company to a much smaller one: the reader will notice. A letter
that ignores it leaves them to invent an explanation, and invented explanations
are worse than yours. One or two sentences, factual, no apology, then move.

Bad, hoping nobody notices:

> I am excited to bring my diverse background to this role.

Bad, apologising:

> I know my background in teaching is unusual and I may not be the traditional
> candidate you are looking for, but I hope you will consider me.

Good, named and closed:

> I taught high school physics for six years before moving into data work. The
> transferable part is not "communication skills": it is that I spent six years
> finding out which explanation of a concept survives contact with someone who
> does not already believe it, which is most of what an analytics partner does.

Good, on a gap:

> I was out of work from March 2023 to September 2024 caring for a parent after
> a stroke. I kept current by rebuilding my own monitoring stack on Prometheus
> and shipping two small patches to the exporter I depend on.

State it, give the one true sentence that makes it make sense, and stop. Do not
spend a paragraph on it.

## Hold the length: one page, roughly 250 to 400 words

Four short paragraphs is the working shape:

1. The opening: the specific fact that earns the next paragraph.
2. The match: the two or three mirrored requirements with evidence attached.
3. The letter's own content: the gap, the transition, or what you would do first.
4. The close: one clear ask.

Anything beyond one page is being skimmed, so you are choosing which parts get
read at random. If it will not fit, the usual cause is a paragraph restating the
resume; delete that one first.

A complete letter at that length, for a data engineering role at a company whose
posting asked for dbt experience and warehouse cost work:

> Dear Ana Reyes,
>
> Your posting asks for someone who can cut warehouse spend without breaking the
> models on top of it. I did that at Globex last year: I found that 60 percent of
> our Snowflake credits went to eleven dbt models rebuilding full tables every
> hour, converted them to incremental with a late-arriving-data window, and moved
> the monthly bill from 18k to 7k with no change to downstream dashboards.
>
> On dbt specifically, I own a 340-model project, including the tests and the
> exposure graph the analysts use to check what breaks before they merge. On the
> cost side of the role, the work that actually held was making spend visible per
> model in a dashboard the analytics team looks at, rather than me policing it.
>
> I have never worked with Databricks, which your stack page lists beside
> Snowflake. I read your migration writeup and the parts I would have to learn
> are the cluster sizing and the Unity Catalog permissions model, not the SQL.
>
> I would like 20 minutes to hear how far the Databricks migration has gone and
> what it has done to the dbt project. I am free most afternoons.
>
> Pat Lee

## Make the close an ask, not a fade

End with a specific, low-friction request. Avoid both the passive fade and the
presumptuous hard close.

Bad, passive:

> Thank you for your time and consideration. I look forward to hearing from you.

Bad, presumptuous:

> I will follow up on Tuesday to schedule a time for us to speak.

Good:

> I would like 20 minutes to talk about how you are handling replay ordering
> during the billing migration, and where that work is going next. I am
> available most afternoons and can work around your timezone.

## Delete the words that make it worse

Certain phrases actively cost you, because they appear in the letters the reader
has already discarded, and they occupy the space where evidence goes.

| Delete | Why it hurts | Replace with |
| --- | --- | --- |
| "I am writing to apply for" | Spends the opening line on what the subject line says | The specific fact |
| "passionate about" | Unfalsifiable and self-reported | A thing you did unpaid or unasked |
| "proven track record" | Claims proof while providing none | The actual result |
| "results-driven", "dynamic", "synergy" | Filler from template letters | Nothing, cut the sentence |
| "I believe I would be a great fit" | Asks them to take your word | The requirement plus your evidence |
| "fast-paced environment" | The posting's cliche echoed back | The specific pace fact |
| "To Whom It May Concern" | Signals no research was done | A name, or "Dear Hiring Team" |

## Decide whether to send one at all

Tailoring is expensive and it does not scale. A good letter costs most of an
hour including research. Twenty of them is most of a week, and twenty generic
ones are worse than none, because a generic letter is evidence you send generic
letters. The honest tradeoff: tailor few, or apply broadly with no letter, but do
not tailor-in-name-only at volume.

| Situation | Letter |
| --- | --- |
| Career change or non-obvious fit | Load-bearing, the resume cannot explain it |
| Referral, or a named person you can address | Load-bearing, it is a real conversation |
| Small company, founder reads applications | Load-bearing, often read before the resume |
| Gap, layoff, or a title that misleads | Load-bearing, close the question yourself |
| Large-portal application, "optional" field | Optional, spend the time on the resume |
| Recruiter reached out to you first | Optional, reply in the email thread instead |
| High-volume application to many similar roles | Skip, and do not fake it |

When you skip it, skip it cleanly. An empty optional field costs less than a
template.

## Format and file conventions

- Plain business letter: your name and contact block, the date, a salutation,
  four paragraphs, a sign-off. No letterhead graphics, no photo, no columns.
- Same font and margins as your resume, so the two read as one package.
- Address a person by name when the posting or the company site gives one, spelled
  correctly. Otherwise "Dear Hiring Team". Never "To Whom It May Concern".
- Send PDF, not `.docx`, so line breaking cannot move under the reader.
- Name the file so it survives a download folder: `lastname-firstname-cover-letter-company.pdf`,
  for example `lee-pat-cover-letter-acme.pdf`. Never `cover_letter_final_v3.pdf`.
- If the application is an email, the letter body goes in the email body as well
  as attached; readers should not need to open a file to see the first line.
- Check the company name appears zero times wrong. A letter addressed to the
  previous company you applied to ends the application.

## Quick checklist

- The letter says something the resume does not, and would be damaged by cutting
  the first sentence.
- The opening line is a fact, is specific to this company, and does not begin
  with "I am writing".
- Two or three requirements are mirrored in the posting's own nouns, each with
  evidence attached.
- Any gap, transition, or odd title is named in one or two sentences without
  apology.
- Between 250 and 400 words, one page, four paragraphs.
- The close contains a specific ask.
- No "passionate", no "proven track record", no "To Whom It May Concern".
- Exported to PDF, named `lastname-firstname-cover-letter-company.pdf`, with the
  company name spelled correctly everywhere it appears.

## See also

- [`latex-resume`](../latex-resume/SKILL.md) for the document this letter sits
  beside, and for the rule that unsourced numbers are questions you cannot
  answer in the interview.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for leading
  with the action instead of the background, which is the same rule as the
  opening line.
- [`truth-first`](../../research/truth-first/SKILL.md) for keeping claims
  attached to evidence you could actually produce.

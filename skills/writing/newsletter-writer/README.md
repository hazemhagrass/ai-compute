# Newsletter Writing

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for writing email newsletter issues that keep the promise the
subscriber accepted: one purpose per issue, an honest pitch at the top, a
body people finish, and a list that stays healthy.

## What it does

This skill applies twelve rules to any newsletter issue you draft, edit, or
review. Each rule targets a specific failure that makes subscribers ignore or
unsubscribe from an otherwise well-written send.

| Rule | Prevents |
| --- | --- |
| One message, one purpose | Issues that deliver neither of their two goals |
| The subject line is the whole pitch | Clickbait opens that earn unsubscribes |
| Preview text finishes the subject line's pitch | The pitch wasted on "View in browser" |
| The single idea sits in the first screen | Readers skimming to their stopping point |
| Links are curated, each with a reason to click | Link dumps that train readers not to engage |
| Original writing appears in every issue | Silent curation that competes with RSS and loses |
| Voice stays consistent across issues | Drift that reads as a change of author |
| Segment the list by declared intent | Blasting one message to every interest at once |
| Choose a cadence you can sustain | A public rhythm the issues stop honoring |
| Choose plain text or HTML deliberately | A template that breaks with images off |
| Make unsubscribing one visible click | Readers reporting junk instead of leaving |
| Measure replies and clicks, not opens | Optimizing subject lines against a tracking artifact |

The skill is prescriptive: every rule in `SKILL.md` carries a bad/good pair so
you can pattern-match your own draft instead of reasoning from principle.

## When to use this

Use it when you are:

- Drafting a newsletter issue, whether essay-lead, curated links, or a mix of
  the two.
- Choosing a subject line, preview text, and closing prompt for a send.
- Deciding format (plain text or HTML), send cadence, or segmentation for a
  list you own.
- Reviewing an existing newsletter and wanting concrete, non-subjective
  feedback beyond "it reads fine".
- Setting up list hygiene: sunset rules, bounce handling, suppression.

Do not use it for: transactional email (receipts, password resets; those are
compliance surfaces, not editorial ones), social media threads, or product
announcement blasts whose whole purpose is a single call to action and where
the House style genuinely serves. The writing itself within those sends can
still borrow the subject-line rules.

## Quick start

You have been asked to send this month's issue. The draft says: "Company
update, a few links, a coupon." Here is the same content after applying the
skill's questions, in order.

### The questions the skill makes you answer first

1. What one thing should the reader know or do when the email closes? Write
   it in one sentence. Everything else is subordinate or cut.
2. What does the subject line promise? Is it specific, honest, and short
   enough that the promise survives truncation?
3. What does the preview text add? (It is free pitch space; the default
   scrape is "View in browser".)
4. Which links survived the one-line-justification test?

### Before

```text
Subject: Amazing things this month!
Preview: (scraped) View this email in your browser...
Body: greeting, five sections, nine links, coupon, survey, legal footer.
```

### After

```text
Subject: Why Postgres rejects your index: B-tree size limits, in 5 minutes
Preview: The 4 GB ceiling is real, and the fix is one SQL statement.
Body:
  The index limit, and the fix (the single idea, first screen)
  Three links, each with one line on why it earned the slot
  One question: what did the limit cost you? (reply prompt)
Footer: visible one-click unsubscribe; List-Unsubscribe header set
```

The coupon and the survey did not disappear; they moved to the appropriate
segment and to next month's issue respectively, where each is the single
purpose of its own send.

### The core loop

Write the purpose sentence, then the subject line, then the preview text,
then the first screen, then curate links, then close with the recurring
prompt. Verify the issue against the checklist at the bottom of `SKILL.md`:
twelve items, one per rule, and each checkable in under a minute.

## Key concepts

**The issue is a contract, and the subject line is its text.** A subscriber
accepts a promise when they subscribe and re-accepts it on every send. A
subject line that oversells pays with a mute; one that undersells pays with
an ignored send. The honest, specific, short pitch is the only one whose
both outcomes are acceptable.

**Curation is a filter, not a funnel.** A link earns its slot with one line
saying what it is and why the reader should care. If you cannot write that
line, the link gets cut, because a link nobody justifies trains readers that
the list is background noise.

**Original writing is the moat.** Curation-only issues compete against RSS
readers, which are faster and quieter. The share of original thinking (the
stance, the verdict, the synthesis) needs to stay above zero in every issue,
including the curated ones.

**The reader subscribed to a voice.** The same greeting, the same
contractions, the same running references, issue after issue: the voice is
the product. Drift toward "professional" reads as a different person taking
over the account.

**Deliverability is behavioral.** Rate limits, visible unsubscribes, and
clean bounces matter more to inbox placement than any template can; the
mailbox provider's own signals (complaint rate, engagement, the
List-Unsubscribe headers) are what gate the send. See the Relevant specs
list.

**Opens are a tracking statistic, not a reading statistic.** Pixel loading
differs across clients and user settings, so open rates shift when
platforms change, with no change in your writing. Replies and clicks
require intent and are the numbers worth moving.

## Common pitfalls

### Baiting the open

Bad:

> Subject: You won't believe what changed this month (hint: everything)

Good:

> Subject: The one query that changed our latency budget

Reason: bait earns the open and the mistrust. The reader who opened on a
lie checks the bottom of the email for the unsubscribe first and forwards
never.

### Burying the point below the fold

Bad:

> Screen 1: logo, "hello everyone, hope your week went well", housekeeping
> Body point 3: the actual finding

Good:

> Screens 1 and 2: the finding, with the reader's problem as the example.
> Everything else: links, sign-off.

Reason: the first screen decides whether the second screen is read. A
greeting that earns its place earns it by being shorter than the point it
precedes.

### Two purposes in a single send

Bad:

> A product announcement, a survey, and a deep dive, all co-equal sections.

Good:

> One purpose. Any genuinely urgent second item gets one labeled line at
> the top, and the rest moves to its own send, segmented to the readers who
> asked for it.

Reason: the reader skims to their stopping point, and the second purpose is
skipped. A second send costs two minutes and delivers each message whole.

### Dumping instead of curating

Bad:

> Twenty links pasted in a heap, two of which are actually worth the time.

Good:

> Three links, each with one line on what it is and why you kept it, and
> one link deliberately cut with a note on why (this shows your filter).

Reason: the reader's trust is spent on your judgment, not your reach.
Showing the cut is sometimes the most credible line in the issue.

### Announcing a rhythm you then miss

Bad:

> "New issue every Tuesday" on the signup page, then a five-week silence.

Good:

> No public cadence until three issues are banked, then a stated rhythm
> with a back-issue buffer, and a missed-issue apology line when real life
> wins.

Reason: a stated cadence is a contract. Missing it silently reads as
abandonment, and each miss compounds it.

### Treating formatting as design freedom

Bad:

> A three-column HTML template with a hero image, aimed at a 62-subscriber
> list, which renders invisibly with images off.

Good:

> Plain text, or a single-column HTML template that is legible with images
> off and in dark mode, chosen for the actual list size.

Reason: many clients block images by default. An issue that depends on
hosted images for structure is an issue that does not exist for those
readers, and the number of them is usually higher than assumed.

### Hiding the unsubscribe

Bad:

> A 6px footer line the same color as the background, routing through a
> preference center, a login, and a confirmation email.

Good:

> A visible one-click unsubscribe, plus the platform's List-Unsubscribe
> headers so the client itself offers the button natively.

Reason: a reader who wants out but meets friction does not stay; they
report junk instead, and the complaint costs you every future send.
Compliance does not require the friction; most jurisdictions are satisfied
by one visible link.

### Optimizing the open rate

Bad:

> "Open rate up 4%, so this subject formula works, ship it every week."

Good:

> "Three replies and 22 link clicks on a list of 180: this issue hit. The
> open rate moved the same week Apple Mail changed its pixel policy, so
> that number is noise."

Reason: opens depend on a tracking pixel that different clients load under
different rules. Replies, clicks, and unsubscribes are actions taken by
intact humans and are the numbers that describe a real audience.

### Ignoring replies, or automating them away

Bad:

> Replies go to a no-reply address with "do not respond to this email".

Good:

> Every reply gets a human answer within a day or two, and the best reply
> of last month gets quoted (with permission) as the opening of the next
> issue.

Reason: replies are the cheapest, highest-signal reader research channel
that exists, and no-reply addresses throw them away. Automating the answer
removes the reason the reader bothered.

## See also

- `SKILL.md` in this directory: the twelve rules, each with a bad/good pair
  and the reason, plus the one-page draft checklist.
- [RFC 2369](https://www.rfc-editor.org/rfc/rfc2369): the List-Unsubscribe
  header, which clients use for the native unsubscribe affordance.
- [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058): the one-click
  unsubscribe behavior built on top of it.
- [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322): the base format for
  headers and the Message-ID in raw reply threading.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): the accessibility thresholds
  the HTML issue can be tested against.
- [caniuse: selector support in mail clients](https://caniuse.com/mdn-css_selectors_lists):
  which CSS selectors email clients honor; email CSS is a tiny, weird
  subset of the web platform.

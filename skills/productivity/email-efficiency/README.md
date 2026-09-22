# Email Efficiency

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="email-efficiency robot" width="200">
</div>

A skill for taking back an inbox that other people are writing to-do lists into: triage systems, replies that close the loop, send-time discipline, and follow-ups that fire without remembered promises.

## What it does

The skill repairs the four failures that make email expensive:

- **Continuous checking.** Triage replaces read-and-react with two passes in
  batched windows.
- **Threads that respawn.** Replies answer the question and its obvious
  successor, so the thread ends.
- **Follow-ups that live in memory.** Every promise gets a timestamped system
  entry the minute it is made.
- **Illegible silence.** Reply-time expectations are stated in the signature
  and then held.

It also covers the support cast: reply-all discipline, the 2-minute rule and
its failure modes, scheduled send, unsubscribe and mute as first-line tools,
folders versus search, templates that do not read as templates, declining
cleanly, and keeping salary and sensitive topics off email entirely.

## When to use this

- The inbox is past one page and you cannot tell what is actually waiting on
  you.
- You are writing the same reply-shaped email a third time this week.
- You have promises ("I will send it by Friday") that you track by feeling.
- You are about to send at 23:00, or to accept a meeting thread you do not
  want.
- Someone is negotiating money, performance, or a legal matter over email
  and it should move to a call.

Skip it for a single one-off message, or when the real problem is that the
work is unclear rather than that the mail is unmanaged.

## Quick start

Take the reply you were about to send and make it close the thread.

A reply that guarantees another round trip:

```text
Subject: Re: Q3 vendor migration

Sounds good, let me look into it and get back to you.
```

The reader now has three open questions: whether you agreed, what you are
looking into, and when anything arrives. They will write again to find out.

The same reply, closing the loop:

```text
Subject: Re: Q3 vendor migration

Yes, go ahead with the Acme contract.

Two things I own: I will send the signed SOW by Thursday, and I have asked
Priya to confirm the data-retention clause (she is copied).

If you do not have the SOW by Thursday midday, ping me and I will chase it.
```

Three changes did the work:

1. **The answer comes first.** "Yes, go ahead" is the decision, in the first
   line, where a phone reader sees it.
2. **Every action has an owner and a date.** Nothing is "being looked into"
   by nobody in particular.
3. **The failure path is stated.** The reader knows what to do if you go
   silent, so your silence stops being a blocker.

Then, before you close the tab, put "send signed SOW" in your calendar for
Thursday morning. The promise now lives in a system rather than in your
memory of having made it.

## Key concepts

- **Triage is not reading.** The first pass sorts into Delete, Delegate,
  Defer, and Respond without composing anything. Mixing sorting and writing
  is what turns twenty minutes of email into two hours.
- **Inbox zero is a state, not a ritual.** It means every message has been
  routed somewhere, not that you have answered everything today.
- **The 2-minute rule has failure modes.** It quietly expands to cover
  10-minute replies, it fires during triage and destroys the sort, it
  prioritises trivial mail over important mail, and it makes you the fastest
  responder on threads you should have left alone.
- **Search beats folders.** Deep folder trees cost filing time on every
  message to save search time on a few. Keep a flat archive and learn the
  search operators instead.
- **Unsubscribe before filtering.** A filter still downloads, stores, and
  syncs mail you never wanted; unsubscribing stops it at the source.
- **Scheduled send is a courtesy, not a trick.** Sending at 20:00 sets an
  expectation that you are available at 20:00, and the reply lands in your
  evening too.
- **Some topics do not belong in email.** Salary, performance, and legal
  exposure are worse in writing: no tone, infinite forwarding, permanent
  record. Move them to a call and send a short summary afterwards.

## Common pitfalls

**Bad:** "Thanks, I'll take a look and circle back."
**Good:** "Yes to option B. I will send the revised numbers by Wednesday."
**Reason:** the first reply has no decision, no owner, and no date, so the
thread has to continue before anything can happen.

**Bad:** replying-all to a 40-person announcement to say "thanks".
**Good:** replying to the sender alone, or not at all.
**Reason:** the cost is 40 interruptions to deliver a sentiment that one
person needed. Reply-all is correct when the group must see the answer, which
is a real case worth distinguishing.

**Bad:** triaging and composing at the same time, so a two-minute reply
derails the sort halfway down the inbox.
**Good:** sorting the whole inbox first, then writing the replies in a block.
**Reason:** switching between sorting and writing pays the context-switch cost
on every message instead of once.

**Bad:** building an elaborate filter to route a newsletter you never read
into a folder you never open.
**Good:** clicking unsubscribe, then deleting the folder.
**Reason:** a filter hides the symptom and keeps paying the storage, sync, and
notification cost forever.

**Bad:** "I'll remember to follow up on the vendor quote."
**Good:** a calendar entry for the follow-up, created while writing the
promise.
**Reason:** memory is not a tracking system, and the promises that get dropped
are the ones nobody wrote down.

**Bad:** a template so complete that it reads as a form letter.
**Good:** a template that carries the boilerplate and structure, with a fresh
first sentence written for the actual recipient.
**Reason:** recipients detect templates through the generic opener, not
through the reused middle, so that is the part worth writing by hand.

**Bad:** declining with "I'm too busy right now."
**Good:** "I can't take this on before the migration ships. If it can wait
until the week of the 14th I can, or Sam knows this system well."
**Reason:** a bare no invites negotiation; a no with a real constraint and a
redirect ends the exchange helpfully.

**Bad:** negotiating a raise over email because it feels safer.
**Good:** asking for fifteen minutes, then sending a short written summary.
**Reason:** email strips tone from exactly the conversations where tone
carries the meaning, and forwards the result to people you did not choose.

## See also

- [`technical-writing`](../../writing/technical-writing/SKILL.md) for shaping
  the documents you send as links instead of pasting into the body.
- [`meeting-facilitation`](../../workflow/planning/SKILL.md) for the threads
  that should have been a meeting, and the meetings that should have been
  email.
- [`planning`](../../workflow/planning/SKILL.md) for the calendar systems
  behind the weekly follow-up sweep.
- [`review-comment-phrasing`](../../writing/review-comment-phrasing/SKILL.md)
  for wording a disagreement so it does not escalate in writing.

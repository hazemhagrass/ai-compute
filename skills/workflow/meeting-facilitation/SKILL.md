---
name: meeting-facilitation
description: "Use when running a meeting. Design the agenda, hold time, drive to a decision, capture actions with owners and dates."
---

# Meeting facilitation

A meeting is a purchase decision: the price is the time of everyone in the
room. The facilitator's job is to make sure the buyer gets what they paid
for. This is craft, not summary.

## Design the agenda around a decision

Every agenda item names one of three outcomes:

- **Decide.** A choice is made in the room, by named people.
- **Align.** Everyone leaves with the same understanding of a shared state.
- **Explore.** A problem is examined without deciding.

An item that is none of these is a status report. Kill it, or turn it into
one of the three. Bad: "Q3 planning review." Good: "Decide: which two of
these five initiatives move into Q3."

Time-box every item at design time, not at run time. If a decide item runs
long, you were wrong at the design stage; document it as a lesson, do not
extend the meeting into the next one.

## Publish the agenda 24 hours before, in writing

- Every item has its type (decide / align / explore) and its time budget.
- Every decide item names the decider. A room without an owner cannot
  decide.
- Every explore item names the trigger question. "Explore: how are we
  going to handle the surge?" not "Explore: capacity."

If the pre-read is a deck, put the recommendation on slide 2. Nobody will
read to slide 40.

## The first two minutes set the whole meeting

Open with the decision the meeting exists to make, out loud. Not the topic.
Not the agenda. The decision. This is the calibration signal for whether
the meeting is worth continuing.

If the decider says "we don't actually need to decide today", cancel the
rest and reschedule. That is the correct action, not a personal failure.

## Hold time

- Announce the transition when 80% of the item's budget is spent, out
  loud: "5 minutes left on this item."
- If the item cannot land in the remaining time, ask once: "Do we push
  the deadline, drop the item, or make a smaller decision now?"
- Never silently overrun. The next item's owner is not obligated to
  absorb your overrun.

The airplane rule: if a person on the ground would notice the meeting is
late, so does everyone in it.

## Drive to a decision, not to consensus

Consensus is expensive and often unnecessary. Named decision-making
frameworks make the mode explicit:

- **RAPID**: Recommend, Agree, Perform, Input, Decide. Names one Decide
  per decision. Ambiguity here is the number-one cause of the meeting
  after the meeting.
- **DACI**: Driver, Approver, Contributor, Informed. Same idea, cleaner
  for cross-team work.

State the mode at the top of the decide item: "This is a Recommend from
Engineering, Decide with the PM. Contributors: Design, Data."

If a decision is genuinely stuck, name what would unstick it (one more
number, one more conversation) and set a deadline. Do not schedule another
meeting to have the same conversation.

## Capture actions with owners and dates

An action without an owner is a wish. An action without a date is an
option. The template that survives is:

```
- [owner] Action, by <date>. Decision this executes: <link>.
```

Actions go in a system of record (issue tracker, doc, wiki), not the
chat. Chat is a scratchpad. Read every action aloud at the end so the
owners hear their name; that beats reading in a doc later.

## The three roles nobody assigns and everyone needs

- **Facilitator.** Drives time, transitions, and mode.
- **Scribe.** Captures decisions and actions in real time, not from
  memory afterward.
- **Timekeeper.** Called out because facilitators drift.

For a small meeting the facilitator holds all three. For a stakeholder
meeting split them, at least the scribe.

## Silence is data

Long silences after a proposal are usually disagreement, not agreement.
Name it: "I'm going to take that silence as reservation. What's the
concern?" If nobody speaks after a second prompt, the room is telling you
the decider is the only vote that matters. Act accordingly.

## When to end the meeting early

- The decision was made in the first item.
- New information arrived that invalidates the agenda.
- The decider is not in the room.

Ending a 60-minute meeting at minute 20 is a facilitation win, not a
failure. It buys back 40 minutes for everyone.

## Recurring meetings die of scope creep

A weekly sync becomes a status report becomes a place to hide. Every
recurring meeting has a review date on the calendar invite. On that date,
either justify it against the last six weeks of actions, or kill it.

The default answer is kill it. Recurring meetings should re-earn their
slot.

## Common pitfalls

Bad: an agenda item titled "Q3 planning".

Good: an agenda item titled "Decide: which two of these five initiatives
move into Q3 (owner: PM, 15 min)."

Bad: closing the meeting with "great discussion, let's follow up."

Good: closing the meeting by reading the decisions and actions with
owners and dates out loud.

Bad: extending the meeting because the decide item ran long.

Good: asking "push the deadline, drop the item, or make a smaller
decision now" and honouring the answer.

Bad: scheduling the same weekly meeting for a year without review.

Good: putting a review date on the invite; killing meetings that cannot
justify themselves.

Bad: writing actions in the chat during the meeting.

Good: writing them into the tracker with owner and date, and reading
them aloud at the end.

## When not to use this

- One-on-ones. Different craft, different rules.
- Interviews. The frame is candidate-driven, not decision-driven.
- Working sessions where the whole point is exploration and the outcome
  is discovery, not a decision.

## See also

- `../planning/SKILL.md` for turning meeting decisions into a real plan
  with phases and tickets.
- `../../writing/technical-writing/SKILL.md` for writing the agenda and
  decision doc that anchors the meeting.
- `../../productivity/email-efficiency/SKILL.md` for the inbox habit that
  reduces the need for status meetings.

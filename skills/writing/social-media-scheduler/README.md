# Social Media Scheduler

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="social-media-scheduler robot" width="200">
</div>

A skill for planning social posts that respect the platform they land on, the audience they ask for, and the person replying in the comment thread.

## What it does

This skill governs the week when you turn raw ideas into scheduled posts. It
covers eight rules, each guarding against a specific failure of scheduling
tools: the copy-pasted cross-post, the queue so deep its content has expired,
the feed that is all promotion, the bait hook, the photocopy repurposing, the
posted-and-vanished account, the invented statistic, and the fake engagement.

| Rule | Prevents |
| --- | --- |
| Platform-native beats cross-posting | One paste landing wrong on four networks |
| Rolling week, not a year | Scheduled posts surviving past their own context |
| Content ratio: mostly theirs, some yours | A promotional feed followers quietly leave |
| Hooks differ by platform type | A first line doing visual-platform work, or vice versa |
| Repurpose honestly: fragments, not photocopies | "Thirdly" opening a standalone post |
| The reply window is part of the post | Posting into silence and calling it distribution |
| Measure timing, do not recite | Invented "40% more engagement" folklore |
| Automation ethics | Bots posing as people and manufactured social proof |

The skill is prescriptive: every rule carries a bad/good pair you can
pattern-match a draft against, in the same style as the other writing
skills in this repo.

## When to use this

Use it when you are:

- Filling a scheduling calendar or an editorial queue for one or more accounts.
- Turning a long piece (a talk, a release, a guide) into platform-shaped posts.
- Reviewing a queue before it goes out, to catch recycled or expired content.
- Deciding what to automate about posting and where automation must stop.
- Coaching someone whose feed is all promotion, or whose posts never get replies.

Do not use it to pick which platforms to be on, to design the visual identity
of an account, or to write ad copy for paid campaigns: those are different
disciplines with different feedback loops. And do not use it as a source of
timing statistics; the skill deliberately contains none.

## Quick start

You have one announcement to make and slots on three platforms. Here is the
same announcement as a cross-post and as native drafts.

### Before (cross-posted)

```text
[Same text, pasted to all three networks]
We just shipped v2 of our CLI! It has 3 new commands: ingest, diff, and
watch. Check out the blog post for details: https://example.com/blog/v2
```

On the short-video platform this text scrolls past unread; on the thread
platform there is no thread, so the link hangs alone. Same paste, three
failures.

### After (native drafts)

```text
Thread platform (4 posts):
1/ We rebuilt our CLI's ingest command. The old one read the whole file
   into memory: fine at 10 MB, fatal at 10 GB. v2 streams. TXs, 3!
2/ The new `diff` command shows what would change before you run it.
   It is the command I wish we had shipped first.
3/ `watch` re-runs a transform on file change, so you edit and see the
   output live. This one is just fun. [5-second video attached]
4/ Full write-up (incl. benchmarks, why we rewrote rather than patched):
   https://example.com/blog/v2

Visual platform (30s clip, no link):
Frame 1 hook (on-screen text): "Our CLI used to crash on 10 GB files."
Then: 4s screen capture of `watch` re-rendering on an edit. Voice-over:
the one-line story of the fix. Finish on the takeaway card with the
product name. Link in bio, never mid-video.

Link-preview platform:
Title: "Streaming ingest in CLI v2"
Description: The old command read the whole file into memory. Here is
what streaming changed, with numbers. Image: card-sized diagram of the
before/after pipeline.
```

One message, three shapes, each fitted to its platform's contract. The
underlying facts are identical throughout; only the shape changes.

## Key concepts

- **Platform-native.** Each network is a community with its own reading
  contract. Fluency is per-platform, so a draft is per-platform. The budget
  answer to "more platforms" is fewer platforms, not more paste.

- **Rolling queue.** The backlog holds ideas at any fidelity; the queue holds
  drafts with times and dates no more than a week out. One open slot is not
  unused capacity: it is the only part of the calendar that can absorb a
  timely post.

- **Ratio.** Value-sharing is the standing invitation; self-promotion is the
  tolerated exception. If the last five posts were all asks, the feed has
  become advertising and followers respond the way people respond to ads.

- **Hook/body contract.** A hook is a promise the body is required to keep.
  Text platforms read the promise in the first line; visual platforms write
  it on the first frame. Break the contract once and the audience prices it
  into every future post.

- **Honest fragments.** Repurposing is reassembling, not shrinking: pull out
  claims that stand alone, cut references to the parent document, attribute
  the source inside the fragment. If a point needs its context, leave it in
  the context.

- **Reply window.** The first hour after posting is the highest-leverage
  surface the post creates: the comment thread everyone else will read. Staff
  it in the same voice as the post, or move the slot to an hour you can staff.

- **Measured beats recited.** Every published "best time" number describes a
  different audience. The transferable claim is the method: try plausible
  slots, log slot and outcome together, compare on your own data, re-run the
  test when the platform changes.

- **Automation boundary.** Tools may move a post in time. Tools may not
  manufacture engagement or hold conversations while pretending to be people.
  The author decides, writes, and reads the replies; the scheduler only
  delivers.

## Common pitfalls

- **Posting the same text everywhere.** The cross-post is detectable by design:
  every surface has different norms, and a paste carries its origin's norms
  into a room that does not share them. Audiences do not think "economical",
  they think "this person is not really here".

- **A queue deeper than the horizon.** Scheduling three months of posts means
  committing to positions before the facts, and scheduled cheerfulness landing
  mid-crisis is the classic result. One week, review weekly.

- **Filling the queue to 100%.** There is no room left for the post the week
  itself produces, so the timely one is skipped or the slate is shuffled badly.

- **All promotion.** A feed of product announcements asks for attention
  without offering any. The gift economy of a feed: give more than you take,
  in posts, not intentions.

- **The bait hook.** "You won't believe #3" and then the body does not deliver,
  or the hook reaches for something the supporting post cannot back. The first
  break buys one click; the audience buys none afterwards.

- **The naked screenshot.** Cropping a paragraph from a blog post and posting
  it is repurposing without the platform-shaping: text sized for a page, not
  a feed. Rewrite into the platform's register, attribute, and only then post.

- **"As I said in part one".** A fragment that requires the reader to have read
  something else is not a fragment: it is the parent piece pretending.

- **Posting and vanishing.** The reply thread is part of the post's audience,
  not a private conversation with whoever returns later. An unanswered thread
  teaches the audience replies are invisible.

- **Reciting engagement folklore.** "Best time to post" charts with precise
  percentages. No invented numbers anywhere in the plan: the claim is about
  method (test and measure on your own audience), not about other people's
  aggregates.

- **Automating a persona.** Reply bots, auto-thanks under every comment,
  unlabeled bot accounts, or bought followers. Platforms and audience members
  both detect it, and the detection is the penalty you cannot undo.

## See also

- [`research/truth-first`](../../research/truth-first/) for the standard this
  skill applies to timing claims: no number without a source, and method claims
  proved by your own logs.
- [`writing/technical-writing`](../technical-writing/) for writing the
  long-form piece that fragments come from, in task-first, failure-aware form.
- [`writing/review-comment-phrasing`](../review-comment-phrasing/) shares the
  pattern: prescriptive, bad/good pairs, and real comment text, because the
  wording is the entire substance.
- [`engineering/code-review`](../../engineering/code-review/) for applying a
  prescriptive rule set over a piece of work you did not write, which is the
  same posture a scheduled queue review asks for.
- [`workflow/grill-me`](../../workflow/grill-me/) for stress-testing a content
  strategy before the calendar is built around it.
- [`research/truth-first`](../../research/truth-first/) which this skill leans
  on heavily; the ratio, hook, and timing rules all assume grounded claims.

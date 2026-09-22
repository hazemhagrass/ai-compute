---
name: youtube-seo-optimizer
description: "Use when publishing on YouTube. Write titles and descriptions that serve viewers, and read CTR with retention."
---

# YouTube SEO Optimizer

A video's discoverability is decided by the pair of title and thumbnail, by the
first lines of the description, and by how the video performs once clicked.
This skill covers packaging those elements honestly and reading analytics
without fooling yourself.

## Core stance: verify, never assume

Platform behaviour changes without notice, and most advice circulating online
is stale folklore. Every platform-behaviour claim you write must carry the
frame:

> Commonly reported. Verify against current platform documentation before
> relying on it.

Rules that follow from this:

- Never invent click-through rate multipliers, ranking weights, or "the
  algorithm favours X" claims. YouTube does not publish signal weights, and
  third parties that quote precise numbers are guessing.
- Treat truncation points as approximations. Titles get cut at different
  lengths on different devices and surfaces, so front-load the value instead
  of engineering to a character count.
- When the user asks "does X still work", answer from what YouTube's own
  docs currently say, and say what is uncertain. Stale confidence is worse
  than an honest unknown.
- Prefer the creator-facing documentation over aggregator blog posts. Blogs
  copy each other; the platform docs at least state what YouTube currently
  says about itself.

## Titles state the value and survive truncation

The title's job is to tell the right viewer, in one glance, what they get and
why this video. It must also work when truncated mid-sentence on a small
screen.

- Put the value or the search phrase in the first half of the title. The part
  that gets cut should be the part you can afford to lose.
- State what the viewer will learn or see, not how excited you are about it.
- Match the words viewers actually search for. The phrase in the viewer's
  head should appear recognisably in the title.
- One idea per title. Stacking a number, a keyword, and a brand name usually
  means none of them reads.

Bad:

> You WON'T BELIEVE what happened when I tried the newest framework
> ( Shocking results !!! )

Why it fails: it states no value, shouts in caps, and describes nothing a
viewer can search for.

Good:

> Postgres row-level security: a working setup you can copy

Why it works: it names the topic, promises a concrete outcome, and stays
meaningful if cut to "Postgres row-level security: a working".

## Thumbnail is the promise, title is the context

The thumbnail and the title are one unit that divides labor. Two of the same
words in both is a wasted slot.

- The thumbnail carries the emotional or visual promise: the result, the
  before/after, the dramatic moment, the single recognizable object.
- The title carries the precision and the words: what it is, the version, the
  use case.
- Design the pair together, not the thumbnail after the title is locked. A
  thumbnail that repeats the title's words tells the viewer half as much.
- Check the pair at phone size. Most impressions happen on small screens.
- The thumbnail must not lie or exaggerate beyond what the video delivers.
  A misleading thumbnail earns a click and a fast exit, which hurts the video.

Bad: a thumbnail of red arrows and huge text reading "POSTGRES RLS" on a
video titled "Postgres row-level security: a working setup you can copy".

Why it fails: the thumbnail repeats the title verbatim and adds only noise.

Good: a screenshot of working query results with a small overlay "it works",
titled as above. The visual shows the payoff; the title explains the topic.

## Descriptions: searchable first paragraph, then chapters

The description has two audiences: viewers deciding whether to watch, and
search matching against the video's metadata.

- The first paragraph is the part shown before "more". Write it as a plain
  answer to the viewer's question, including the main topic phrase in natural
  language. Not "welcome back to the channel".
- After the first paragraph, add chapters. List timestamps in ascending
  order, each section a real named topic, starting at the beginning of the
  video. Commonly reported requirements to verify in current docs: at least
  three timestamps and a minimum section length before chapters render.
- Chapter names are a second chance to be useful in search. Name the segment
  with the words a viewer would search, not "part 2".
- Keep the rest honest: links, sources, corrections. Filler keywords get
  spam-flagged per YouTube's own policy, verify the current wording.

Bad:

> hey guys welcome back to my channel!! don't forget to subscribe and hit
> the bell. in this video we talk about some database stuff, enjoy!

Good:

> How to set up row-level security in PostgreSQL so users only see their own
> rows. Full working SQL below.
>
> 0:00 The problem row-level security solves
> 3:12 Creating the policy
> 9:40 Testing it as three different users
> 14:05 Common mistakes

## Tags are a weak signal

Per YouTube's own help documentation, tags play a minimal role in discovery;
the title, thumbnail, and description do most of the work, and tags mainly
help with commonly misspelled terms. Verify the current wording in the help
article before repeating it.

- Spend at most a few minutes on tags. Reuse a small consistent set per
  topic so your own catalogue stays coherent.
- Do not tag-spam the description field; platform policy treats excessive
  tags as spam.
- If a choice exists between an hour on tags and an hour on the first
  thirty seconds of the video, spend it on the video. Time spent on tags
  past the misspelling case buys almost nothing, while retention buys
  recommendations.

## Shorts are a different surface

Shorts and long-form are surfaces with different behaviours. Commonly
reported, verify against current documentation:

- Shorts feed audiences mostly consist of viewers who did not search. The
  feed decides from early signals: did the viewer watch, leave, or tap away.
  The title and thumbnail matter less there than the first two seconds.
- Long-form documents survive and get revisited; a Short is usually watched
  once. Pack one complete idea per Short instead of an introduction to a
  longer video only.
- Reusing a long-form video's key moment as a Short works when it stands
  alone; a Short that only teases the full video tends to underperform
  because it promises a payoff it does not deliver.
- Analytics for Shorts read differently: percentage viewed and swipe-away
  behaviour carry more weight than average view time in absolute minutes.
  Never compare a Short's minutes to a long-form video's minutes.

## Read CTR and average view duration together

Impressions, click-through rate, and average view duration only mean
something as a chain. Reading one number alone produces wrong conclusions.

| CTR | Average view duration | Likely reading |
| --- | --- | --- |
| High | High | The packaging promises what the video delivers. Keep it. |
| High | Low | The thumbnail overpromises. Fix the honest gap, not the reach. |
| Low | High | The packaging undersells good content. Test new titles or thumbnails. |
| Low | Low | Topic or audience mismatch before packaging is even the question. |

Rules:

- CTR is relative to impressions and to where traffic comes from. A high CTR
  on a tiny impression count is a small sample, not a win.
- Average view duration depends on video length. Only compare across videos
  of similar length and format.
- Change one variable at a time (title, or thumbnail, not both) when
  testing packaging, or you cannot attribute the movement.
- Decide the review window before you look (commonly a few days after
  upload, verify what Studio currently exposes), so you do not narrate a
  random dip as a trend.

Bad: "CTR dropped a point since last week, the algorithm is punishing us."

Good: "CTR dropped while average view duration held steady, and impressions
spiked as the video reached new audiences. New-audience impressions usually
convert worse; check the impression source breakdown before changing
anything."

## No engagement bait, no misleading packaging

Never do these, regardless of what seems to work:

- Never write a title implying something shocking happens that does not.
  That trades one click for a watched-for-two-seconds metric that
  recommendation systems read as a failed delivery.
- Never promise in the thumbnail what the video does not contain.
- Never beg for likes or comments as the content's payoff ("like and I will
  make part 2"). Explicit engagement requests are not the signal that
  matters; watch behaviour is.
- Never borrow a trending topic into a title the video does not cover.

## Quick checklist

- Every platform claim written as commonly reported with a pointer to
  current documentation.
- No invented CTR figures, ranking weights, or algorithm opinions.
- Title states value in its first half and still reads when truncated.
- Thumbnail and title split the work instead of repeating words.
- Description opens with a plain-language answer, then honest chapters.
- Tags treated as a minor misspelling aid, not a strategy.
- Short versus long-form differences acknowledged before comparing numbers.
- CTR and average view duration always read together, against a traffic
  source breakdown.
- No engagement bait anywhere in the packaging.

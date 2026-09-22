---
name: video-script-writer
description: "Use when scripting a video. Write for the ear, hook with substance, and keep one idea per segment."
---

# Video Script Writer

A script is not an article read out loud. It is heard once, in real time, by
someone who can stop paying attention at any second. Write so that a listener
never has to rewind to follow you.

## Write for the ear, not the page

Spoken language has different physics than text. The listener cannot see the
sentence boundaries, cannot go back cheaply, and processes every word through
working memory of roughly a few seconds.

- Use short sentences. One clause at a time. If you need a comma, consider a
  period instead.
- Use contractions. "You'll hear" sounds human; "you will hear" sounds like a
  Terms of Service page.
- Put the important word in a stress position: at the end of the sentence, where
  the voice naturally lands and pauses.

Bad:

> In this tutorial we are going to explore, in some detail, the various
> mechanisms by which the application that you have deployed can be configured
> to persist its state across restarts.

Good:

> Here is the problem. You redeploy your app, and all your data vanishes. Let's
> fix that.

Read your draft aloud once. Rewrite anything you stumble on. A stumble where
your eye is fine is a sentence the ear cannot parse.

## Hook in the first 10 seconds, with substance

A hook is a demonstrated reason to stay, not a shout. Shock, volume, and
clickbait promise value; substance proves it. Open with the problem, a result,
or a live moment of the thing working. The hook does not need to ask for
attention. It needs to deserve it.

Bad (shock, no substance):

> "This ONE keyboard shortcut will BLOW YOUR MIND. Make sure you subscribe,
> because today we are going to do ten more amazing things like it."

Good (substance, no shouting):

> "This whole app caught fire because one engineer added a single `await`. Here
> is the line. Watch what happens when I remove it."

Nothing is earned by saying the video is good. Show the first piece of
evidence within ten seconds.

## One idea per segment

Structure the script as segments, each carrying exactly one idea: state it,
develop it, land it, then move. If a segment needs the word "also" to work, it
is two segments. Listeners can hold one rail; a second rail derails them and
they leave.

Bad:

> "So that's how imports work, which matters because next we'll do packages,
> but first note that imports also relate to the venv stuff we covered, which
> we'll circle back to in a second."

Good:

> "That is an import. That is all it does. Packages are a different layer, and
> they get their own section, right after this."

## Use the two column script format

Write narration in one column and what the viewer sees in the other. The
narration column is text to be spoken. The on-screen column is everything else:
the demo, the cut, the b-roll, the slide title, the text overlay. Scenes that
only narrate the screen die; scenes where the screen contradicts the narration
die faster.

| VO | On screen |
| --- | --- |
| "Here is the problem." | Screen recording: deploy runs, data vanishes. Cut to black for one beat. |
| "The fix is one line." | Editor: cursor moves to `persist=True`. Highlight it. |
| "But one line is never the whole story." | Zoom out. Slide: "What persistence actually costs". |

Every row should change something the viewer sees. If the on-screen column says
"shot of me talking", ask what that shot proves.

## Estimate length honestly, then check it

Roughly 150 spoken words per minute is a useful approximation for conversational
narration, slower for dense technical registers. Use it as a starting estimate,
never as the spec; real pace varies by speaker, register, and pauses.

The check that matters is the clock: record a 60 second sample read of the
densest part and measure what you get. Compare your actual rate to the estimate
before committing to a segment order, because a script 20 percent too long
causes cuts, and cuts are where loops break and retention dies.

## Structure for retention: open loop, payoff, next loop

Retention is not luck; it is a chain. Each segment opens a question the viewer
wants answered, pays it off, and uses the payoff momentum to open the next one.

1. **Open loop.** Pose a real question or show a gap. "This works. It should
   not." Not a rhetorical trick; a gap the viewer genuinely wants closed.
2. **Payoff.** Answer it with substance. A loop opened and not paid off trains
   the viewer that your loops are fake, and they stop waiting for them.
3. **Next loop.** Land the payoff, then immediately aim at the next gap: "That
   solves the crash. It does not solve the corruption."

Chain them for the whole runtime. A video that opens three loops at minute one
and pays them all off at minute eight loses everyone in between.

Bad:

> "We'll get back to why that fails later, but first, let me tell you how I got
> into programming."

Good:

> "Why does this fail? Two reasons. The first one is on screen right now."

## CTAs that do not derail

A call to action costs attention, so pay for it. Place it at a natural payoff
point, not mid-explanation, and tie it to the thing the viewer just got. A CTA
that interrupts a demo reads as a toll booth; a CTA right after delivering the
payoff reads as a handshake.

Bad (mid-demo, generic):

> "...and then the build succeeds. Oh wait, before I forget: smash that like
> button and hit subscribe, it really helps the channel. Anyway, so the next
> step is configuring the cache, which I was saying..."

Good (at a payoff point, tied to the payoff):

> "That is the whole fix, and it works on every service in this repo. The
> config file I used is linked below. If this saved you an afternoon, the
> subscribe button is where the next one lands."

Rules: one CTA, not three. Say what the viewer gets, not what you need. Keep it
under ten seconds.

## Match the script shape to the video type

Tutorial, video essay, and review are different machines. Do not write one and
retitle it.

| Type | Spine | Viewer's question | Failure if you write the wrong shape |
| --- | --- | --- | --- |
| Tutorial | Do this, then this, then this; result visible at each step | "Can I do this after watching?" | Essay-style digressions leave the viewer unable to act |
| Essay | Claim, evidence, counter, stronger claim | "Is this argument good?" | Step-by-step structure reads as patronizing |
| Review | Verdict up front, then evidence, then who should buy | "Should I spend money?" | Burying the verdict to hold retention reads as a bait |

Writing a review as a tutorial does not just bore people, it makes them unable
to accomplish the task they came for and had to work around.

## The read-aloud edit

The final pass is mechanical, not stylistic. Read the whole script out loud,
standing, at performance pace, with a timer.

- Rewrite anything you stumble on. A stumble where your eye is fine is a
  sentence the ear cannot parse, and the viewer does not get a re-read.
- Cut any sentence that survives only because it looked fine on the page.
- Mark the script where you need a breath. Performance pacing and page pacing
  disagree, and the page wins every time unless you mark the difference.
- Cover the B-roll column and read the VO alone. If the narration does not hold
  up with no pictures, no pictures will save it.

## Captions and accessibility

Captions are a first-class deliverable, not a post-production afterthought, and
the script is the cheapest place to make them good.

- Write full sentences, not fragments. Auto-captions are line by line; hand
  captions read as paragraphs.
- Write out numbers (write "fifteen", not "15"). Captions are read, not heard,
  and numerals are small on a phone.
- Write sound cues when grief lives in a sound effect: `[chime]`, `[error
  tone]`, `[hum rising]`. Do not caption a silent beat as `[silence]`.
- Mark every on-screen text overlay in the script with its exact wording. A
  caption track describing "a slide" instead of the slide's text is a
  description, not an accessibility pass.

Assume a meaningful share of viewers watch muted from the start. If the muted
pass of your script still works, everything downstream, including captions, has
a foundation.

## Pacing marks and stage directions

Keep two kinds of marks in the script, and only two kinds.

**Pacing marks** are performance instructions for the reader. Use them for a
one-beat pause (a caret), a hold (three dots), and emphasis (bold on the word
that carries the stress). Use them sparingly; a script where every line pauses
is a script where nothing lands.

> "That is the bug. ^ Should not happen. ^ ... Watch what happens when I
> **comment out this one line**."

**Stage directions** are production instructions for the edit. Put them in the
on-screen column, not inline between sentences, so they never interrupt the
narration flow.

Bad (mixed into VO):

> "So then (b-roll of the server room here, nice moody shots, maybe drone
> footage if we can get it) the cache invalidates, and everything works."

Good (moved to its column):

| VO | On screen |
| --- | --- |
| "So then the cache invalidates, and everything works." | B-roll: server room, slow pan. Cut in on the word "invalidates". |

## Kill the throat-clearing

"In this video I'm going to show you" is the most expensive sentence in any
script. Ten seconds of preamble before anything happens is ten percent of a
short video spent promising instead of delivering.

Bad:

> "Hey guys, welcome back to the channel. Today in this video I'm going to be
> walking you through how I approach debugging, so make sure you stick around
> until the end."

Good:

> "This bug took me four days. It was one line."

You do not need to announce the video; the video is announcing itself. Start
with the first piece of value and let the promise be implicit in what the
viewer is already looking at. If you must orient the viewer, do it in one
sentence with a concrete promise: "Three commands, ten minutes, you get a
working cache." Then start.

## Related skills

- [technical-writing](../technical-writing/SKILL.md): the written counterpart,
  where the reader can re-read instead of the viewer who cannot rewind.
- [readme-generator](../../meta/readme-generator/SKILL.md): scaffolding the
  written doc that a tutorial video usually links to.
- [review-comment-phrasing](../review-comment-phrasing/SKILL.md): phrasing
  feedback, useful when reviewing someone's script draft.

## References

- [YouTube: hooking viewers within the first critical seconds](https://blog.youtube/news-and-events/this-is-first-of-series-of-posts)
- [YouTube: four tips to hook your viewers](https://blog.youtube/creator-and-artist-stories/four-tips-to-hook-your-viewers-on)
- [Descript: how to write a video script](https://descript.com/blog/article/how-to-write-a-video-script-like-a-pro)
- [W3C: captions and subtitles overview](https://www.w3.org/WAI/media/av/captions/)
- [W3C: making audio and video media accessible](https://www.w3.org/WAI/media/av/)
- [NPR Training: how to edit with your ears](https://www.npr.org/sections/npr-training/2025/05/28/g-s1-67202/how-to-edit-with-your-ears)
- [Baruch College: speaking rate around 150 words per minute](https://tfcs.baruch.cuny.edu/speaking-rate/)


# Video Script Writer

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="video-script-writer robot" width="150" />
</div>

A skill for writing narration scripts for video: tutorial, video essay, or
review. A script is heard once, in real time, by someone who can stop paying
attention at any second. This skill writes scripts for that condition.

## What it does

The skill applies a set of rules to any video script you write or review. Each
rule targets a specific failure that loses the viewer.

| Rule | Prevents |
| --- | --- |
| Write for the ear: short sentences, contractions, stress positions | Sentences that parse on the page and collapse when spoken |
| Hook in the first 10 seconds with substance, not shock | Ten seconds of volume promising value that never arrives |
| One idea per segment | Listeners derailed by the second rail of a two-track sentence |
| Two column script: VO vs on-screen | Scripts that narrate dead footage, or footage that contradicts the VO |
| Estimate runtime at ~150 spoken words per minute, then measure | Scripts 20 percent too long, cut in the edit, where loops break |
| Retention chain: open loop, payoff, next loop | Minutes of nothing between a loop opened and paid off |
| One CTA at a payoff point, tied to what the viewer got | A toll booth planted in the middle of a demo |
| Match script shape to video type | Reviews written as tutorials, so the viewer cannot decide |
| The read-aloud edit: rewrite anything you stumble on | Sentences fine to the eye, unparseable to the ear |
| Captions written for reading, not auto-generated | Viewers on mute getting fragments and undescribed slides |
| Pacing marks vs stage directions, never mixed | Production notes splitting a spoken sentence in half |
| Kill the throat-clearing | Ten percent of the video spent announcing the video |

## When to use this

Use it when you are:

- Writing a narration script for a tutorial, walkthrough, or screencast.
- Writing a video essay that makes one argument across several minutes.
- Writing a review script with an earned verdict.
- Reviewing someone else's script and needing concrete, non-subjective notes.
- Converting a written doc into narration and finding it does not survive the
  trip (it will not; that is what the rewrite rules are for).

Do not use it for: shot lists and storyboards fully driven by visuals with no
narration, subtitles for existing footage where the audio already exists (the
rules apply, but the script decisions do not), or pure social clips under 30
seconds where hook density matters but segment structure does not.

## Quick start

You have been asked to script a five minute tutorial on fixing a crash. Here is
an opening written badly, then the same opening after applying the skill.

### Before

```text
Hey everyone, welcome back. In this video I'm going to be showing you
how to debug a crash in your application, so stick around until the
end because it's going to be really useful. First, a bit of background
on how our process handles signals. Crash handlers were added years
ago and the story there is pretty interesting, so let me walk you
through it. THEN we'll get to the actual fix around minute four.
```

Nothing happens for 30 seconds. The fix is promised at minute four. The
listener derailed on(segment) two of four: they were already gone.

### After

```text
| VO                                             | On screen                        |
| ---------------------------------------------- | -------------------------------- |
| "This crash took me four days to find."        | Terminal: stack trace scrolling. |
|                                                |                                  |
| "It was one line. Watch."                      | Editor: cursor on line 42.       |
|                                                |                                  |
| "We remove this `defer`, run it again, and..." | Terminal: process starts clean.  |
|                                                |                                  |
| "That is the fix. ^ ... Now: why did a         | Slide: "One line. Which one?"    |
| one-line defer take four days?"                |                                  |
```

The fix is being shown by second 10. The background became the next open loop,
not the price of entry, and the fix arrives before minute four where it was
complete.

## Key concepts

**The ear is the target, not the page.** Read the draft aloud once, standing,
at performance pace. Rewrite anything you stumble on. A stumble where your eye
is fine is a sentence the ear cannot parse; the viewer does not get a re-read.

**Substance is the hook.** Show the crashing app, the finished build, the
result before the method. A hook that needs to shout is a hook that has nothing
to show yet.

**One idea per segment.** If a segment needs "also" to work, it is two
segments. Chains of segments, each opening a real question and paying it off,
are what viewers experience as pacing.

**Two columns, always.** Narration in one, everything else on screen in the
other. Mixed inline stage directions are how a spoken sentence gets cut in
half by a production note.

**Loop, payoff, next loop.** Retention is a chain, not a vibe. Open a real
gap, close it with substance, open the next one on the momentum.

**Honest runtime.** ~150 spoken words per minute is an approximation, not a
spec. Measure the densest part with a real 60 second sample read before
committing to structure.

## Common pitfalls

### Opening with an announcement instead of a thing

Bad:

> "In this video I'm going to show you how to set up caching. It's a great
> topic and I think you'll get a lot out of it."

Good:

> "One line of config. Twice the throughput. Here."

Why: the announcement spends the most attentive moments of the video promising
instead of delivering; the viewer's decision to stay is already made or not.

### Putting "also" inside a sentence

Bad:

> "So imports pull names into scope, and that ties into the venv stuff, which
> we'll also use for packages later."

Good:

> "That is an import. That's all it does. Packages are next, and venv underneath
> both."

Why: the second rail derails a listener who can hold one thread, not two.

### Burying the verdict to hold retention

Bad (review script):

> "I'll give you my verdict at the very end, because first I want you to see
> the whole journey."

Good:

> "Verdict first: buy it if you do interviews weekly, skip it otherwise. Here's
> why."

Why: withholding the thing the viewer came for reads as bait, and the viewer
who came to decide leaves to find a faster verdict elsewhere.

### Mid-demo CTAs

Bad:

> "...and the build passes. Actually, quick plug: like and subscribe, it really
> helps. Anyway, so the next step is the cache config..."

Good:

> "...and the build passes. Config file's linked below. If that saved your
> afternoon, the next fix lands on the subscribe button."

Why: the first interrupts a demo and then struggles to resume; the second is
paid for by the payoff it follows.

### Reading only your VO column

Bad: narration polished in isolation, then the edit reveals half the shots
have nothing to cut to.

Good: the on-screen column is checked in the same pass, shot by shot, cut
listed against the line that motivates it.

Why: a script with unscripted footage is half a script, and half a script is
discovered in the edit when it costs the most.

### Writing captions nobody can skim-read

Bad:

> `13 th^15^ %- margin spelled` + every line breaks mid-phrase.

Good:

> "Fifteen percent margin, same quarter last year."

Why: fragments and mid-word breaks force a reader of the caption to
reconstruct the sentence instead of reading it.

## See also

Sibling skills in `skills/writing/` and related topics:

- [technical-writing](../technical-writing/SKILL.md): the written counterpart,
  where the reader can re-read and the viewer cannot rewind.
- [readme-generator](../../meta/readme-generator/SKILL.md): scaffolding the
  written doc a tutorial video usually links to.
- [presentation-design](../../design/presentation-design/SKILL.md): designing
  the slides and overlays the on-screen column references.

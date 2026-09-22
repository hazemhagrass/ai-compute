# Podcast Production

A skill for producing one publishable podcast episode: structuring it,
interviewing, recording clean audio, editing, and publishing through an RSS
feed with the text wrapper that makes it findable.

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="podcast-production robot" width="200">
</div>

## What it does

This skill covers the full loop of one episode, from skeleton to feed. Each
section targets a failure that sinks first episodes: structure that wanders,
interviews full of questions guests have answered everywhere else, audio
problems that are unfixable after the fact, and metadata that makes an episode
invisible to search and apps.

| Topic | Prevents |
| --- | --- |
| Episode structure | A 40 minute recording with no rest points and no single ask |
| Interview prep | A guest reciting the same answers they gave on four other shows |
| Follow-up discipline | Prepared questions read in order while real material walks past |
| Recording hygiene | Clipping, echo, and hum you cannot remove in the edit |
| The edit pass | A cut so polished it no longer sounds like people talking |
| Show notes as searchable text | An episode invisible to search engines and skimming listeners |
| Transcripts | An episode that fails accessibility and never ranks |
| Episode naming and numbering | "Ep. 12" burying the actual topic in every app |
| RSS basics | A feed that breaks silently and loses listener libraries |
| Guest consent | A recording that cannot legally be published |
| Sustainable cadence | A show that burns out after four weekly episodes |

## When to use this

Use it when you are:

- Planning or structuring an episode, solo or interview.
- Preparing to interview a guest and wanting questions beyond the press tour.
- Setting up a recording session at home or remotely.
- Editing a raw recording down to a publishable cut.
- Writing show notes, a transcript, or an episode page.
- Publishing or reworking an RSS feed, or moving hosting providers.

Do not use it for narrative sound-designed shows (radio-documentary craft is a
different discipline), for video-first production, or for choosing hardware.
Those need deeper dedicated guides; this skill covers the production loop
every show shares.

## Quick start

You are producing an interview episode. Here is a broken plan, then the same
plan after applying the skill.

### Before

```markdown
# Episode plans
- Invite guest
- Talk, see how it goes
- Edit it shorter, trim the boring bits
- Upload, title it "Ep 12: The one about failure"
- Ask guest to share when it is out
```

Five failures: no skeleton, no research plan, no recording checks, a title
that names nothing, and consent and cadence left to chance.

### After

```markdown
# Episode 12 plan

Skeleton (55 min target)
- Cold open: guest's most surprising claim from Block 1, 20 seconds
- Intro: 45 seconds
- Block 1: the guest's core work, 18 min
- Block 2: the contrary view, 12 min
- Block 3: what the listener should do differently, 8 min
- Outro: one CTA, 45 seconds

Guest prep
- Read their two papers and their last long interview
- Route around the three questions every other host asks
- Question blocks: opening, two follow-ups each, printed

Recording
- Separate tracks, headphones, peaks around -12 dBFS
- 30 seconds of room tone
- Remote guest: double-ender, clap sync, confirm file exists before goodbye
- Release signed before the session

Publish
- Title that names the topic, number in the feed tags
- Show notes: what the listener learns, who the guest is, one specific quote
- Transcript published, cleaned up, speaker labels, timestamps
- Feed validate before release; enclosure URLs permanent
```

Nothing here costs extra hours at the margin. It front-loads the decisions
that are expensive to reverse later.

## Key concepts

**Two halves of one episode.** The audio is heard once in real time; the text
wrapper (title, description, transcript) is what search and accessibility
actually read. Producers who polish only the audio ship an episode that works
in the player and disappears in search.

**Problems are cheap before the record button.** Clipping, echo, and room
noise are unrecoverable or near-unrecoverable afterward. The same checks take
ten minutes in setup and hours in rescue: separate tracks, headphone
monitoring, level headroom, recorded room tone, local-side recording for
remote guests.

**The guest's unrecycled insight is the product.** A guest on a promo tour
answers list questions on autopilot. Preparing questions by reading the
guest's own work and routing around what other interviews have already asked
is the highest-leverage hour in the whole production.

**Edit for attention, preserve for trust.** Cut what distracts: false starts,
duplicated answers, dead tests. Keep laughter, hesitation, and unresolved
disagreement. A cut with no human texture left sounds produced, and produced
audio costs you the listener's trust in what remains.

**Feed metadata is a public contract.** Once an episode GUID is published,
apps key off it; changed numbers and moved enclosure URLs break listeners'
libraries silently. Titles and artwork have app-level rules (numeric episode
tags rather than "Ep. 12" prefixes, square RGB artwork with no alpha channel)
and validators check them for free.

**Cadence you can hold is the strategy.** The most reliable predictor of a
podcast alive versus dead at a year is whether the cadence survived contact
with a normal life. Ambitious weekly launches fail more often than modest
fortnightly ones, because every maintenance cost (research, edit, notes,
publish) doubles the recording time and is invisible at the planning stage.

## Common pitfalls

### Recording a room instead of a voice

Bad:

> We will record together in the meeting room; it has nice echo, it feels
> professional.

Good:

> Record in the small soft room off the meeting room: parallel glass walls
> are why the last episode sounded like a bus station. One mic per speaker,
> close and slightly off-axis, headphones on everyone.

### Asking the questions the guest already answered everywhere else

Bad:

> First question is the usual: tell us how you got started in the field and
> what gets you excited about the future.

Good:

> Last year you wrote that the standard explanation of this margin was
> wrong and then had to retract half of it. Walk me through the month you
> found out which half.

### Editing out everything that makes it human

Bad:

> I removed every pause, laugh, and hesitation so it flows like a broadcast
> script.

Good:

> Kept the guest's pause before admitting the first approach failed: that is
> the moment the rest of the episode is about. Cut the false start before
> it and the retold answer after it, patched with this session's room tone.

### Treating the transcript as optional

Bad:

> Transcript later when we have time, it is just for SEO people.

Good:

> Transcript required at publish. Speaker labels, topic paragraphs,
> timestamps at the three key moments. Machine output reviewed and fixed:
> people search for the guest's real terminology, which the transcription
> model got wrong twice.

### Publishing numbers you will later change

Bad:

> We will rename the early episodes to fit the new scheme once the rebrand
> lands.

Good:

> Numbers are immutable once published; the new scheme applies to new
> episodes only, and the season field carries the grouping.

### Letting the launch set the bar

Bad:

> Weekly, two hosts, edited segments, and we will write full show notes for
> every episode starting next month when things settle down.

Good:

> Fortnightly, same day, one segment structure, notes and transcript shipped
> with every episode from the first one. Cadence we can hold in our worst
> week, not our best one.

## See also

Sibling skills in `skills/writing/`:

- [technical-writing](../technical-writing/SKILL.md) for the same task-first,
  failure-aware discipline applied to docs, which includes your episode page
  and your publish runbook.
- [video-script-writer](../video-script-writer/SKILL.md) for writing for the
  ear, which is the same physics as speaking to a podcast listener: short
  sentences, stress positions, substance in the hook.
- [review-comment-phrasing](../review-comment-phrasing/SKILL.md) if
  coordinating production feedback across hosts and editors, for wording that
  produces changes instead of defences.

External references, verified live at the time this file was written:

- NPR Training, "Before the first question: how to prepare for an audio
  interview": https://www.npr.org/sections/npr-training/2025/05/29/g-s1-67220/before-the-first-question-how-to-prepare-for-an-audio-interview
  for the pre-interview checklist used in the interview prep section.
- W3C Web Accessibility Initiative on transcripts, the source for the
  accessibility case and format advice:
  https://www.w3.org/WAI/media/av/transcripts/
- Apple Podcasts artwork specification, the concrete numbers behind the
  artwork section: https://podcasters.apple.com/support/5514-show-cover-template
- PRX feed requirements, covering the RSS 2.0 conformance basics:
  https://help.prx.org/hc/en-us/articles/360023748473-Overview-of-feed-requirements
- Reporters Committee for Freedom of the Press recording guide, the
  canonical per-state consent reference:
  https://www.rcfp.org/introduction-to-reporters-recording-guide/
- Pacific Content on release cadence and why shows that publish less often
  outlive hotter ones:
  https://pacific-content.com/how-often-should-i-release-new-podcast-episodes

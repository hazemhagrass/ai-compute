---
name: podcast-production
description: "Use when producing a podcast episode. Structure, record, edit, and publish so listeners can follow it and find it."
---

# Podcast Production

A podcast episode is audio plus a text wrapper: title, description, transcript,
and feed metadata. The audio is heard once, in real time. The text wrapper is
what search engines, accessibility tools, and skimming listeners actually
read. Both halves need deliberate work, and the second half is where most
first-time producers lose discoverability.

This skill covers the full loop of one episode. The weapons-grade craft of
sound design and narrative editing is out of scope; so is studio booking and
monetization. When the visual identity of the show matters, see
`../../design/` skills for art direction instead of improvising covers.

## Structure the episode before you record

An episode skeleton keeps a 40 minute conversation from becoming 40 minutes
of wandering. Sketch the skeleton as segment blocks with time budgets, not a
script.

- **Cold open.** A single compelling moment placed before the intro, cut from
  later in the episode: a strong guest claim, a soundscape, a question with
  stakes. It earns attention with substance, not a promise.
- **Intro.** Who you are, what this show covers, and what today covers. Keep it
  under 60 seconds. Repeating the full show slogan every episode punishes
  returning listeners.
- **Segment blocks.** Three to five blocks, each with one job: interview,
  explainer, story, listener question. Segments give the listener rest points
  and give the editor obvious boundaries for cuts.
- **Outro with a concrete CTA.** One ask, said once, plainly: subscribe,
  read the transcript, or a specific next episode. Three stacked asks cancel
  each other.

Bad skeleton for an interview show:

> Intro, greetings, "so tell us about your background", long unstructured
> chat, "well that was great, thanks for coming on", outro with three asks.

Good skeleton:

> Cold open: guest states the surprising result they will explain.
>
> Intro: 40 seconds.
>
> Block 1 (15 min): the guest's core work, two sharp questions and their
> follow-ups. Block 2 (10 min): the contrary view. Block 3 (5 min): practical
> application for the listener.
>
> Outro: one CTA, plus what comes next episode.

## Research the guest's real work, not their press kit

The person who answers like they are on their fifth podcast tour of the day is
answering recycled questions. The job is to find what this guest has not been
asked everywhere else.

- Read the guest's own output first: papers, posts, code, talks, interviews.
  Their own words tell you how they think, which tells you how to ask.
- Find the questions already circulating (other interviews, event panels) and
  explicitly route around them. If you must include one for context, compress
  it into the first minutes, not the middle.
- Draft question blocks, not a list read in order. Each block bundles an
  opening question, two follow-ups, and the expected shape of an answer.
  Print them. See the NPR Training guide on interview prep in See also.
- Record a 20 second self-introduction from the guest ("who you are, what you
  work on") before the first question. It slates the tape and often becomes
  usable audio.

## Follow-up question discipline

A prepared list is a floor, not a script. The interview is won on follow-ups
because the follow-up is where preparation meets what the guest actually said.

- Listen for the unverified claim, the number, the contradiction, and the
  half-sentence. Those are the four follow-up triggers. Chase one, then
  return to the map.
- Ask follow-ups that demand specificity: "walk me through that month" or
  "what did that fail to fix". Vague praise plus "interesting" is not a
  follow-up, it is a stall.
- Stop talking the moment the guest starts. Silence does the work a
  redundant question would do. Do not fill a pause; an honest pause on tape
  is often the moment a listener remembers.
- Keep the map visible: if you have chased a thread for five minutes, note
  where you left the main spine. A good cut needs the spine intact.

## Recording hygiene

Audio problems are cheap before the record button and expensive after. Do the
boring checks every time.

- **Room.** Small, soft, quiet. Hard parallel walls make echo no equalizer can
  remove. Recording in an empty room is rarely better than a bedroom with
  curtains and a duvet.
- **Mic.** One mic per speaker, dynamic or close-talk condenser, 5 to 15 cm
  from the mouth, slightly off-axis so plosive consonants miss the capsule.
  Headphones on every speaker so nobody's speaker output gets re-recorded.
- **Levels.** Target speech peaks around -12 dBFS so there is headroom for
  laughter and surprise. Record all voices on separate tracks. Waves that
  clip are unrecoverable; waves that are quiet are just quiet.
- **Room tone.** Record 30 seconds of the room's silence, everyone standing
  still. It is your patch material to bridge cuts so edits do not sound like
  breaths from a different room.
- **Double-ender for remote guests.** Everyone records their own mic locally
  while the call runs only for communication. Before starting, both sides
  count in and clap once on camera or on the call: the sharp transient makes
  aligning the local files seconds instead of minutes. Confirm at the end
  that the guest's file exists before goodbye.
- A spoken-word delivery target sits near -16 LUFS with a true-peak ceiling
  near -1 dBTP; apps normalize playback, so loudness beyond that is wasted.

## Do the edit pass, and stop

Editing is two jobs: removing what distracts, and preserving what keeps the
conversation human.

- Cut material that distracts: false starts, two-minute tests of the recorder,
  the third retelling of the same answer, the moment where the joke is
  explained. Keep the retelling with the most confident phrasing.
- Keep the humans in: laughter, hesitation before a hard admission, a
  disagreement left unresolved. Polishing those away makes a show nobody
  trusts.
- Patch every cut with room tone from the same recording session, not from a
  different day.
- Do at least one full listen-through on headphones at normal speed before
  export. Anything that makes you reach for skip is a decision, not a rule;
  either fix the audio or accept the bump on purpose.

Bad cut reason:

> "The guest took too long to answer, so I removed the pause."

Good cut reason:

> "The question was asked twice and the second answer is the one that
> commit-led to block 2, so I kept answer 2 and removed the duplicate
> question, patching with room tone from this session."

## Show notes are searchable text

Nobody finds your show by listening to your audio page; they find it by
reading text that names the problem, the guest, and their work.

- Title the episode for a listener deciding to press play, not for an
  internal file name. Lead with the actual content, in plain language.
- The description covers, in under 200 words: what the listener will learn,
  who the guest is, and one specific thing they said. Not thank-yous, not
  the full transcript dumped in.
- Link the guest's actual artifacts (paper, repo, project), the books or
  sources referenced, and timestamps for the top three moments. Every link
  is text a reader or a search engine can follow.
- Publish the transcript alongside the audio. Full text on your own page is
  what search indexes; put the summary in the feed and the transcript where
  listeners can read it. Keep the transcript on your own domain and keep a
  short excerpt in the feed so the canonical page is yours. See
  https://www.w3.org/WAI/media/av/transcripts/ for the accessibility case.

## Transcripts for accessibility and search

A transcript is not a nice extra, it is the WCAG-facing version of the
episode, and it becomes the searchable text.

- Publish a clean transcript with the episode: speaker labels, paragraph
  breaks at topic changes, and timestamps at section heads so listeners can
  jump to a moment.
- Machine output is a draft, not a transcript. Fix speaker names and terms
  of art; a wall of misattributed speech fails both accessibility and
  search.
- Keep names and jargon in the transcript exactly as the guest said them so
  a search for their real terminology finds the episode.

## Name and number episodes for search

Search apps and feed validators treat certain episode title patterns
differently, and listeners scanning a list do too.

- Put the episode number in the feed's numeric episode tags, not as the
  first words of the title. "Ep. 12: Title" reads as foreground noise in an
  app list and harms search matching on the title words.
- Use a title that would make sense in a search result without the show
  name: name the topic, the guest, or the concrete promise.
- Keep a consistent scheme for the season part, and do not renumber old
  episodes once published. Feed consumers cache by GUID, so changing
  published numbers breaks listeners' libraries.

## RSS basics

The feed is the contract with every podcast app. Once published, treat
episode GUIDs as immutable; apps key off them.

- Get the channel right once: title, an accurate description of the show,
  one explicit category, the show cover, and a stable link.
- Per episode: title, description, publication date, episode number, season
  if you use one, and the enclosure pointing at a permanent URL for the
  media file.
- Validate the feed with Apple Podcasts' tooling before the first episode
  goes live; the specs you must meet are documented at
  https://podcasters.apple.com/support/5514-show-cover-template and in the
  PRX feed requirements at
  https://help.prx.org/hc/en-us/articles/360023748473-Overview-of-feed-requirements
- Artwork 3000 by 3000 pixels in RGB, no transparency, under 1 MB. Larger is
  not better; apps will not want it and it slows the feed load.
- Changing hosting providers means backing up the feed and moving every
  enclosure URL without breaking old episode GUIDs. Treat this like a
  database migration, not a drag-and-drop.

## Guest consent and releases

Consent is both an ethical and a legal checkpoint, and the legal part varies
by state.

- Get explicit permission to record, and state on tape that everyone knows
  they are being recorded.
- Recording-consent law differs by jurisdiction: federal law requires
  one-party consent at minimum, but about a dozen states (including
  California, Florida, Illinois, and Massachusetts) require all-party consent,
  and a few apply different rules to in-person versus phone conversations.
  When you and your guest sit in different states, the stricter law can
  apply. The Reporters Committee for Freedom of the Press maintains the
  canonical guide at https://www.rcfp.org/introduction-to-reporters-recording-guide/
- Use a written release for guests. It should cover: recording, editing,
  publication, distribution, use of name and likeness, promotional and
  archival use, ownership of the recording, and what happens if the guest
  wants to withdraw. Send it before the recording, not before the episode
  drops.
- If you offer the guest review of the final cut, put the terms in the
  release, not in a follow-up email. Unbounded approval rights are how
  episodes die in someone's inbox.
- Do not assume verbal consent covers redistribution. A release survives
  disagreement; a verbal "sure, go ahead" does not.

## Sustainable cadence beats ambitious starts

Most shows die young. The median podcast stops publishing within months of
launch while the shows everyone listens to have published hundreds of
episodes. Ambition at the launch is the killer.

- Ship a cadence you can hold in a bad month. Weekly is a promise you must
  keep; fortnightly or monthly is a cadence that survives illness, holidays,
  and a guest cancellation.
- Choose episodic consistency over volume: same day, same structure, same
  completion standard. Listeners build listening habits on predictability.
- Budget the hidden hours: research, edit, write notes, publish, promote.
  They routinely cost more than the recording itself. Budget for them or you
  will cut quality right when it matters.
- Batch work: record several intros or listeners' questions in one session.
  Batch-instance efficiency is the same logic as the release-cadence advice
  in https://pacific-content.com/how-often-should-i-release-new-podcast-episodes
- Plan for skipped weeks on purpose, not by accident. A planned hiatus beats
  a silent one.

## Quick checklist

- Skeleton exists with time budgets for cold open, intro, blocks, outro, and
  a single CTA.
- Guest research read their own work; question blocks avoid the questions
  other interviews have already asked.
- Separate tracks, headphones, level headroom, room tone recorded, clapped
  sync point for remote guests.
- Cut what distracts and keep the texture that keeps the conversation human.
- Show notes describe the substance, in specific, searchable words, with links
  that work.
- Transcript published, cleaned up, with speaker labels and timestamps.
- Feed has valid tags, permanent enclosure URLs, and conforming artwork, and
  the episode GUID is immutable after publication.
- Guest release signed before recording; consent law of both guest and host
  states considered.
- Cadence chosen for a bad month, not a good one.

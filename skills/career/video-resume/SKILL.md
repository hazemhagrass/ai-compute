---
name: video-resume
description: Use when an application wants a video introduction. Decide whether to skip it, or record one that does not hurt the candidacy.
---

# Video Resume

A video introduction is the highest risk artifact in a job search. Attach a
flawed PDF and a reader skims past it; attach a flawed video and they watch you
do badly for sixty seconds. Slow to watch, impossible to scan, and it
broadcasts exactly the traits (age, accent, appearance, disability, set,
lighting) that a paper resume keeps out of the hiring decision. Most employers
never ask for one. The default answer is to skip it.

You still record one in two situations, and the advice below is for those only:

1. The application or platform requests one. Pre recorded interview software
   (HireVue and its equivalents), creative job boards, and some application
   forms require a video. That is a screen, not a compliment: the recruiter
   needs something to fast forward.
2. The role rewards being watched. Client facing work, sales, teaching,
   presenting, on camera and voice work. Here the video is evidence for the
   claim on your resume that you communicate well, and a good one is a real
   advantage.

Everything in between is a judgment call you make, not the skill. If you expect video introductions to disadvantage you, read the bias section
below and weigh it yourself; no advice here can make that decision for you.

## Solve for the skimmer, not the viewer

Nobody watches a candidate video the way they watch Netflix. They open six
tabs, watch the first ten seconds with the sound off, and decide. Build for
that reader:

- The first fifteen seconds carry the entire video. Name, what you do, one
  concrete thing you did. Everything after is bonus.
- Assume muted viewing. Captions burned in or toggled on are not decoration;
  they are the primary channel for a large share of viewers.
- Sixty seconds is the ceiling. Recruiters perceptibly relax when the progress
  bar looks short. Forty five is comfortable; ninety invites the scroll.
- Put your name and role in the first caption block and the video title, so a
  muted viewer and a file browser both get context immediately.

## Choose one story, not a tour

Narrating your resume aloud is the most common failure and the least
persuasive use of the medium. The resume already lists the roles; a video that
repeats it adds nothing a reader would not skim. The camera is for the one
thing text cannot do: a specific, human, small story.

- Pick a single moment: a problem you noticed, what you actually did, what
  changed. One story told well beats five summarized badly.
- Name real details (the metric, the tool, the obscure constraint) because
  details are what make it verifiable and memorable.
- End with why this role, in one sentence, if you have a genuine reason. Do
  not manufacture enthusiasm; generic why I am excited closers read as filler.

## Write a structure, not a script

Read delivery is obvious on camera and it always reads worse than slightly
rough speech. The eyes drift, the cadence flattens, small lapses in
enthusiasm show. Instead, write beats and speak to them:

- Five beats on a card just outside the frame: hook, the story, what it shows,
  why this role, name.
- Under each beat write two or three bullet fragments, never full sentences.
- Rehearse out loud three or four times until the transitions are automatic,
  then record. A fresh take with a forgotten word is better than a rehearsed
  recitation.
- It is fine to say "so" or restart mid take; you are cutting, not perfecting.

## Framing, eye line, light

These are cheap to get right and the failure modes are all visible in the
first two seconds:

- Eye level and eye line: raise the laptop on a stack of books; a camera below
  your chin is the single most common amateur tell. Look at the lens, not the
  screen, for every important line.
- Light from the front. Face a window; the soft, even, free light beats any
  ring light. Never sit with a window behind you: backlight turns you into a
  silhouette, and that is the most common ruined take.
- Background simple and real. A plain wall or a tidy room beat both the fake
  blur filter (reads as evasion) and the kitchen debris (reads as carelessness).
- Frame from mid chest up, with a little headroom, camera at arm's length or
  further to avoid lens distortion.
- Check the frame in the recording, not the preview: what plays back is what
  they see.

## Audio decides whether you look careful

Poor video is forgivable. Poor sound reads as low effort far more than any
visual flaw does, because everyone has learned to associate echo and hiss with
quality judgment, and most people notice nothing else. Spend more attention
here than on any camera choice:

- Record in a soft room: curtains, carpet, a closet works. The echo of a
  hallway or glass office is the most audible failure and no filter fixes it.
- A phone or laptop mic holds up fine at close range; an external lav or a
  headset mic is better if you already have one. Do not buy equipment for
  this.
- Get close to the mic (a hand's width to two) rather than building distance
  with room noise.
- Normalise loudness to a standard (around -16 LUFS integrated, true peak
  below -1.5 dB) so you sound normal next to the video around you in the
  recruiter's playlist.

## Record in takes and cut

Chasing a flawless single run is how videos go stale. Nobody watches the takes
you rejected; they only see the assembled cut.

- Record the full video five or six times. Expect to prefer take four or five,
  recorded with getting-it-right energy rather than nailing-it tension.
- Cut sections per beat so you can re record just the weak hook or just the
  closer without starting over.
- Trim with small overlaps, not music beds: `ffmpeg -ss 2.1 -i in.mp4 -t 8.5
  -c copy out_take1.mp4` keeps the stream untouched and drops the False start
  without re encoding. Verify each take plays cleanly before assembling.
- If your assembled video has visible jump cuts between beats, that is fine.
  One or two are honest; a pile of them is a different failure (see pitfalls).

## Captions and transcript

Captions are accessibility, not optional polish. Deaf and hard of hearing
viewers need them; a large share of viewers watch without sound; and a
transcript means your content is searchable and quotable (a recruiter can
paste your one sentence summary into their notes instead of re watching).

- Burn captions in if the platform strips sidecar subtitles on playback;
  otherwise ship `.srt` alongside. Burned in solves the muted recruiter
  everywhere.
- Write captions to be read, not as subtitles for a transcript you pasted:
  short, one or two thoughts per line, matching what you actually said.
- Publish the plain text transcript next to the link, so the content survives
  even if the host removes it.

## Deliver as a link, not an attachment

A 100 MB `.mov` in an inbox is a dead video: mail clients block, preview
windows choke, mobile recruiters never open it. Host it and ship a link:

- Unlisted YouTube is the standard: short link, no login required, plays
  anywhere. Google Drive unlisted, Vimeo unlisted, and Loom also work; pick
  whatever renders an inline player at the recipient.
- Title the file and the video for the reader who scans a folder of links:
  `Pat Lee, Backend Engineer, 60s intro`. Never `final_final_v3.mov`.
- Include the transcript in the note under the link, so scanning happens
  without a click.
- Test the link from a logged out phone browser before you send it. If it
  needs a login, a cookie, or a download, it fails the actual delivery test.

## The bias problem, stated plainly

A video strips the anonymity a paper resume provides. The viewer learns your
apparent age, accent, race, gender, physical presentation, perceived
disability, and confidence long before they learn anything you said. Research
on hiring bias is consistent that visual first impressions import stereotypes,
and a video puts all of them before the fact that matters most.

If you are a member of a group that faces hiring bias and the video is not
required, the safest and often the best move is to not record one. If it is
required, or if the role is genuinely visual or client facing and you have
reason to think you present well on camera, record it and control what you can
control:

- The one effective lever is control of the recording environment, not
  performance of a personality. Good lighting, clear sound, deliberate framing
  signal care and skill, not conformity.
- Do not try to hide or "fix" an accent, a disability, or age. Deliver
  competent work and present it plainly; the video measures whether you can
  articulate your value, which should not require looking like a stock photo.
- Recruiters who only care to watch video probably filter on it the same way
  regardless of content; that is a fact about them, not you.

## What never to do

These all read as gimmick, and recruiters have watched several hundred of
them. Assumed novelty is a penalty, not a plus.

- Cold open hook or trailer cut. The words "What I do is hard to explain" over
  a black screen before your face: every one of these is skipped.
- Music under speech. Distracting, mixes badly against voice on cheap
  speakers, and adds nothing since video resumes are watched with sound off
  anyway or skipped for it.
- Novelty editing: glitch transitions, meme stickers, kinetic type, split
  screen, "In my day" newsreel framing. Cute once on TikTok, demeaning on a
  job application.
- Jump cut overload. More than a couple of cuts reads as editing-for-speed,
  not authenticity, and the only thing that justified a 12 second video
  (a hook) is gone.
- Effects over captions. Filters, beauty modes, background blurs, fake
  office. Applications are judged for honesty first; filters signalling
  obfuscation is worse than a shaved head or a messy room.

## Production workflow

Recording, cutting, re recording, captions, normalising, and hosting are
production work, not application paperwork. Do them in one sitting with a
timer: two hours of setup and rehearsal, 30 minutes of takes, 30 minutes of
editing, 15 minutes of captions and transcript, 15 minutes to upload and test
the link. This skill covers what to say and how to present; for the general
recording and editing workflow, see the `youtube-content` skill, which covers
talking head capture, cutting, captioning, and audio in more depth.

For everything that happens before the recording (drafting the story beats,
rehearsing delivery, and how to handle the interview answers that the video
sets up), see the `interview-prep` skill, which owns on camera answer delivery
in this repo.

## Quick checklist before you send

- Thirty seconds of the video watched with sound off still communicates who
  you are and what you do.
- The first fifteen seconds alone name you, your work, and one concrete
  result.
- Audio is clear in a soft room, normalised, no echo or hiss.
- No music, no filters, no cold open, no jump cut pile.
- Captions burned in or attached, transcript published with the link.
- Unlisted hosted link, tested from a logged out phone, no login required.
- Total length under sixty seconds.

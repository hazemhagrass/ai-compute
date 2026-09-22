# Video Resume

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="video-resume robot" width="200">
</div>

A decision framework plus recording guide for short video introductions in a
job search: when to skip them, when they actually help, and how to record one
without reading a script on camera.

## What it does

Treats the video resume as a high risk, rarely requested artifact and tells
you plainly when it will hurt you. When one is required or genuinely
advantageous, it covers the whole production: length discipline, choosing one
story instead of narrating the resume, speaking to beats rather than reading a
script, framing and lighting, audio quality, cutting takes together, captions
with a transcript, and delivering a hosted link instead of an attachment.

## When to use this

- An application form, job board, or pre recorded interview platform asks for
  a video and you cannot opt out.
- The role is client facing, sales, teaching, presenting, or on camera work,
  where a video is evidence for the claim that you communicate well.
- You are weighing whether to send a video you were not asked to send, and
  need an honest cost/benefit view including the bias problem.
- You already decided to record and need the concrete setup, script structure,
  and ffmpeg commands to do it in one sitting.
- Skip this skill entirely if the video is optional and you are not actively
  presenting yourself on camera; a PDF does the job with less risk.

## Quick start

A complete worked example: Annika Sørensen, eight years as an engineering
team lead at a logistics SaaS company, applying for a customer facing
Architecture Solutions Lead role that explicitly requests "a short video
introducing yourself" on the application form.

### The decision

The role is client facing and pre sales, so a video is genuine evidence. She
records. She also counts the bias exposure (accent, being a mid career woman
on camera) and decides the presentation risk is outweighed by the demo value
of explaining architecture to a camera. Your weighting may differ.

### The beats (five, on a card just below the lens)

1. **Hook**: name, role, one concrete result.
2. **Story**: the migration problem.
3. **Point**: what that story shows.
4. **Why here**: one genuine sentence aimed at this employer.
5. **Close**: name again, one call to action.

### The full sixty second script

Beat fragments (not sentences, spoken to, never read):

- Hook: "Annika Sørensen" / "team lead, logistics SaaS" / "moved 40 million
  shipments a year off a monolith, zero downtime"
- Story: "planned over 11 months" / "cutover night, one node lagged" / "we
  went back to paper based dispatch plan I had written months earlier"
- Point: "I run migrations like an operations nervous system" / "the plan
  mattered as much as the code"
- Why here: "you sell into operations teams who buy trust, not features" /
  "architecture sold well is half of delivery"
- Close: "happy to walk through the migration story in person" / "Annika
  Sørensen"

### The setup

- Camera: phone at eye level on a stack of books, arm's length, mid chest
  frame, lens at her eye not her chin.
- Light: sitting facing a window at 10am, no lamp behind her, plain wall four
  feet behind.
- Sound: phone mic, soft room with curtains, no fan or fridge, under the
  duvet trick while testing room echo before the first take.
- Wardrobe and background: what she would wear to the first round interview;
  no filters, no background blur, no virtual office.
- Captions: burned in; she assumes muted viewing throughout.

### Sixty seconds, beat by beat (with burned-in caption first line)

| Beat | Time | What she says | Caption first line |
|---|---|---|---|
| Hook | 00:00-00:12 | Hi. Annika Sørensen. I've led engineering on a logistics platform moving 40 million shipments a year, and last year we moved all of it off a monolith with zero downtime. | Annika Sørensen, team lead on the shipping platform |
| Story | 00:12-00:34 | We planned for 11 months and the cutover still nearly failed. The night we migrated, one node lagged and nobody could see the dispatch queue. We didn't panic. I had written a paper based dispatch plan months earlier, we printed it, and we ran the night on paper until the lag cleared. | We cut over to paper, and by 6am the system was ours |
| Point | 00:34-00:45 | That story is how I do architecture. The plan is a real artifact, not a document; I write it for the night it fails, not the day it passes. | The plan is built for the night it fails |
| Why here | 00:45-00:55 | You sell into operations teams, and they buy trust rather than features. Architecture that can be explained well is, I think, half of delivery. | Architecture explained well is half of delivery |
| Close | 00:55-01:00 | Annika Sørensen. Happy to walk through the migration/rollback story in person. | Annika Sørensen, thanks for watching |

Sixty two seconds; she records take five, where she stumbles the word
"exactly" and keeps going rather than restarting.

### Commands (all verified against a generated test clip)

```bash
# Make a test clip so you can rehearse a cut pipeline before touching real takes
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=440:duration=10 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac clip.mp4

# Trim a take (stream copy, no re-encode, keeps quality)
ffmpeg -ss 2.1 -i take4.mp4 -t 8.5 -c copy take4_cut.mp4

# Normalise loudness to -16 LUFS so your voice sounds like nearby videos
ffmpeg -i take4_cut.mp4 -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" take4_norm.mp4

# Confirm it actually normalised (RMS should land near -16 on speech content)
ffprobe -v error -f lavfi -i "amovie=take4_norm.mp4,astats=metadata=1" \
  -show_entries frame_tags=lavfi.astats.Overall.RMS_level -of csv=p=0

# Burn captions in, so muted viewing still gets the message
ffmpeg -i take4_norm.mp4 -vf "subtitles=cap.srt:force_style='FontSize=20'" \
  -c:a copy final.mp4

# Check the final duration and size before you upload
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 final.mp4
```

Then: upload unlisted with the title "Annika Sørensen, Solutions Lead, 60s
intro", paste the transcript under the link in the application note, and open
the link from a logged off phone before submitting.

## Key concepts

- **First fifteen seconds carry everything**: recruiters watch with sound off
  and often stop early; the hook has to land muted and alone.
- **One story, not a tour**: a specific moment (problem, action, change) beats
  narrating the resume, which the viewer already skimmed.
- **Beats, not a script**: speak to fragments on a card; read delivery always
  looks worse than slightly rough speech.
- **Beat bias first**: a video exposes age, accent, appearance, and disability
  that a paper resume does not. This is a real cost you weigh, not a footnote.
- **Audio over video**: poor sound reads as low effort more than any visual
  flaw; soft room, close mic, normalised loudness.
- **Takes and cuts**: record the whole thing several times, cut per beat, and
  never chase an unbroken perfect run.

## Common pitfalls

| Bad | Good | Why |
|---|---|---|
| Narrating the resume out loud, role by role | Tell one specific story with measurable details | The viewer already read the resume; repetition adds nothing the camera is needed for |
| Reading a full script to camera | Speak to beats on a card below the lens | Read delivery is visibly flat and obvious; slightly rough sounds more credible than rehearsed |
| Shooting with a window behind you | Face the window, wall behind you | Backlight silhouettes you; front light is free and better than a ring light |
| Recording in a hard walled room, distant mic | Soft room, mic a hand's width away, loudness normalised | Echo and hiss read as low effort far more than any visual problem |
| Music bed under the voice | No music; voice and captions only | Music distracts, mixes badly on cheap speakers, and most viewing is muted anyway |
| Cold open trailer, meme stickers, glitch cuts | Straight talking head, clean cut per beat | Recruiters skip gimmicks; honest delivery survives tone judgment |
| Attaching a 100MB .mov to email | Unlisted YouTube link plus transcript in the note | Attachments get blocked, previews choke, and phones never open them |
| Re recording until one take is perfect | Take the best of five and cut per beat | Nobody sees the rejected takes; chasing perfect wastes hours and loses warmth |

## See also

- [../interview-prep/README.md](../interview-prep/README.md)
- [../creative-resume-design/README.md](../creative-resume-design/README.md)
- [../latex-resume/README.md](../latex-resume/README.md)
- [../cover-letter-generator/README.md](../cover-letter-generator/README.md)
- General recording/editing workflow: the `youtube-content` skill under
  `media/` (referenced from SKILL.md; not linked here until it exists).
- [../linkedin-profile-optimizer/README.md](../linkedin-profile-optimizer/README.md)

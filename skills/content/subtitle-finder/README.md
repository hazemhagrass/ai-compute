# Subtitle Finder

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Match a subtitle file to the exact video you have, not just the title. The
find is easy; the *match* is the whole skill.

## What it does

Guides an agent through the five-step subtitle workflow: inspect the
container, extract an embedded track if one exists, query OpenSubtitles by
`moviehash` first, fall back to title-and-release-group only when hashing
fails, and verify the last cue lands within one second of the media duration
before keeping the file.

The skill is opinionated about which decisions are hard and which are easy,
so it does not pretend the search is the work.

## When to use this

- A video file plays but has no captions.
- A downloaded subtitle drifts partway through a show and you need to know
  whether that is fixable (sync tool) or fatal (wrong release).
- You are automating a media library and want the pipeline to refuse
  subtitles that will drift, rather than keep them and paper over later.

Do not use it for live streams, growing recordings, or on-screen text
translation (typeset `.ass` tracks are outside the search).

## Quick start

```
# 1. What is in the file?
ffprobe -v error -select_streams s \
  -show_entries stream=index,codec_name,codec_type:stream_tags=language \
  -of json input.mkv

# If a text subtitle in your language is there, extract and stop.
ffmpeg -i input.mkv -map 0:s:0 -c:s copy out.srt

# 2. No embedded track. Compute the moviehash (algorithm in SKILL.md).
HASH=$(python3 -c 'from moviehash import moviehash; print(moviehash("input.mkv"))')

# 3. Query by hash first.
curl -s "https://api.opensubtitles.com/api/v1/subtitles?moviehash=$HASH&languages=en" \
  -H "Api-Key: $OS_KEY" \
  -H "User-Agent: MyApp v1.0"

# 4. Verify sync: last cue vs media duration.
media=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 input.mkv)
last=$(tail -n 20 subs.srt | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2},[0-9]{3} --> [0-9]{2}:[0-9]{2}:[0-9]{2},[0-9]{3}' \
  | tail -n1 | awk '{print $3}')
```

A hash hit with the sync check passing means the subtitle plays right from
first cue to last. Anything else is a candidate, not a match.

## Key concepts

**`moviehash` is deterministic.** File size plus first and last 64 KB of the
file, summed as 64-bit little-endian integers. The offsets are fixed and
non-negotiable; changing them yields a hash the API cannot match.

**Text vs image subtitles.** `subrip`, `ass`, `mov_text` are text. `PGS`
(`hdmv_pgs_subtitle`) and `VobSub` (`dvd_subtitle`) are bitmaps. `ffmpeg`
cannot convert bitmap subtitles to text without OCR, and OCR introduces
errors. Skills that claim otherwise are wrong.

**Containers and codecs.** `.mkv` accepts `SRT`, `ASS`, `PGS`. `.mp4` only
accepts `mov_text`, so `SRT` must be converted, not copied. `.webm` only
takes `WebVTT`. The container decides how you close the loop.

**Release groups matter.** `YIFY`, `YTS`, `WEB-DL`, `BluRay` are specific
encodes with their own timings. A subtitle for the same title but a
different release group drifts by 2 to 15 seconds. Read the release group
from the filename and prefer subtitles whose `release` field matches.

**Sync check as gate.** The last cue landing within one second of the media
duration is a necessary but not sufficient check. Anything worse than that
must be discarded, not kept.

## Common pitfalls

Bad: use the XML-RPC endpoint at `api.opensubtitles.org/xml-rpc`.

Good: use REST at `api.opensubtitles.com/api/v1/`, with `Api-Key` and a
bearer token from `/login`. XML-RPC went offline on 2023-12-31.

Bad: send `User-Agent: curl/8.4.0` to the OpenSubtitles API.

Good: send `User-Agent: MyApp v1.0` (the `APP_NAME vAPP_VERSION` format the
API requires). Generic user agents are rejected.

Bad: extract a PGS bitmap track with `ffmpeg -c:s copy out.srt` and treat
the file as done.

Good: refuse the extraction and either OCR (accepting errors) or search
for a text subtitle instead.

Bad: mux `SRT` into `.mp4` with `-c copy`. The mux silently fails and the
player shows nothing.

Good: convert during mux with `-c:s mov_text`, since `.mp4` does not
accept `SRT`.

Bad: keep the first API result because it has the right title and year.

Good: keep only after the sync check passes. A same-title, same-year
subtitle from the wrong release group is not a match.

## See also

- `../podcast-production/SKILL.md` for the audio-first workflow that
  precedes captioning.
- `../video-script-writer/SKILL.md` for scripting a video, which produces
  the timings you would otherwise recover from a subtitle file.
- `../youtube-seo-optimizer/SKILL.md` for captions as an SEO signal
  specifically on YouTube.

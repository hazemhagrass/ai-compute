---
name: subtitle-finder
description: "Use when finding subtitles for media you already have. Match by moviehash first; inspect the container; verify sync before you keep."
---

# Subtitle finder

Finding subtitles is not the hard part. The hard part is matching a subtitle to
the exact file you have, so it stays synced from the first cue to the last. A
subtitle with the right title, right year, and right language can still drift
by fifteen seconds because it was timed for a different release.

This skill treats the match as the work.

## The five decisions, in order

1. Inspect the file: container, codecs, and any embedded subtitle tracks.
2. If a text subtitle is embedded, use that. Extract with `ffmpeg`.
3. Compute the OpenSubtitles `moviehash`. Query by hash first.
4. If no hash hit, query by title and year, then choose the release group
   that matches the filename (`YIFY`, `WEB-DL`, `BluRay`).
5. Verify sync: the last cue must land within one second of the media
   duration. If it does not, run `ffsubsync`. If that fails, discard the
   subtitle and try the next candidate.

Every step is a hard check. Do not skip step 5.

## The API most tutorials document is dead

OpenSubtitles' XML-RPC API reached end of life on 2023-12-31. Anything
pointing at `api.opensubtitles.org/xml-rpc` returns nothing. The live API is
REST at `api.opensubtitles.com`:

- Authentication is required on every request. Get an API key from
  `www.opensubtitles.com/en/consumers`.
- The `User-Agent` header must be `APP_NAME vAPP_VERSION` (their exact
  format). A generic `curl/8.4.0` is rejected.
- `POST /api/v1/login` returns a bearer token. Every subsequent call sends
  `Api-Key: <key>` and `Authorization: Bearer <token>`.

If a library or blog post references XML-RPC, it is stale. Do not follow it.

## moviehash: what makes a match usable

The `moviehash` is `file_size + first_64KB + last_64KB` as 64-bit sums. A hash
hit means the subtitle was timed against *that exact file*. A title-and-year
hit means the subtitle was timed against *somebody's* file, probably not
yours.

```python
import struct

def moviehash(path: str) -> str:
    with open(path, "rb") as f:
        size = f.seek(0, 2)
        if size < 131072:
            raise ValueError("file too small for moviehash")
        h = size
        f.seek(0)
        for _ in range(8192):
            h = (h + struct.unpack("<Q", f.read(8))[0]) & 0xFFFFFFFFFFFFFFFF
        f.seek(-65536, 2)
        for _ in range(8192):
            h = (h + struct.unpack("<Q", f.read(8))[0]) & 0xFFFFFFFFFFFFFFFF
    return f"{h:016x}"
```

That algorithm is fixed; do not tweak the offsets. `131072` is `2 * 64 KB`,
the minimum size the hash is defined for.

## Query by hash first, always

```
GET https://api.opensubtitles.com/api/v1/subtitles?moviehash=<hash>&languages=en
Api-Key: <key>
User-Agent: MyApp v1.0
```

A response with `moviehash_match: true` is the only kind you should keep
without verifying sync. Anything else is a candidate, not a match.

## Inspect the container before you download

`ffprobe` tells you three things that decide the whole flow:

- What subtitle tracks are already embedded.
- Whether they are text (`subrip`, `ass`, `mov_text`) or image
  (`hdmv_pgs_subtitle`, `dvd_subtitle`).
- The container, which decides what formats are legal to mux back in.

```
ffprobe -v error -select_streams s -show_entries stream=index,codec_name,codec_type:stream_tags=language -of json input.mkv
```

If a text subtitle in the language you want is already present, extract it:

```
ffmpeg -i input.mkv -map 0:s:0 -c:s copy out.srt
```

That is the whole search. No API call needed.

## Image subtitles are a dead end without OCR

`hdmv_pgs_subtitle` (PGS) and `dvd_subtitle` (VobSub) are bitmap tracks. There
is no `ffmpeg` flag that turns them into text. Options:

- Use OCR (`SubtitleEdit`, `pgsrip`) and accept OCR errors.
- Discard them and search for a text subtitle from the API.

Do not report a PGS extraction to text as complete without an OCR pass and a
spot-check.

## Container decides what you can mux back in

- `.mkv` accepts `SRT`, `ASS`, and `PGS`. Mux without re-encoding.
- `.mp4` only accepts `mov_text`. `SRT` must be converted:
  `ffmpeg -i in.mp4 -i subs.srt -c copy -c:s mov_text out.mp4`
- `.webm` accepts `WebVTT` only.

## Verify sync before you keep the file

The last cue in the subtitle should land within one second of the media
duration. Compute both, compare, act.

```
media=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 in.mkv)
last=$(tail -n 20 subs.srt | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2},[0-9]{3} --> [0-9]{2}:[0-9]{2}:[0-9]{2},[0-9]{3}' | tail -n1 | awk '{print $3}')
```

If the delta is over one second, run `ffsubsync in.mkv -i subs.srt -o
subs.synced.srt`. If it still drifts, discard and try the next candidate.

Never keep a subtitle that failed sync verification because the file "looks
right". The one guarantee this skill offers is: whatever it keeps, plays in
sync.

## YIFY, YTS and other release groups

These are specific encodes with their own frame timings. A subtitle from the
same title and year but a different release group will drift, typically 2 to
15 seconds. When the hash query returns nothing:

- Read the release group from the filename (`Movie.2024.1080p.WEB-DL.YTS.mkv`
  contains `YTS`).
- Prefer subtitles whose `release` field on the API contains that token.
- Still verify sync after downloading. A same-release-group subtitle is a
  strong prior, not a guarantee.

## Common pitfalls

Bad: keep the first result the API returns.

Good: keep only a hash match or a title match that passes the sync check.

Bad: query the XML-RPC endpoint because a Stack Overflow answer said to.

Good: use `api.opensubtitles.com` REST v1, with `Api-Key` and a bearer
token from `/login`, and a `User-Agent` in `APP_NAME vAPP_VERSION` form.

Bad: extract PGS with `ffmpeg -c:s copy out.srt` and call it done.

Good: refuse the extraction; either OCR (accepting errors) or search for a
text subtitle.

Bad: mux `SRT` into an `.mp4` with `-c:s copy` and get a silent failure.

Good: convert with `-c:s mov_text`, since `.mp4` does not accept `SRT`.

Bad: trust the release-group heuristic and skip the sync check.

Good: verify last cue vs media duration on every download, without exception.

## When not to use this

- The file is a live stream or a growing recording. `moviehash` needs the
  final size; a growing file's hash changes as it grows.
- The media has no separate audio track (a silent film) and needs closed
  captions describing sounds. Subtitle files are for spoken content.
- You need translations of on-screen text (signs, letters). Those live in
  `ass` typeset tracks and are not what the search returns.

## See also

- `../podcast-production/SKILL.md` for the audio workflow that predates
  captioning.
- `../video-script-writer/SKILL.md` for scripting a video, which produces
  the timing you would otherwise recover from subtitles.
- `../youtube-seo-optimizer/SKILL.md` for captions as an SEO signal on
  YouTube specifically.

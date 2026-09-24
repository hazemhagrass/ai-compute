---
name: site-test
description: "Use when running a repeatable QA pass on a live site. Browser + journey + code, safety-first, kept current with drift."
---

# Site test

A four-part QA pass a person can rerun without a memory of last time. It is not
a Playwright suite, it is a **process**: crawl, click, review, report, with the
guardrails that keep it safe against production and honest as the site changes.

## The four parts, in order

Every run does all four. Skipping one is a finding, not a shortcut.

1. **Prepare.** Read what the site is: sitemap, known routes, roles, the last
   run's report. Decide the base URL (default: production). If any role
   requires sign-in, print the plan and start with roles that do not.
2. **Browser pass.** Load every route in real Chrome. Record status, console
   errors, failed network requests, broken internal links, accessibility
   basics, SEO basics, layout overflow, and a screenshot per page.
3. **Journey pass.** Run named scenarios that click and assert. Every
   assertion checks something specific and observed. "Page loaded" is not a
   pass.
4. **Code pass.** Read the parts of the codebase the browser findings implicate
   and confirm the bug in source. A run without a source-side check has not
   finished.

Each pass writes its own section into a single `report.md`, plus a
`results.json` a next run can diff against.

## Read-only against production. Writes are gated.

- No POST, PUT, PATCH or DELETE reaches the app's own database from any pass.
  The harness records writes it observes; a scenario that would write is
  declared `writes: true` and **skipped by default**.
- `ALLOW_WRITES=1` runs the write scenarios, and only against a staging URL
  passed with `--base=`. Running writes against production requires an
  explicit `--i-know-this-is-prod` flag and prints a banner.
- Migrations, deploys, secret rotations, settings changes: never. This is a
  test, not a change tool.

## Assert something, not "it did not throw"

Bad and good, side by side.

Bad:
```js
await page.goto(url); // pass if no error
```

Good:
```js
await page.goto(url);
expect(await page.h1()).toBe("Pricing");
expect(await page.aria("faq-1", "expanded")).toBe("true");
```

The bad one passes on a blank page, a redirect to `/login`, a hydration error,
a wrong h1 and a broken 200 that renders no content. The good one names what
you expected, and a next run diffs against it.

## Verify clicks. Do not trust them.

- Scroll the element into view, dispatch pointer/mouse events, and
  **`waitFor`** the state you expect the click to produce.
- An element that is `disabled`, absent, or hidden fails the scenario. It does
  not silently no-op.
- If a click needs a network response before its side effect is visible, the
  wait is for the response, not for a timer.

## Catch the hydration-mismatch class of bug

For each route scenario, fetch the raw HTML (no JS) and read the same
date/number/text nodes from the hydrated DOM. A mismatch next to a
`Minified React error #418` in the console is the hydration bug. Playwright
locator assertions do not see this because both sides render "something"; the
whole point is the two somethings disagree.

## Recording, honestly

Recording is a nice-to-have, not a report. If any of these is missing, do not
claim a video:

- `ffmpeg` on `PATH` (or `FFMPEG=` set to a real binary).
- A non-empty `$DISPLAY` pointing at a real X11 session.
- A screen at least as large as `RECORD_SIZE` (default: display size).

Skip and failure states must print `[rec] not recording: <reason>` and record
`recording.status: "skipped"` or `"failed"` with `recording.file: null` in
`results.json`. Only `recording.status: "recorded"` names a file; only then
does `report.md` or the terminal summary mention one. Recording never fails a
run.

## Sign-in for real apps

Modern apps do not have a password field: OAuth, one-time codes, passkeys.
The harness handles this with **persistent per-role browser profiles** and a
real terminal prompt, not a poll.

- Profile directory per role: `PIXELVENT_PROFILE_DIR/<role>` or similar; the
  session survives across runs.
- No session for a role: print an attention banner naming the role, leave the
  window on the login page, and wait at a **readline** on stdin for `Y` or `N`.
- Roles run **sequentially**, not in parallel: a human cannot sign in twice at
  once.
- `guest` runs first, because it needs no sign-in and can validate the
  environment before asking anything of a person.

## Kept current with the site (the whole point)

A test skill that does not track the site rots faster than a broken test. The
harness includes drift checks that fail the run when the site outgrows it:

- **New route in the sitemap** that no scenario touches: reported as
  `drift: uncovered-route`, listed in `report.md`, and either a scenario is
  added or the route is added to `excluded_routes` in the config with a
  reason. A silent drop is not allowed.
- **New role in the app**: appears in the auth event stream or a role selector.
  Must be listed in the config with at least one scenario before the next run
  is called clean.
- **False green**: a scenario passes but its selector matched a fallback (`h1`
  found when `h1.hero-title` was expected). Reported as `drift: false-green`.
- **Uncovered click path**: a recorded interaction (from the video or from the
  page-observer trace) exercises a control no scenario clicks. Reported as
  `drift: coverage-gap`.
- **Test-case matrix drift**: if the project has a `docs/test-cases/*.md`
  matrix (or equivalent), a diff script lists rows not represented in the run
  results, and rows in the results not in the matrix.

Drift checks emit a non-zero exit and a specific reason. They are the
mechanism that keeps the skill honest.

## Safety guardrails, encoded

- Prod is read-only by default. Every write attempt is asserted against and
  reported.
- No destructive shell in scripts: no `rm -rf` outside the run's own
  scratch dir, no `git push`, no package installs at run time.
- Every screenshot and log path is inside the configured `outDir`. The
  harness does not touch the user's home outside that dir.
- Secrets are read from env, never printed, never written to `report.md`.

## Report shape

`report.md`:

- Header: base URL, run started, run finished, duration, exit reason.
- Browser pass table: one row per route, columns `status`, `console`,
  `failed_requests`, `a11y`, `seo`, `overflow`, link to PNG.
- Journey pass table: one row per scenario, columns `role`, `expected`,
  `observed`, `evidence` (screenshot + waitFor target).
- Drift section: any of the five drift kinds, one row per finding.
- Recording line: file path or the skip reason.

`results.json` mirrors the report as structured data: same tables as arrays,
each row keyed on stable ids, drift entries labeled with their kind.

## Two scenarios

Bad:
```
[✔] home page loaded
[✔] pricing page loaded
[✔] contact page loaded
```

Good:
```
[✔] /                h1="Ship faster with Pixelvent"          shot=home.png
[✔] /pricing         stepper $1,800 -> $5,400 on qty=3         shot=pricing.png
[✖] /resources/foo   hydration mismatch on published_at         shot=res-foo.png
                     server="2026-09-01", client="Sep 1, 2026"
```

The bad version passes with a broken site. The good version is what the ticket
was actually about.

## References

- `scripts/crawl.mjs`: the browser pass. Reads sitemap + known routes,
  records per-page evidence, writes report and PNGs.
- `scripts/scenarios.mjs`: the journey pass. Reads a `site-test.config.json`
  with roles and scenarios; asserts and reports.
- `scripts/drift-check.mjs`: compares this run against the last one and the
  live site's sitemap, emits the drift section.
- `references/config.md`: the config file schema, one field at a time.

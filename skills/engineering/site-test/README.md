# Site Test

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A repeatable QA pass a person can rerun without a memory of last time: crawl
the site in real Chrome, run named journeys, review the code the findings
implicate, and report. Includes a drift check that fails the run when the site
outgrows the tests.

## What it does

Four passes on every run, in order:

1. **Prepare.** Reads the config, the sitemap, and (if present) the last run's
   results.
2. **Browser pass.** Loads every route in headless Chrome. Records HTTP
   status, console errors, failed network requests, broken internal links,
   accessibility basics, SEO basics, layout overflow, and one screenshot per
   route.
3. **Journey pass.** Runs named scenarios that click and assert. Every
   assertion checks something specific; "page loaded" is not a pass.
4. **Code pass.** Reads the parts of the codebase the findings implicate and
   confirms the bug in source. A run without a source-side check has not
   finished.

## When to use this

- A staging or production site that has more than one route and at least one
  auth flow.
- Regression coverage that needs to hold across deploys, framework changes,
  and content edits.
- QA that the same person can rerun in three months without notes.

Do not use it for:

- A single-page prototype with no routes and no journeys. Overkill.
- A public API with no browser surface. Use an API test framework.
- A destructive change (migration, deploy, secret rotation). This is a test,
  not a change tool.

## Quick start

```
project/
  site-test.config.json      # per-site config
  .site-test/                # run outputs (gitignored)
    2026-09-25_1200/
      crawl-report.json
      scenarios.json
      drift.json
      report.md
      *.png
```

Run the browser pass:

```
node ~/.hermes/skills/engineering/site-test/scripts/crawl.mjs \
  https://example.com .site-test/latest \
  --config=site-test.config.json
```

Run the drift check after both the browser and journey passes:

```
node ~/.hermes/skills/engineering/site-test/scripts/drift-check.mjs \
  .site-test/latest \
  --config=site-test.config.json \
  --last=.site-test/previous/scenarios.json
```

The scripts exit non-zero on real findings, zero on a clean run.

## Key concepts

**Read-only against prod.** Writes are gated by `ALLOW_WRITES=1` and a
`--base=<staging>` flag. Running writes against production requires an
explicit `--i-know-this-is-prod`.

**Assert something.** A scenario says what it expected (`h1="Pricing"`,
`data-price="$5,400"`). A pass reports the observed value; a fail reports both
sides. The generic "did not throw" is not a pass.

**Drift is a failure.** A new route with no scenario, a new role with no
config entry, a scenario that matched a fallback selector, an interaction with
no assertion: each is one of five drift kinds, each exits non-zero.

**Recording is honest.** No `ffmpeg`, no display, or a too-small screen skips
recording with a printed reason. Only a real recording is named in the
report.

## Common pitfalls

- **False greens from fallback selectors.** A scenario says `h1.hero-title`,
  the site renames it, the fallback `h1` still matches. The drift check
  reports this. Fix: use `data-*` attributes on the site, or role selectors.
- **Journeys that only navigate.** A `goto` and no assertion passes on a
  blank page. Every step in the journey pass ends in an `assert` step or
  fails.
- **Auth loops in headless.** Passkey and OAuth do not work in the same
  headless profile every run. The harness runs journeys **headful** and
  waits at a readline for sign-in the first time.
- **Recording claims that fail silently.** `ffmpeg` missing is a common
  reason. The harness declares this and prints the reason next to the
  scenario report; the report file never falsely claims a video.

## Kept current with the site

The drift check is the mechanism. On every run it compares:

- The routes in the sitemap against the routes any scenario touches.
- The roles observed at auth time against the roles listed in the config.
- The selectors named by assertions against the selectors that actually
  matched.
- The recorded interactions against the assertions.
- The current results against the previous run's results.

Any mismatch is a finding. The skill stays honest because the check fails the
build.

## See also

- `../debugging/SKILL.md` for turning a browser finding into a root cause.
- `../code-review/SKILL.md` for the source-side pass after a bug is confirmed.
- `../../security/security-audit/SKILL.md` for the write-path scenarios.

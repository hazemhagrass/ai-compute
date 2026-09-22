---
name: interactive-web-resume
description: "Use when shipping a resume as a web page. Build one semantic, fast, printable page whose printed PDF and web version never drift apart."
---

# Interactive Web Resume

A web resume has exactly one advantage over a PDF: it is a link. Always current,
crawlable, shareable in one tap, inspectable by anyone without downloading
anything. Every other property is a way to squander that. This skill owns the
page itself: markup, print styles, performance, metadata, structured data,
publishing, and what not to build. For bullet wording and ATS text extraction,
see `../latex-resume`; for case-study writing around the page, see
`../portfolio-website-builder`; for contrast ratios, target sizes, focus rules,
and ARIA, see `../../design/accessibility-audit`, which this skill depends on
but does not restate.

## Serve both readers with one document

A resume page is read twice: by a parser that wants a stable outline of a
person and their jobs, and by a screen reader or a hiring manager who wants the
same thing in a different form. Semantic HTML serves both at once, because the
machine-readable meaning and the assistive-technology tree are the same tree.

- One `<h1>` holding your name is simultaneously the document title for a
  screen reader's heading list, the anchor a recruiter skims, and the hook a
  structured-data extractor looks for.
- `<time datetime="2021-03">March 2021</time>` gives the display string to
  humans and an unambiguous ISO value to scrapers, so "Spring '21" never
  parses as 1901.
- Landmarks (`<header>`, `<main>`, `<footer>`) and headings let keyboard and
  screen reader users navigate a long resume rather than page through it.

```html
<!-- BAD: div soup, no machine-readable dates or roles -->
<div class="job"><div class="title">Senior Engineer</div>
<div class="where">Acme</div><div class="when">Mar 2021 - Present</div></div>

<!-- GOOD: the same markup a resume parser, a screen reader, and a human want -->
<article class="role">
  <h2>Senior Engineer, Acme</h2>
  <p><time datetime="2021-03">March 2021</time>
     <span aria-label="to">to</span> present</p>
  <ul>...</ul>
</article>
```

Structure like this, plus `schema.org` JSON-LD of type `Person` with an
`alumniOf`-style history array of `OrganizationRole` entries (name, jobTitle,
startDate, endDate, description), lets crawlers and knowledge-graph consumers
pull your work history without a custom in-page microdata layer. Validate the
JSON-LD with the [rich results tester], and keep it generated from the same
content that renders the page so it cannot disagree with what's visible.

## Print is still the deliverable

The hiring manager will want a file. Some will never open your link without
one. So treat "print this page to PDF" as a first-class output, not an
afterthought, and make it excellent: it is the simplest path to a PDF that can
never drift from the web version, because it is the web version.

- `@media print { nav, .no-print { display: none; } }` removes navigation
  chrome, theme toggles, "download" widgets, and footers with social links.
- `break-inside: avoid` on `.role`, `section`, `li`, and tables keeps a job
  title's bullets from splitting across pages; `break-after: avoid` keeps a
  heading orphaned from its content.
- Expand link URLs in print with an `::after` rule reading the `href`
  attribute, or a printed "LinkedIn" anchor becomes the word "LinkedIn".
- Set `color-adjust: exact` (with the `-webkit-` prefix) if you keep any
  non-black color, and force light colors regardless of dark mode.
- Set printable margins with `@page { size: letter; margin: 12mm; }`, and
  choose one or two printed pages deliberately; long web pages print long.
- Disable fixed/sticky elements and set position static so headers do not
  repeat on every page over your content.
- Shade backgrounds with a plain border or background color that prints even
  when the user does not check "background graphics", because most will not.
- Provide a visible "Print / Save as PDF" button wired to
  `window.print()` (see below) but never make it the only path; Ctrl+P should
  just work, and it only does if the print stylesheet is complete.
- Offer a real downloadable PDF from the same source (below) so Ctrl+P is the
  fallback, not the requirement.

```css
/* Print: hide chrome, expand links, keep jobs intact, force light ink. */
@media print {
  nav, button, footer, .no-print { display: none; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; }
  .role, section { break-inside: avoid; }
  h1, h2 { break-after: avoid; }
  * {
    background: #fff !important;
    color: #111 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  @page { size: letter; margin: 12mm; }
}
```

Verify the print path by actually printing: Ctrl+P in Chrome, Save as PDF, and
open the result. Check that the first page has name and contact, every job
title is adjacent to its dates, no page starts mid-bullet, and no link just
says "here". If you want to diff the raw text a PDF parser will see, run the
saved PDF through `pdftotext -raw` the same way
`../latex-resume` recommends.

## Keep web and PDF from drifting

Two sources of truth is the third source of truth. Pick one build path:

- **Preferred: print stylesheet IS the PDF pipeline.** Link the page and say
  "print this page to PDF". Zero build, zero drift, always current. This is
  the correct default for people who are not being evaluated on document
  polish.
- **If you must ship a PDF file** (recruiters, aggregators, systems that
  reject links), generate it from the same HTML at publish time in CI:
  headless Chromium `--headless --print-to-pdf=resume.pdf index.html` runs the
  same stylesheet above on the same DOM. Commit neither file; build both
  together so a typo fix in the page appears in the PDF on the next deploy.
- Never hand-maintain a separate `.docx`, `.tex`, or Canva copy "for a nicer
  PDF". Inevitably it ships with last quarter's dates and the web one is
  silently wrong.

```bash
# in CI or a Makefile, so web and PDF are built from one source
chromium --headless --print-to-pdf=$PWD/dist/resume.pdf \
         --no-margins file://$PWD/dist/index.html
```

## Performance is a credibility signal

A slow page is self-refuting for anyone whose resume says "frontend engineer"
or "performance". The page loads in one competitive scan window before a
decision is formed, and it may load over slow mobile hotel wifi on a phone.

- One HTML file, one small stylesheet, zero to one script. A resume is text;
  15 KB gzip is achievable and should be the target.
- No web fonts, or one self-hosted `woff2` subset with `font-display: swap`
  and a system-font stack as the pre-swap face.
- Ship only what parse needs: no framework runtime, no SPA shell, no
  client-side router for three pages of content. Static HTML, generated by
  whatever you like at build time, is not just faster here, it is the only
  shape where parsers see content without running JavaScript.
- Target comfortable budgets. A resume at or under 30 KB total gzip,
  render-blocking resources count of zero, and an in-plugin-measured LCP
  under a second on throttled mobile is where "frontend engineer" stops
  contradicting itself.
- Name gzip/brotli compression and long-lived `Cache-Control` at the host, so
  returning visitors do not re-download anything.
- Do not prove skill with the resume; prove it with the numbers. A page that
  measures at 60 KB of First-Load JS "to show off skills" is a resume that
  argues against its own resume.
- Run Lighthouse (or `@lhci/cli` locally, or PageSpeed Insights) as part of
  publishing, not as a one-time badge on the page. Numbers in the audit, not
  in the footer.

```bash
# measure, don't guess
lhci autorun --collect.staticDistDir=. --assert.preset=lighthouse:recommended \
  2>&1 | tail -20
```

## Metadata that makes the link look right when shared

The link is the product; what it looks like in a text message, an ATS "saw your
portfolio" notification, a LinkedIn DM, or a Slack channel is part of the
application. OG and Twitter meta decide that image card, so fill them in.

```html
<meta property="og:title" content="Pat Lee, Senior Frontend Engineer">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://patlee.dev/">
<meta property="og:description" content="Resume and selected work.">
<meta property="og:image" content="https://patlee.dev/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://patlee.dev/">
```

- Provide a real `og:image` (1200x630 or nearest) if you share the link into
  preview-rendering surfaces; without it, clients show a broken box or grab
  garbage.
- Host pre-rendered static HTML so the crawler sees the name in the first
  HTML bytes and the meta is present before JavaScript, if any, runs.

## Own the URL

- Buy the domain and deploy to it. `patlee.dev` is the resume's address and
  email-adjacent identity. A GitHub Pages subdomain works at first but reads
  as borrowed, and if you ever move the repo you break the link in every
  published copy.
- One canonical path, `/`. Redirect `www.` to apex (or vice versa) with one
  301. Never serve the same content at both without redirecting.
- Never use hash fragments (`/#/experience`, `/#/work`), per-page slug
  variants (`/resume-2025-final2.html`) that rot, or query params
  (`?theme=dark`) in links you publish. `/resume` or nothing.
- Avoid long-lived short links or third-party re-pointers around your own
  resume URL. If you leave a stat-tracker `utm_` on it, you have handed every
  recipient a different URL and broken your own analytics.

## Publish contact details without handing out an address

Contact info must surface in plain text for parsers and yet is a scraping
vector for street addresses, which serve no recruiter purpose.

- Put email and phone as plain text; graders, parsers, and hungry humans all
  want to copy it. If you are worried about scrape, rely on the fact that bots
  script the DOM but humans copy the visible string; a full mailto without
  visible text is the worst of both.
- Omit the street address. City and country are enough, and a full address on
  a public page is fishing for identity theft. If your industry still asks
  for a "location", city-level is the convention.
- Do not use the old `email [at] domain` fiction: it fails copy-paste, fails
  parsers, and stops nothing that matters.

## Analytics with restraint

A resume page is a tiny document; treat every tracking pixel as overhead and a
privacy statement you did not write.

- Prefer server logs, or a self-hosted privacy-first counter (Plausible,
  Umami, GoatCounter), over heavyweight commercial analytics on a one-page
  site. No cookies means no banner.
- Do not put the tracker's script on a resume you also load in a headless PDF
  pipeline; it will fire on every build and pollute your numbers.
- Never gate "who viewed this" in front of the reader; the visitor came for a
  resume, not a consent negotiation, and a cookie wall on a resume is a
  self-inflicted Level A failure and a credibility hit too.

## Keyboard, focus, and reduced boundaries

Accessibility rules (contrast ratios, target size, focus behaviour) live in
`../../design/accessibility-audit`; the resume-specific ones are:

- A resume's only genuine affordances are the contact links, the print
  button, and optionally a theme toggle. Tab from top and confirm a visible
  focus ring reaches each.
- Resumes are often read under office fluorescents and on printouts; pick a
  body background and text that survive both, not a dark-theme brand color
  that fails on paper (and handle the paper case in the print block, above).
- Honour `prefers-reduced-motion` if any transition exists. (See the audit's
  example block for the exact snippet.)

## Dark mode via prefers-color-scheme

A resume that ships pure white might blind a reader at night and a resume
forced to dark may render as a black rectangle on a printout. The right
default is to inherit the OS theme and never force anything.

```css
/* Theme: follow the OS, switch nothing, keep print light. */
:root { color-scheme: light dark; }
body { background: #faf9f7; color: #1a1a1a; }
@media (prefers-color-scheme: dark) {
  body { background: #1a1a1a; color: #f0f0f0; }
  a { color: #9bc2ff; }
}
@media print {
  * { background: #fff !important; color: #111 !important; }
}
```


## What NOT to build

Every one of these has shipped on someone's portfolio and cost a callback.

- **Scroll-jacking or parallax on a resume.** The reader came for facts and
  has 30 seconds; stealing their scroll to perform "craft" is the fastest
  possible first impression against.
- **Animation, a landing hero, or a music/video intro before the resume
  body.** Content must be in the first viewport-hour and in the HTML.
- **An SPA shell that renders an empty `<div id="root">` and needs
  JavaScript.** Parsers, crawlers, and browsers with JS off (and aggressive
  corporate proxies) see nothing.
- **A loading spinner before the resume.** The resume must be in the first
  painted HTML, generated server-side or plain static.
- **Non-semantic layout (ascii-art flex boxes, SVG `<text>` for headings,
  canvas).** Everything invisible to selection, translation, screen readers,
  and parsers. See `../latex-resume` for the machine-readable-by-construction
  discipline on the text layer.
- **A resume behind a login or an email gate.** The whole advantage is that
  the link is open; a "sign up to see full resume" wall squanders it.

## Checklist

- Markup: one `<h1>`, real `<time>`, landmarks, semantic jobs `<article>`.
- Print: `@media print` hides chrome, avoids page splits, expands URLs,
  forces light ink and correct `@page` size and margins.
- Pipeline: printed PDF and any committed PDF both come from this HTML.
- Performance: offline-friendly static HTML under 30 KB gzip, zero scripts
  unless justified, Lighthouse run before publish.
- Meta: og/twitter meta, canonical link, schema.org Person JSON-LD.
- Publishing: custom domain, one canonical URL, clean slugs, no rot links.
- Contact: plain text email/phone, no street address, no obfuscation.
- Analytics: minimal, privacy-first, no cookies, no session tracking.
- Accessibility: contrast and focus per
  `../../design/accessibility-audit`; tab through the contact links by hand.

[rich results tester]: https://search.google.com/test/rich-results

# Interactive Web Resume

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="interactive-web-resume robot" width="200">
</div>

Ship a resume as one semantic, fast, printable HTML page whose PDF and web versions never drift.

## What it does

Defines how to turn a resume into a single static web page: semantic HTML that
serves screen readers and resume parsers at the same time, a print stylesheet
that turns browser Ctrl+P into a clean one-or-two-page PDF, a build path that
keeps the downloadable PDF generated from that same HTML, performance budgets
that keep a "frontend engineer" claim credible, Open Graph and schema.org
metadata so the shared link renders properly, custom-domain publishing with
stable URLs, privacy-respecting contact details, and a list of anti-patterns
(scroll-jacking, JS-gated content, SPA shells) that regularly cost candidates
interviews.

## When to use this

- You are building or refreshing a personal resume site and want one page that
  a recruiter can read, a parser can extract, and Ctrl+P turns into a clean PDF.
- You currently maintain a web resume and a separate PDF and have already seen
  them disagree about dates.
- You are evaluating a portfolio page and want a concrete checklist for what a
  resume link must do and must not do.

For bullet wording, ATS text extraction, and LaTeX layout, see
`../latex-resume`. For case-study writing and portfolio structure beyond the
resume itself, see `../portfolio-website-builder`. For a design-led resume
layout, see `../creative-resume-design`.

## Quick start

A complete minimal resume page, plus the print stylesheet that turns it into a
clean PDF. Save as `index.html`; the whole file is static, needs no
JavaScript, and prints as a proper resume with the print button or Ctrl+P.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pat Lee, Senior Frontend Engineer</title>
<meta name="description" content="Resume and selected work of Pat Lee.">
<link rel="canonical" href="https://patlee.dev/">
<meta property="og:title" content="Pat Lee, Senior Frontend Engineer">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://patlee.dev/">
<meta property="og:description" content="Resume and selected work.">
<meta property="og:image" content="https://patlee.dev/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>
  :root { color-scheme: light dark; }
  body {
    font: 1rem/1.5 system-ui, sans-serif;
    max-width: 46rem; margin: 0 auto; padding: 1.5rem;
    background: #faf9f7; color: #1a1a1a;
  }
  a { color: #0b5fff; }
  :focus-visible { outline: 3px solid #0b5fff; outline-offset: 2px; }
  .role { margin-bottom: 1.25rem; }
  .role h2 { margin: 0; }
  .role p  { margin: 0.15rem 0 0.4rem; color: #555; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #f0f0f0; }
    .role p { color: #b5b5b5; }
    a { color: #9bc2ff; }
  }
  @media print {
    nav, button, .no-print { display: none; }
    a[href^="http"]::after { content: " (" attr(href) ")"; }
    .role, section { break-inside: avoid; }
    h1, h2 { break-after: avoid; }
    * {
      background: #fff !important; color: #111 !important;
      print-color-adjust: exact; -webkit-print-color-adjust: exact;
    }
    @page { size: letter; margin: 12mm; }
  }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Pat Lee",
  "jobTitle": "Senior Frontend Engineer",
  "email": "mailto:pat@patlee.dev",
  "url": "https://patlee.dev/",
  "worksFor": { "@type": "Organization", "name": "Acme" }
}
</script>
</head>
<body>
<header>
  <h1>Pat Lee</h1>
  <p>
    Senior Frontend Engineer. Berlin, DE.
    <a href="mailto:pat@patlee.dev">pat@patlee.dev</a>.
    <a href="https://github.com/patlee">github.com/patlee</a>.
  </p>
</header>
<main>
  <section aria-labelledby="experience">
    <h2 id="experience">Experience</h2>
    <article class="role">
      <h2>Senior Engineer, Acme</h2>
      <p><time datetime="2021-03">March 2021</time> to present</p>
      <ul>
        <li>Cut p95 checkout latency from 1.9s to 640ms by batching queries.</li>
        <li>Led the accessibility overhaul of the settings app to WCAG AA.</li>
      </ul>
    </article>
    <article class="role">
      <h2>Engineer, Globex</h2>
      <p><time datetime="2018-06">June 2018</time>
         to <time datetime="2021-02">February 2021</time></p>
      <ul>
        <li>Shipped the design system adopted by six product teams.</li>
      </ul>
    </article>
  </section>
</main>
<nav class="no-print" aria-label="Page actions">
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
</nav>
</body>
</html>
```

Then verify the PDF path the same way you verify the web page:

```bash
# what a hiring manager gets from Ctrl+P, built from the same HTML
chromium --headless --print-to-pdf=resume.pdf file://$PWD/index.html
pdftotext -raw resume.pdf - | head -20   # confirm name, email, dates survive
```

## Key concepts

- **One source of truth.** The PDF is the web page printed, either by the
  reader in the browser (always current, zero maintenance) or by you in CI
  with headless Chromium running the same stylesheet. A separately maintained
  `.docx` or Canva copy is how dates drift.
- **Semantic markup is the parser interface.** `<h1>` for your name,
  `<article>` per job, `<time datetime>` for dates, one `<main>`. The same
  tree that a screen reader walks is the tree an extractor reads, so nothing
  needs to be duplicated for the machine.
- **Print CSS is a first-class stylesheet.** Hide navigation and buttons, use
  `break-inside: avoid` on jobs and `break-after: avoid` on headings, expand
  external link URLs with `::after` and `attr(href)`, force light ink, and
  set `@page` size and margins.
- **Performance as credibility.** Static HTML, one small stylesheet, zero or
  one script, roughly 30 KB total gzip. A slow page undercuts a frontend
  claim faster than any typo.
- **Share-ready metadata.** Open Graph and Twitter card meta, one canonical
  URL on your own domain, no hash routes or rot-prone slugs.
- **Structured data.** A `schema.org` `Person` JSON-LD block generated from
  the same content so it cannot disagree with the visible page.
- **Theme from the OS.** Honor `prefers-color-scheme` and force paper ink in
  print; no theme toggle is required and no dark page survives Ctrl+P.
- **Restraint.** No cookies, no session replay, no street address, no obfuscated
  email.

## Common pitfalls

- **BAD: an SPA shell rendering an empty `<div id="root">`.** Parsers, crawlers, and JS-off browsers (and some corporate proxies) see nothing at all.
  **GOOD:** static HTML with the resume in the first bytes; generate HTML at build time if you like a framework, but never ship an empty shell.

- **BAD: a separate Word or LaTeX copy "for the real PDF".** It ships with last quarter's dates and the web version silently rots.
  **GOOD:** print-to-PDF from the same page, or generate the PDF in CI with headless Chromium from the identical HTML.

- **BAD: a print stylesheet that only hides ads.** Job title on page one, its bullets on page two; "LinkedIn" printed as the word LinkedIn.
  **GOOD:** `break-inside: avoid` on `.role`, `break-after: avoid` on headings, `a[href^="http"]::after { content: " (" attr(href) ")" }`, forced light ink.

- **BAD: a 90 KB client bundle "to show off skills".** Self-refuting for anyone claiming frontend competence.
  **GOOD:** under 30 KB gzip of static HTML and one stylesheet; measure with Lighthouse before publishing.

- **BAD: a full street address in the `<footer>`.** A public page plus a home address is a scraping and identity-theft vector with zero recruiter value.
  **GOOD:** city and country; email and phone as plain copyable text.

- **BAD: `email [at] domain [dot] com`.** Breaks copy-paste, breaks parsers, and stops no meaningful fraction of scrapers.
  **GOOD:** `<a href="mailto:pat@patlee.dev">pat@patlee.dev</a>`.

- **BAD: rolling analytics with cookies on a one-page resume.** Fires a consent wall at the one visitor who matters.
  **GOOD:** server access logs or a self-hosted cookieless counter, or nothing.

- **BAD: theme toggle at the top of the DOM forcing dark.** Prints as a black rectangle on paper and adds a control readers never asked for.
  **GOOD:** `:root { color-scheme: light dark; }` plus one `prefers-color-scheme` block, and the print block forces light ink regardless.

## See also

- [latex-resume](../latex-resume/SKILL.md) - bullet wording, ATS extraction, single-column rules, and the reproducible PDF pipeline.
- [portfolio-website-builder](../portfolio-website-builder/SKILL.md) - case-study writing and portfolio structure beyond the resume page itself.
- [creative-resume-design](../creative-resume-design/SKILL.md) - visual design for resume and portfolio pages.
- [accessibility-audit](../../design/accessibility-audit/SKILL.md) - WCAG contrast ratios, target sizes, focus, and ARIA rules this skill depends on.
- [frontend-architecture](../../engineering/frontend-architecture/SKILL.md) - React/Next.js structure rules if the rest of your portfolio is an app.
- 
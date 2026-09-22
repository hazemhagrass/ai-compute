# Portfolio Website Builder

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="portfolio-website-builder robot" width="200">
</div>

A skill for building a portfolio site engineered for a single job: making a
hiring manager want to talk to you.

## What it does

Treats the portfolio as a hiring artifact rather than a gallery. It defines the
case study as the core unit (problem, constraints, work, decisions, outcome,
reflection), shows how a weak project card becomes a strong case study with a
full worked rewrite, and covers contact, About, resume, performance as a
credibility claim, meta preview cards, domains and boring hosting, NDA
sanitisation, accessibility, minimal analytics, and freshness.

## When to use this

- Building a personal portfolio site from scratch, or rebuilding one that gets
  no responses.
- Deciding which projects to feature and how to write them up.
- Reviewing an existing portfolio before a job search to find what is costing
  you interviews.

## Quick start

Rewrite one project card into a case study. Start from the weak card you
probably have:

```text
Data Dashboard

Built with React, TypeScript, Vite and Recharts. A fully responsive dashboard
with dark mode and smooth animations.

[screenshot] [Live Demo] [GitHub]
```

Turn it into six short sections, in this order:

```markdown
**Cutting triage time from 40 minutes to 6 for a 30 person support team**

*Role: sole frontend engineer. Nine weeks. Internal tool, about 30 daily users.*

1. **Problem.** Agents triaged failed orders across three systems by hand.
   Median resolution took 40 minutes and nothing recorded why orders failed.

2. **Constraints.** The warehouse tool exposed only a nightly CSV, so
   fulfilment data was up to 24 hours stale. Locked down laptops pinned to an
   older Chromium build. Nine weeks before the seasonal peak.

3. **What you did.** One queue view joining the three sources into a row per
   order, resolution inline, a required reason code, a thin read API.

4. **What you decided and why.** Timestamped stale fulfilment data instead of
   building a live scraper; server rendered the table with filters in query
   parameters so agents can share URLs; made reason codes required over the
   team's objection: six weeks of data traced 38 percent of failures to one
   address validation bug.

5. **Outcome.** Median triage time fell from 40 minutes to 6, measured from the
   reason code timestamps against a manual sample taken before rollout.

6. **What you would do differently.** I built the UI before watching anyone
   work. Two filters were never used; what agents wanted was saved views, which
   I retrofitted awkwardly in week eight.
```

The rewrite carries a rejected alternative, a disagreement won on evidence, a
measured outcome with its source named, and a mistake: that is what separates a
portfolio from a gallery.

## Key concepts

- **One job.** The site exists to produce a scheduled conversation. Anything
  that does not serve that (tech stack showpieces, stale blogs, skill bars) is
  cut.
- **The case study.** The core unit: problem, constraints, what you did, what
  you decided and why, outcome, and what you would do differently. Six parts;
  skipping decisions turns it back into a gallery.
- **Curation.** Three to five strong pieces. Readers sample, not average, and
  the weakest piece on the page is what they remember.
- **Actionability.** A real email address in the header and footer of every
  page, a downloadable resume PDF, and About content a recruiter can quote.
- **Credibility of the medium.** A slow or inaccessible site refutes the claim
  on it; measure the deployed URL before you send anyone there.
- **Findability.** Per page titles, descriptions, and 1200x630 `og:image` cards
  so a shared link unfurls correctly, on a custom domain, on dull static
  hosting.

## Common pitfalls

- Bad: twelve project cards with screenshots and adjectives. Good: three to
  five case studies, each naming a decision. Reason: readers sample, not
  average, and only decisions reveal the judgement being hired.
- Bad: contact form as the only route. Good: email in header and footer, form
  as an addition. Reason: forms break silently, land in spam, and leave the
  sender no record of what they sent.
- Bad: shipping the framework you want to learn. Good: mostly static HTML and
  CSS. Reason: a portfolio advertises taste and speed, and a megabyte of
  JavaScript for a text page is a visible defect.
- Bad: absolute invented numbers. Good: only figures you could defend in an
  interview. Reason: one unravelled claim discredits the whole site.
- Bad: hiding NDA work entirely. Good: sanitised case studies, permission, and
  "further detail under NDA, happy to discuss in an interview". Reason: the
  strongest work is often unpublishable, and a described problem still shows
  judgement.
- Bad: adding session recording to see who visits. Good: cookieless page
  view counts at most. Reason: trackers on a page whose readers are strangers
  doing you a favour, and they slow the page doing it.

## See also

- [`latex-resume`](../latex-resume/README.md) for the downloadable resume PDF.
- [`accessibility-audit`](../../design/accessibility-audit/README.md) for the
  accessibility pass the portfolio must survive.
- [`performance-profiling`](../../engineering/performance-profiling/README.md)
  for producing the performance numbers a case study cites.
- [`readme-generator`](../../meta/readme-generator/README.md) if the portfolio
  site documents code repositories.

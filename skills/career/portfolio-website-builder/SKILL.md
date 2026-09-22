---
name: portfolio-website-builder
description: "Use when building a portfolio site to get hired. Structure it around case studies with decisions and outcomes rather than a screenshot gallery."
---

# Portfolio Website Builder

A portfolio has exactly one job: make a hiring manager want to schedule a
conversation. Every other goal (showing off the stack, exercising a new
framework, collecting design awards) is a hobby you are allowed to have
somewhere else. The reader is a person with a stack of candidates and a few
minutes each, looking for evidence that you can be handed an ambiguous problem
and return something that worked. A grid of screenshots does not contain that
evidence. A case study does.

## Structure the site around the hiring decision

The reader arrives with three questions in this order: what does this person
do, can they show me a piece of real work, and how do I reach them. Build the
page order to answer them in that order. Put a one line identity statement
above the fold naming the role and the specialism, so the reader never has to
infer what you do from your projects, and lead with the work rather than the
biography. Use four surfaces and stop: home with featured pieces, one page per
case study, an About page, and a contact route visible everywhere. Cut anything
that exists because the framework made it easy, since a blog with two stale
posts, a skills bar chart, a testimonial slider, and a hero animation all cost
load time and buy nothing.

```text
Bad:  Hero animation / "Hi, I'm Pat!" / skill percentage bars /
      12 project cards / blog (2 posts, 3 years stale) / contact form only

Good: "Pat Lee, frontend engineer. Design systems and performance work." /
      3 featured case studies, one outcome line each /
      About / Resume (PDF) / pat@patlee.dev in the header and the footer
```

## Make the case study the unit of work

A case study is a short argument that you made good decisions under real
constraints. Six parts, in this order, roughly 400 to 800 words:

1. **Problem.** What was broken or missing, and who was hurt by it.
2. **Constraints.** Deadline, team size, legacy system, budget, browser floor.
   Constraints are what make the decisions interesting.
3. **What you did.** Your work specifically, not the team's.
4. **What you decided and why.** The options considered and the one rejected.
5. **Outcome.** A measured change where you have one, scope where you do not.
6. **What you would do differently.** Judgement, shown.

Skipping part 4 turns a case study back into a gallery; skipping part 6 makes
the whole page read as marketing.

## Worked example: a weak project card rewritten

This is the highest leverage change most portfolios can make. Here is a typical
card, exactly as it usually appears:

```text
E-Commerce Admin Dashboard

Built with React, TypeScript, Tailwind CSS, Redux Toolkit, Vite, Recharts and
Framer Motion. A fully responsive, pixel perfect admin dashboard featuring
dark mode, smooth animations and a modern UI.

[screenshot] [screenshot] [screenshot]      [Live Demo]  [GitHub]
```

Everything in it is a tool name, an adjective, or a picture. It says nothing
what was hard, what you chose, or whether it worked, and nine other candidates
submitted the same card. Here is that project as a case study.

---

**Cutting order triage from 40 minutes to 6 for a 30 person support team**

*Role: sole frontend engineer. Nine weeks. Internal tool, about 30 daily users.*

**Problem.** Support agents triaged failed orders by hand across three systems:
the order record in the admin panel, the payment status in Stripe, and the
fulfilment state in a warehouse tool with no API. Median time to resolve one
failed order was 40 minutes, the queue grew faster than the team cleared it
during sale weeks, and nobody could say which failure reason was most common
because nothing recorded the reason.

**Constraints.** The warehouse system exposed only a nightly CSV drop, so
fulfilment state was up to 24 hours stale and could not be made live. Agents
worked on locked down laptops pinned to an older Chromium build, ruling out the
newest CSS features. I had nine weeks before the seasonal peak, and no backend
engineer for the first five of them.

**What I did.** Built a single queue view that joined the three sources into
one row per failed order, with the resolution action inline so an agent never
left the page. Added a required reason code on every resolution, which is where
the missing data came from. Wrote a thin read API over the existing admin
database and a nightly import for the CSV.

**What I decided and why.**

- *Staleness shown, not hidden.* Fulfilment data was up to 24 hours old, so
  instead of presenting it as current I timestamped every fulfilment cell with
  its import time and greyed rows older than 18 hours. The alternative was a
  live scraper against the warehouse UI, which I rejected because it would have
  broken silently on their next release and taught agents to trust a number
  that was sometimes wrong.
- *Server rendered table, no client state library.* The queue is read heavy and
  refreshes on action. I rendered it server side and kept per row state in
  query parameters, so a shared URL reproduces a filtered queue exactly. Agents
  paste those URLs into tickets constantly, which nobody wrote down as a
  requirement and which mattered more than the filters themselves.
- *Reason codes made required, over the team's objection.* Making a field
  mandatory costs agents seconds per resolution and I was asked to make it
  optional. I argued for required on the grounds that an optional field would
  be filled in only on unusual cases, giving a biased sample. Six weeks of
  complete data showed 38 percent of failures traced to one address validation
  bug, which the backend team then fixed. An optional field would have hidden it.
- *Rejected: a real time websocket queue.* It demoed well and solved nothing,
  because the bottleneck was cross system lookup, not staleness of the order
  record. I kept a 30 second poll.

**Outcome.** Median triage time fell from 40 minutes to 6 over the first month
after rollout, measured from the reason code timestamps against the previous
manual sample the support lead had collected. The reason code data drove the
address validation fix, which removed about a third of the incoming volume. The
tool is still in daily use by the support team.

**What I would do differently.** I built the filter UI before watching anyone
work. Two of the five filters were never used, and the thing agents actually
wanted was a saved view per shift, which I retrofitted awkwardly in week eight.
I would now spend the first two days sitting with agents and build nothing.

---

The rewrite names no framework in the body; a reader who cares finds the stack
in a one line footer. What it carries is a rejected alternative with a reason,
a disagreement won on evidence, a measured outcome with its source named, and a
mistake you can discuss.

## Show tradeoffs, and show only your best three to five

Anyone can produce a working screen. What is being hired for is judgement under
constraint, visible only at the fork in the road.

- **Name the option you rejected and why**, since a decision with no rejected
  alternative was not a decision, and state the cost you accepted. Every real
  choice has one, and a page with no costs on it reads as fiction.
- **Attribute honestly.** "I built" for your work, "the team shipped" for
  theirs. An interviewer will probe a vague "we" and the answer will be worse
  than the truth. Cite a number only when you could name the dashboard, query,
  or log behind it, because one unravelled claim discredits the entire site.
- **Keep three to five pieces, never twelve.** A reader does not average your
  work, they sample it, so the weakest piece on the page is what they remember.
  Below three looks thin, above five dilutes. Delete tutorial output, clones,
  and course projects once you have real work: a to do app says only that you
  followed instructions, and one written case study beats five stubs.

## Contact, About, and resume

The commonest failure is a reader who is convinced and then cannot act.

- **Put a real email address in the header and the footer of every page.** Not
  an image, not a contact form as the only route. Keep any form as an addition:
  forms break silently, land in spam, and leave the sender no record. Say what
  you are looking for and where you are, including timezone and work
  authorisation if relevant, so the reader can rule you in or out.
- **Write About as evidence, not personality.** Open with what you work on and
  what you are good at, in two sentences a recruiter could paste into a hiring
  note, then give a reason to trust you specifically: domains worked in, size
  of systems, kinds of problems. One or two lines of outside interest is
  warmth; a paragraph on your coffee is filler.
- **Keep a downloadable resume.** Many readers need a PDF to forward, attach to
  a requisition, or paste into an applicant tracking system. Link it as a plain
  `<a href>` to a real file at a stable URL, not behind a form or a Drive
  preview, and build it with [`latex-resume`](../latex-resume/SKILL.md) so the
  text layer survives parsing.

## Treat performance as a credibility claim

If your site says you do frontend work and takes four seconds to show text, it
has already contradicted the claim. This is where the medium is part of the
argument.

- **Ship mostly HTML and CSS.** A portfolio is a document. Static output from
  any generator loads faster than a client rendered app and cannot break on a
  hydration error. Treat a megabyte of JavaScript for a text page as a defect.
  If you do build it as an app, keep the component and data boundaries sane per
  [`frontend-architecture`](../../engineering/frontend-architecture/SKILL.md).
- **Compress and size images properly.** Case study screenshots are almost
  always the heaviest thing on the page: export at the displayed width, serve
  WebP or AVIF, set `width` and `height` to stop layout shift, and use
  `loading="lazy"` below the fold. Self host fonts or use system fonts, since a
  third party font request blocks text and adds a DNS lookup you do not control.
- **Measure before you claim**, on the deployed URL and not on localhost:

```bash
npx lighthouse https://patlee.dev/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output-path=./lh.json --chrome-flags="--headless"

jq -r '.categories | to_entries[] | "\(.key): \(.value.score * 100)"' lh.json
curl -s -o /dev/null -w 'bytes=%{size_download} time=%{time_total}s\n' https://patlee.dev/
```

For a project whose whole point was a performance story, use
[`performance-profiling`](../../engineering/performance-profiling/SKILL.md) to
produce the numbers you put in the case study.

## Make a shared link look right

Your link gets pasted into Slack, LinkedIn, and email more often than it gets
typed. If the unfurl shows a bare URL and no description, the reader forms an
impression before opening anything.

```html
<title>Pat Lee: frontend engineer, design systems and performance</title>
<meta name="description" content="Case studies in design systems and frontend performance from eight years of product work. Open to senior frontend roles.">
<link rel="canonical" href="https://patlee.dev/">

<meta property="og:type" content="website">
<meta property="og:url" content="https://patlee.dev/">
<meta property="og:title" content="Pat Lee: frontend engineer, design systems and performance">
<meta property="og:description" content="Case studies in design systems and frontend performance.">
<meta property="og:image" content="https://patlee.dev/og/home.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Pat Lee, frontend engineer">
<meta name="twitter:card" content="summary_large_image">
```

- **Give every case study its own title, description, and image.** A shared deep
  link that unfurls with the home page text wastes the strongest impression you
  get. Use an absolute URL for `og:image` at 1200 by 630, because relative
  paths are not resolved by most unfurlers, and test the unfurl in a private
  channel first.

## Buy a domain and use boring hosting

- **Register your own domain** and serve the site from it. A free host subdomain
  is a weaker signal and you lose the URL if the host changes its plans. Keep
  email on the domain if you can, so `pat@patlee.dev` matches the site.
- **Choose hosting that is dull**: static files on a managed host or object
  storage behind a CDN, deployed from a git push, with HTTPS you do not manage.
  Do not self host on a VPS you maintain: the failure mode is an expired
  certificate the week a recruiter visits, and nobody has ever been hired for
  their nginx config. Keep the build reproducible from the repository, so you
  can ship a fix a year from now without rediscovering the toolchain.

## Handle NDA work honestly

Most of the strongest work is unpublishable. The answer is sanitisation, not
silence and not a leak.

- **Ask first.** Many employers will approve a described case study, especially
  one with no numbers and no screenshots. Get the answer in writing.
- **Describe the problem shape, not the client.** "A logistics company with
  about 400 depots" carries the difficulty without identifying anyone. Replace
  real figures with ratios or direction: "cut p95 by roughly half" is
  publishable when the absolute latency is not. Redraw screenshots as diagrams
  with neutral data, or drop images entirely, since a case study reads fine
  with no pictures. Never publish anything you are unsure about: a hiring
  manager who spots a leaked internal metric learns exactly one thing about
  you. Say the detail is confidential and offer it verbally, since "further
  detail under NDA, happy to discuss in an interview" is a normal line.

## Accessibility and analytics: table stakes, minimal footprint

A portfolio that fails keyboard navigation is disqualifying for a frontend role
and embarrassing for any other. Get the basics right (semantic landmarks, one
`<h1>` per page, visible focus, real contrast, purposeful alt text) and run a
proper pass with [`accessibility-audit`](../../design/accessibility-audit/SKILL.md).
Do not write "accessibility" on the skills list until the site passes.

On analytics, collect only what changes a decision: page views and referrers
tell you which case study gets read, and nothing else will alter what you write.
Prefer a privacy respecting, cookieless service or your host's built in request
logs, so you add no consent banner and no third party script to a page you are
using to argue that you build fast, clean frontends. Never add session recording
or a heatmap: that is a tracker on a page whose readers are strangers doing you
a favour by visiting.

## Keep it current or take it down

A site whose newest work is four years old is evidence against you, and a
"Coming soon" placeholder is worse than a 404. Review it whenever you change
roles or finish something worth writing up. Remove dead links, expired demos,
and screenshots of products that no longer look like that. If a live demo has
rotted, say so on the page or drop the link, because a broken demo is the one
thing every reader will click. If you cannot maintain the site, replace it with
a single page holding your identity line, contact details, and resume link.

## Pre-send checklist

- Does the fold say what you do and what role you want?
- Are there three to five pieces, each with problem, constraints, decisions,
  outcome, and a reflection, and does one name a rejected alternative, with
  every number sourced from a real dashboard or log?
- Is a real email address visible on every page, and does the resume PDF
  download from a stable link and match the site?
- Does the deployed URL unfurl with a correct title, description, and image?
- Does every flow work with the mouse unplugged, and is everything on the site
  still true and still live?

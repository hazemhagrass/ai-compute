# Resume Storytelling

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="resume-storytelling robot" width="200">
</div>

Turn a list of jobs into a career narrative that controls what the reader infers, honestly: every line survives a direct question in the interview room.

## What it does

A resume that lists duties leaves the reader to write the story, and readers write worse stories than the truth: a career change becomes drift, a gap becomes a problem, a lateral move becomes a demotion, a four-month stint becomes a firing. The skill supplies the true inference on the page, through paired rewrites (the resume line before and after, with the reason the rewrite works) covering: the through-line sentence that makes a non-linear career read as deliberate; career changes framed by the transferable problem rather than the departure; one-line factual gap entries with no apology and no concealment; short tenures reframed as calibration; contract, freelance, and agency work grouped so it reads as a portfolio rather than fragmentation; the summary as the reader's map, including when to cut it; outcome-plus-mechanism bullets; honest quantification for confidential numbers using ratios, scale bands, and relative change; relevance ordering with a false-chronology check; demotions, failed startups, and firings; and retargeting one history at two roles without changing a fact. It is the narrative layer over [`latex-resume`](../latex-resume/README.md) (typesetting and ATS mechanics) and [`word-resume-optimizer`](../word-resume-optimizer/README.md) (the .docx variant).

## When to use this

Use it when:

- A career history is non-linear: career change, pivot, returned contractor, interleaved tracks
- There is a gap, a short tenure, a demotion, a firing, or a failed startup on the page
- The history exists but bullets read as duty lists ("Responsible for")
- Real numbers are confidential and the metric slots are empty or influentiably filled
- One history must serve two different target roles without lying to either

Skip it when:

- The timeline is already linear, the bullets are already outcome-plus-mechanism, and the reader's inference problem is typesetting: use [`latex-resume`](../latex-resume/README.md)
- The deliverable is the letter, not the resume: [`cover-letter-generator`](../cover-letter-generator/README.md) owns that genre
- You are rehearsing how to defend the claims out loud: [`interview-prep`](../interview-prep/SKILL.md)

## Quick start

Worked example. The raw history, exactly as it arrived: five years as a
graphic designer, a two-year gap caregiving for a parent, then three years as a
front-end developer at one company, currently applying for a design-engineer
role.

**Step 1: dump every true line, unordered.** Gaps, soft skills, the messy
middle, everything. This list is the raw material; do not curate yet.

```
- graphic designer 2016-2021, agency, brand work, then product design
- 2021-2023: full-time caregiver for a parent; taught myself HTML/CSS/JS
  in the evenings of 2022; shipped two sites for local nonprofits
- front-end engineer 2023-present
- rebuilt the checkout flow in React, cut bundle 38%, cart errors down
- built the internal design-token pipeline the design team now uses daily
- ran the accessibility audit that got the product to WCAG AA
- no CS degree; self-taught; did the design work for both nonprofit sites
```

**Step 2: find the through-line.** The question each role answered, and what
grows across them.

```
Design-trained front-end engineer: I started where the pixels are,
learned to build them in a two-year caregiving gap I never intended as
a sabbatical, and I do my best work at the seam where design and
code meet.
```

**Step 3: write the gap entry.** One line, facts, no apology.

```
Before:
  2021-2023   (omitted)
After:
  2021-2023  Full-time caregiver for a parent; self-taught front-end
             development and shipped two nonprofit sites in this period
Why the rewrite works: the omission invites the worst inference and a
background check confirms the gap anyway; the one-line version states
an ordinary event in the same format as every other entry, and converts
part of the gap into evidence.
```

**Step 4: rewrite the summary.** The old one led with apology.

```
Before:
  After a career change from design, I am now a front-end developer
  seeking to grow in engineering. My path was unconventional but I am
  a fast learner.
Why it fails: leads with the departure, invites "drift," and "fast
learner" is a claim the reader must take on faith.
After:
  Design-trained front-end engineer: I moved from agency product
  design into code, and I do my best work at the seam between design
  and engineering (token pipeline and accessibility audit below).
Why the rewrite works: it names the destination problem first, treats
the design years as evidence instead of a past to explain, and points
the reader at the two bullets that settle it.
```

**Step 5: rewrite three bullets as outcome plus mechanism.**

```
Bullet 1
Before: Responsible for rebuilding the checkout flow.
After:  Rebuilt the checkout flow in React, cutting bundle size 38% and
        cart abandonment errors 30% quarter over quarter.
Why: duty with no outcome became outcome plus the mechanism someone can
ask about; the number is one I can name the analytics dashboard behind.

Bullet 2
Before: Worked with design team on various projects.
After:  Built the design-token pipeline (Figma variables compiled to CSS
        custom properties), eliminating the twice-yearly "colors drifted
        again" redesign the design team used to run.
Why: the vague collaboration line describes a job description; the
rewrite shows the artifact, the mechanism, and the human outcome, and
it is the strongest evidence for the design-engineer seam the summary
claims.

Bullet 3
Before: Helped make the product accessible.
After:  Ran the audit that brought the product to WCAG AA, then trained
        the 6-person team on the fixes; accessibility has shipped as
        part of definition-of-done since.
Why: "helped" hides who did what; the rewrite owns the outcome, names
the scope, and shows an organizational change that outlasted me.
```

**Step 6: verify with the room test.** Read the page as a tired reader in 30
seconds. Then ask of every number and claim: if asked "how did you measure
that," can you answer in one sentence without hedging? Bundle-sizes and audit
findings can be re-derived from the repo and the accessibility tooling; that
is the standard.

## Key concepts

- **Through-line:** one true sentence naming what the career is about; every major bullet should be an instance of it. Without one, the reader supplies a worse one.
- **Framing vs. lying:** framing chooses which true facts to foreground; lying puts a false fact on the page. Date-shifting and invented metrics are never framing, whatever the narrative benefit.
- **Outcome plus mechanism:** each bullet pairs what changed for someone with how you made it change. Either alone reads as strut or as motion.
- **The room test:** every line must survive a direct question in the interview. If you cannot name the source of a number or the method behind a claim, down-claim or delete.

## Common pitfalls

- **Concealing a gap.**
  Bad: the timeline simply omits two years.
  Good: one factual line, same format as any other entry ("Full-time caregiver for a parent; self-taught front-end and shipped two nonprofit sites in this period").
  Reason: the omission invites the worst inference and background checks confirm the gap regardless; the one-liner converts dead time into partly credited time.

- **Duty bullets.**
  Bad: "Responsible for the CI pipeline."
  Good: "Cut PR feedback from 25 to 7 minutes by moving from one shared Jenkins box to per-queue GitHub Actions runners."
  Reason: "responsible for" describes the job description, not your output; outcome plus mechanism lets the reader size the work without asking.

- **Leading a career change with the departure.**
  Bad: "Wanted a new challenge, so I moved from marketing to data engineering."
  Good: "Data engineer specializing in pipelines for messy human-entered data; five years in marketing analytics means I have personally suffered every way a source can be miscoded."
  Reason: the first version names what you left and reads as escape; the second names the destination problem and treats the old domain as evidence for it.

- **Invented precision.**
  Bad: "Reduced infrastructure spend by $247,383 annually."
  Good: "Roughly a quarter of the infrastructure bill, by moving batch jobs to spot capacity; the baseline was seven figures, that much I can say."
  Reason: an invented number is a question you cannot answer in the room; a confidential real number belongs as a ratio or scale band, not a fabricated dollar figure.

- **Title inflation.**
  Bad: "Led a cross-functional team of 15 engineers" (contractor who coordinated across teams).
  Good: "Coordinated work across 3 client teams (15 engineers total) as technical lead of my own 4-person pod."
  Reason: overclaiming is the first thing an interviewer probes, and the interview is where an inflated line collapses; the true mechanism carries the same scale honestly.

- **Six separate contract entries.**
  Bad: one entry per client, each a few weeks long.
  Good: one umbrella "Contract software engineer, 2022-present" with engagements as sub-bullets.
  Reason: fragmentation is often a formatting artifact; the umbrella turns six apparent job changes back into one role with a portfolio.

## See also

- [`latex-resume`](../latex-resume/README.md): typesetting the resulting document so parsers survive it
- [`word-resume-optimizer`](../word-resume-optimizer/README.md): the .docx variant of the same problem
- [`cover-letter-generator`](../cover-letter-generator/README.md): one-page letters telling the same story
- [`interview-prep`](../interview-prep/SKILL.md): defending these claims in the room
- [`linkedin-profile-optimizer`](../linkedin-profile-optimizer/README.md): the same narrative over a profile page
- [`salary-negotiation`](../salary-negotiation/README.md): what to do when the story lands
- [`portfolio-website-builder`](../portfolio-website-builder/README.md): the work samples the gap entry claims
- [`technical-writing`](../../writing/technical-writing/SKILL.md): the prose craft under the summary and bullets

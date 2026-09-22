# Infographic Resume

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="infographic-resume robot" width="200">
</div>

Build a data-visual resume where every chart is honest: measured quantities on
real axes, and evidence where the dishonest templates put skill-percentage bars.

## What it does

Takes the infographic resume genre and keeps only the parts that survive
scrutiny. It tells you which resume facts are genuinely quantitative (years of
use, team size, revenue moved, latency improved, users served, budget owned)
and which are not (skill "level", passion, communication as a percentage), then
rebuilds the visual around what is real: tenure strips on real date axes,
before/after impact bars with named units, and evidence bullets where the
star ratings used to be. It also covers data-ink discipline for a one-page
document, greyscale and colour-blind safe palettes for printed copies, the ATS
parse problem for chart-heavy layouts, tooling choices for production, and the
standing rule that every visual claim is an interview question you can answer.

## When to use this

- You (or a template you picked) have skill bars, star ratings, dot scales, or
  a competency radar on a resume and want to decide what stays.
- You want to chart something real: a career arc, a before/after impact pair,
  a tenure strip, and you need it to stay honest on the page.
- You are reviewing a candidate's or a friend's infographic resume for
  credibility problems before they send it.
- You are producing a chart-bearing resume and need the ATS/plain-text
  companion story settled.

## Quick start

Take the most common failure, a skills block full of percentage bars, and
rebuild it as something defensible.

**Before (the dishonest version):**

```text
SKILLS
Python        ████████████░░  85%
Go            ████████░░░░░░  60%
Rust          ███░░░░░░░░░░░  25%
Leadership    ████████████░░  90%
```

Every number here is a self-assessment with no unit, no scale, and no source.
"Leadership 90%" is the worst of the four: it makes a social claim look like a
measurement, and it invites a panel question ("who scored you 90?") with no
answer.

**After (the defensible version):**

```text
SKILLS
Python    6 yrs   -- testing, packaging, 2 prod services
Go        3 yrs   -- 2 services in prod, ~4k rps combined
Rust      1 yr    -- author of one internal CLI

EVIDENCE
- Built and maintain patlee.dev (open source)
- Led a 7-engineer team through a service migration to Go
- Wrote the on-call runbook now used by 4 teams
```

The rebuild does three things. Bars become measured quantities with units
(years) and depth signals (what was actually built, at what scale). The
leadership percentage becomes evidence a reader can check (team size, adoption
counts, named artefacts). A small partial bar becomes an honest small number
(1 yr, one CLI, no shame attached). Both versions still contain the keywords,
so nothing is lost to a keyword search. Each remaining claim now has an
answer to the interview question it invites: where the years came from (first
commit, first production deploy), where the rps figure came from (the service
dashboard).

If you want one of these numbers as a chart rather than text, it must keep its
unit and its axis: see the SKILL.md sections on impact axes and career arcs.

## Key concepts

- **Only measured things become charts.** A fact earns visual encoding only if
  it has a unit, a scale, and a source you could name in the room.
- **Skill-percentage bars, five-star ratings, and dot scales are noise, not
  design flaws.** They encode self-assessment on an unwitnessed scale. Replace
  with shipped things, scale signals, depth signals, or worded levels.
- **Impact gets a real axis.** Before/after pairs from zero, unit named in the
  axis label, both numbers labelled at the bars. A bare percentage without a
  baseline is the same sin as a skill bar.
- **Career arcs work because time was really measured.** Date axes are ordinal,
  so bars are exempt from the zero rule, but the axis must stay unbroken and
  gaps must be shown, not snapped shut. Radar wheels do not work; cut them.
- **Data ink is the budget on one page.** Count what a visual replaces against
  what it costs; one chart per page; direct labels, no legends; one accent
  colour bound to one meaning across the whole document.
- **Print is greyscale.** Lightness must carry the message with colour as
  reinforcement, and the page must survive both a greyscale conversion and a
  colour-blind simulation.
- **The ATS parse problem is structural.** Chart text is often not text at
  all, and icons stand where keywords should be, so a chart-heavy resume
  needs a generated plain-text twin, not an improvised paste.
- **Every visual claim is an interview question.** If no answer exists for a
  mark on the page, that mark comes out.

## Common pitfalls

- **Bad:** a skills block of percentage bars like `Python 85%`.
  **Good:** `Python 6 yrs -- testing, packaging, 2 prod services`.
  *Why:* the percentage has no denominator, no source, and no defence; the
  years figure has a unit and a checkable anchor, and it dares the panel to
  test the depth signal rather than the inflated number.

- **Bad:** five stars next to "communication".
  **Good:** a bullet such as "Wrote the decision doc and runbook adopted by 4
  teams" near the role it describes.
  *Why:* a star is your opinion of you; a shipped artefact is a thing the
  reader can find, open, and judge. One invites a question, the other answers
  one before it is asked.

- **Bad:** an impact claimed as "cut latency 47%" with no baseline anywhere,
  or plotted on an axis that starts at 600.
  **Good:** `p95 1.9s to 0.64s` in text, and if charted, two bars from zero
  labelled 1900 ms and 640 ms on an axis labelled "p95 latency, ms".
  *Why:* a percentage without a base is what skill bars are made of; a
  non-zero axis makes bar lengths lie about magnitude.

- **Bad:** a radar chart of "competency areas" with eight spokes of invented
  levels, in full colour that dies in a greyscale print.
  **Good:** a tenure strip on a real date axis with role-change markers, in
  one accent colour plus greys, labelled directly on the mark.
  *Why:* radar axes are incomparable and unwitnessed, and colour-only
  encoding reversal loses the message the moment the page is printed.

- **Bad:** a decorative chart exported from a design tool, its numbers
  flattened into pixels, no plain-text version in hand when the portal asks
  for pasted text.
  **Good:** the same numbers live in a text bullet next to the chart, and a
  generated plain-text twin is verified with `pdftotext -raw` before
  submission.
  *Why:* parsers read the text layer only; a keyword or figure that exists
  just in pixels does not exist to the system that decides whether a human
  ever sees the page.

## See also

- [data-visualization-principles](../../data/data-visualization-principles) for the
  normative encoding rules: chart selection from the question, zero baselines
  for length encodings, axis honesty, colour as encoding.
- [latex-resume](../latex-resume) for the LaTeX house style, ATS extraction
  mechanics, and the plain-text companion workflow.
- [creative-resume-design](../creative-resume-design) for the broader visual
  craft: typography, hierarchy, and layout on a designed resume.
- [word-resume-optimizer](../word-resume-optimizer) for the .docx variant of
  the same ATS parse problem.
- [interview-prep](../interview-prep) for rehearsing the question each chart
  mark will provoke in the room.
- [portfolio-website-builder](../portfolio-website-builder) when the charts
  belong on a site you control instead of a one-page PDF, where the space and
  parsing constraints differ.

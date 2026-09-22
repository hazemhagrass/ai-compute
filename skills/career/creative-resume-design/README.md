# creative-resume-design

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="creative-resume-design robot" width="200">
</div>

Design a visually distinctive resume with typographic craft and restrained
colour, while keeping a second parse-safe version in sync for application
portals.

## What it does

This skill designs the human-facing version of a resume. It builds hierarchy
from typography rather than ornament: a modular type scale with a defined size
for name, role line, section heads, body text, and metadata; one computed
accent colour with stated WCAG contrast ratios that survives a greyscale
printout; margins and grid spacing that behave on real paper; and icon or link
choices that do not fail in either medium.

It starts from a conflict it refuses to paper over. The layout tools that make
a resume look designed are exactly the tools that destroy machine parsing:
tables, text boxes, multi-column grids, icons, background shapes, and image
headers all scramble text extraction in the portals that recruiters actually
read first. A clever single file that satisfies both does not exist. The
honest answer is a deliberate two-version strategy: a designed PDF for humans
who receive the file directly, and a linear parse-safe version for application
portals, both produced from one source of truth so the pair cannot drift.

Beyond the two versions, the skill covers the judgement calls that decide
whether design helps at all: which fields reward craft on the page and which
read heavy design as a mismatch; how seniority changes the answer; how the
one-page question depends on career stage rather than dogma; why skill-level
charts and progress bars are a credibility risk; and the print assumptions
(margins, CMYK shift, no bleed) that a designed resume is more likely to meet
than a plain one.

## When to use this

Use it when the person sits in a design-adjacent field where craft on the page
is part of the audition: visual design, brand, marketing, illustration,
photography, front-end work with a public face. A visually flat resume from a
senior designer is itself the mismatch; an agency art director screening
candidates notices typography the way an engineering manager notices systems.

Also use it when any candidate explicitly wants a distinctive resume and you
need that design to not break text extraction, greyscale printing, or portal
parsing. The two-version discipline matters most exactly where the design
ambition is highest.

Skip the decorative ambitions for backend engineers, data scientists, finance,
and operations candidates. A heavily designed resume in those fields hints the
candidate's energy goes to the wrong layer; restraint reads as competence.
For them, a typographically clean single accent colour is the ceiling, and the
parse-safe version may as well be the only version.

Route neighbouring concerns to their owners rather than duplicating them:
.docx internals to `skills/career/word-resume-optimizer`, the LaTeX
typesetting pipeline to `skills/career/latex-resume`, contrast and
never-colour-alone rules in full to `skills/design/accessibility-audit`, and
genuine data-viz devices to `skills/infographic-resume`.

## Quick start

Take one flat resume header and restyle it. Before, the generic default that
most templates emit:

```text
Pat Lee
Backend engineer
pat.lee@example.com | 555-0142 | github.com/patlee | patlee.dev

EXPERIENCE
Ledger, Senior Engineer, 2021-present
- Led payments migration
```

After, restyled with a real modular scale and print-safe colour. The name sits
at 28 pt semibold (weight 600), the role line at 13 pt weight 500 with
letter-spacing of 0.08em, the contact line at 10 pt regular, the section head
at 12 pt bold, and body at 10.5 pt on 14 pt leading. Text colour is ink
`#1a2a4a` at 14:1 against paper-white `#faf7f2` for everything that must be
read as prose. The accent, a warm rust `#a34a1f`, appears only on the role
line and the section-head rules; it measures 5.5:1 on `#faf7f2`, computed with
the WCAG relative luminance formula, comfortably above the 4.5:1 AA floor.

```text
           P A T   L E E                        28 pt, w600, #1a2a4a
     BACKEND ENGINEER                           13 pt, w500, #a34a1f
     pat.lee@example.com 555-0142 patlee.dev    10 pt, w400, #1a2a4a
                                        ~ ~ ~
EXPERIENCE                            12 pt, w700, #1a2a4a + 0.5 pt rule
Ledger  Senior Engineer  2021-present 10.5 pt, w400, #1a2a4a
Led payments migration, cutting p95 checkout
latency from 1.4 s to 380 ms for 2.1 M users.
```

The same content, produced in the same build step, yields the parse-safe
version: a single column, no rules, no colour, no icons, every value on its
own line, and plain-text labels so structure survives extraction:

```text
Pat Lee
Backend engineer
Email: pat.lee@example.com
Phone: 555-0142
Site: patlee.dev

EXPERIENCE
Ledger, Senior Engineer, 2021-present
- Led payments migration, cutting p95 checkout
  latency from 1.4 s to 380 ms for 2.1 M users.
```

Because both files come from one master, a title change in the header cannot
forget the portal copy; the diff between the parse-safe versions catches it
mechanically.

## Key concepts

- **Two-version strategy**: designed PDF for humans, linear parse-safe version
  for portals, both generated together from one master. Ambition in the
  designed file is licensed by a plain fallback always existing. Deliverables
  are named so they record themselves: `pat-lee-designed.pdf` and
  `pat-lee-ats.pdf`.
- **Typography carries the design**: name 24 to 32 pt semibold, role line at
  about 13 pt with wider tracking, section heads all one size at 11 to 13 pt,
  body 10 to 11 pt, dates reading as metadata by weight rather than size.
  Uniform section spacing does more for structure than rules or boxes.
- **Modular scale**: pick a ratio (about 1.2 per step) and stamp the name and
  section heads from the body size, so the type sizes relate to each other
  instead of being eyeballed independently.
- **Greyscale-first colour**: one accent colour at most, contrast computed
  with the WCAG relative luminance formula and quoted with real ratios, never
  below 4.5:1 for normal text or 3:1 for large text and boundaries. Saturated
  RGB primaries shift muddy when a printer converts to CMYK, especially blues
  and reds.
- **Print assumptions**: 0.75 in margins, no bleed (resumes are not trimmed),
  PDF rather than docx for the designed artifact, and a real greyscale print
  test before sending the file out for the fifth time.
- **Icons never carry meaning alone**: every contact icon sits beside visible
  text naming it, so both the extracted portal copy and the printed page keep
  the information. An email address shown only as an envelope icon is lost in
  both media for different reasons.
- **Whitespace as the main material**: margins at or above 0.75 in, a single
  column even in the designed version, and visibly more space between sections
  than between bullets within one, roughly 2 to 3 times as much, so sections
  pre-read as blocks.
- **No skill-level charts**: bars and radar charts invite, without ever
  answering, the question "what is 70 percent of Postgres". They are also
  most likely to render illegibly in greyscale. The rare exceptions belong to
  the sibling infographic skill, not to a resume.

## Common pitfalls

- **Bad**: sending one heavily designed two-column file to every application
  channel. **Good**: a designed version for direct and personal sends and a
  plain `*-ats.pdf` from the same master for portals. Reason: two-column and
  table layouts routinely invert or interleave runs of text on extraction,
  mangling titles and dates in the recruiter's view.
- **Bad**: an email shown as an envelope icon beside the address, with a
  hairline section rule that is visible only in colour. **Good**: the word or
  the bare address in plain text, and boundaries at least 3:1 against the
  background. Reason: icons drop on extraction, and hairlines vanish in a
  mono printout; a contact detail should never depend on either.
- **Bad**: an accent picked by taste alone and set at a mid-tone tint.
  **Good**: a computed pair, for example ink `#1a2a4a` at 14:1 and rust
  `#a34a1f` at 5.5:1 on `#faf7f2`, verified before shipping. Reason: WCAG AA
  for normal text requires 4.5:1, and a resume is frequently printed in black
  and white; a wrong contrast ratio is a readability failure, not a taste
  call. A colour like `#c8c8c8` on white measures 1.67:1 and is unreadable.
- **Bad**: adding heavier rules, boxes, and ornaments to a resume that reads
  flat. **Good**: fixing hierarchy at the type level with uniform section
  head sizes and proper section spacing, then dropping ornament entirely.
  Reason: ornament is usually a symptom of flat hierarchy; restack the
  hierarchy and the ornament becomes both unnecessary and risky.
- **Bad**: a one-page resume with the third job deleted, or a two-page resume
  at two years of experience. **Good**: one page below about six years, two
  pages earned beyond that, three pages the hard ceiling above twelve years.
  Reason: page count should be earned by content; padding reads as such and
  cutting essentials reads as hiding something.

## See also

- [skills/career/latex-resume](../latex-resume) owns the LaTeX typesetting
  side, the text-extraction mechanics, and the build pipeline.
- [skills/career/word-resume-optimizer](../word-resume-optimizer) (in parallel
  development) owns .docx ATS mechanics and the Word-specific parser path.
- [skills/design/accessibility-audit](../../design/accessibility-audit) owns
  the contrast computation rules and the never-colour-alone discipline.
- [skills/career/portfolio-website-builder](../portfolio-website-builder)
  owns the portfolio site that a resume links to.
- [skills/infographic-resume](../infographic-resume) (in parallel
  development) owns data-viz devices and when they belong on a page.

---
name: creative-resume-design
description: "Use when designing a visually distinctive resume. Typographic craft that reads well in print while a second parse-safe version feeds the ATS."
---

# Creative Resume Design

A resume is a designed artifact submitted to a machine. Visual craft and machine
parsing are in direct conflict: tables, text boxes, multi-column grids, icons,
and background shapes, the very tools that make a page look designed, are the
same tools that scramble text extraction. There is no clever single file that
reconciles this. The honest answer is the deliberate two-version strategy: a
designed PDF for humans who receive it directly, and a linear parse-safe
version for application portals, both generated from one source of truth.

## When creative helps, and when it hurts

Design on the page is a signal about you. Match the field and the seniority.

- Design, brand, marketing, illustration, photography: craft on the page is
  part of the audition. A visually flat resume from a senior designer is the
  mismatch; a portfolio link doing all the work while the resume is generic
  leaves an expectation unmet.
- Engineering, data, finance, operations: a heavily designed resume reads as a
  mismatch, because it hints the candidate's energy goes to the wrong layer.
  Restraint reads as competence. A typographically clean single accent color is
  the ceiling here.
- Career changers and senior candidates: unusual layout can read as hiding
  thin experience behind decoration. Earn visual license with content first.
- Early career: hiring volume is highest and parsing matters most. A designed
  resume enters portals more often at this stage, so keep the designed
  version for direct outreach only and lead with the parse-safe one.
- When you email the file to a person, or hand it over after an intro call, or
  bring printed copies to an interview, send the designed version. When you
  upload into a portal with required form fields, send the parse-safe one.

## The two-version strategy, kept in sync

Drift is the real failure mode, not layout. You fix a title in the designed
file, the portal copy keeps the old one, and the recruiter sees two different
histories for the same person.

- Keep one master file with all content and no styling decisions in it.
- Generate both versions from the master in the same build step, so content
  changes cannot land in one and not the other.
- Name files so the artifact records itself: `pat-lee-designed.pdf` and
  `pat-lee-ats.pdf`. Never attach a mismatched name.
- After any content change, rebuild both together and diff the plain text of
  the parse-safe version against the previous one.
- When a portal both uploads the file and asks you to fill fields by hand, fill
  the fields as the source of truth and treat the upload as decoration. Portals
  often discard the file after parsing it anyway.

The discipline is boring on purpose. The design version can be ambitious
precisely because a plain fallback always exists.

## Let typography carry the design

Most weak creative resumes add ornament while leaving hierarchy flat. The
page should read instantly at three distances: name and role, section heads,
then body text.

- Name: 24 to 32 pt semibold. Role line below it at about 13 pt with wider
  tracking. Do not make the role bigger than the sections.
- Section heads: 11 to 13 pt bold, all one size, with consistent space above,
  usually 10 to 14 pt. Uniform spacing does more for structure than rules or
  boxes.
- Body: 10 to 11 pt regular. A resume body should not need more than one or
  two weights per page.
- Dates and locations: same size as body, lighter axis (small caps or a wider
  tracking single line) so they read as metadata, not content.
- Choose a type pairing with one voice difference. A serif for headings plus a
  neutral grotesque for body reads considered; two condensed faces reads
  chaotic. Suggested tested pairing: a title face at 28 pt and a text face at
  10.5 pt on an 14 pt leading. Modular scale: multiply body by a ratio near
  1.2 for the next level, 1.25 for section heads, and stamp the name from the
  scale rather than eyeballing it.
- Line length discipline: 60 to 75 characters of body. Bullets that wrap past
  three lines should be two bullets.

```css
/* parse-safe version of the same hierarchy, since HTML is the usual
   master for a designed+plain pair */
h1 { font-size: 1.75rem; font-weight: 600; }   /* Pat Lee      */
.role { font-size: 0.82rem; letter-spacing: 0.08em; }
h2 { font-size: 0.8rem;  font-weight: 700; }
p  { font-size: 0.72rem; }
```

## Color with a greyscale fallback

A resume is frequently printed in black and white, by the interviewer who
brought copies and by the hiring manager reviewing between meetings. Design
the page so it still works in greyscale.

- One accent color at most, plus neutral text. Suggested accent pair with
  real ratios on a paper-white page `#faf7f2`: ink `#1a2a4a` at 14:1 for body
  text, and a warm rust `#a34a1f` at 5.5:1 for accents. Both pass WCAG AA for
  normal text (4.5:1), and the rust drops to legible-but-small at bold 14pt
  where 3:1 is the floor. Do not invent numbers; compute the pair you pick.
- Never color body text in the accent lighter than that ratio, and never put
  white text on the accent fill below 3:1. Middle grey `#c8c8c8` on white is
  1.67:1 and unreadable in print; recruiters do notice.
- Test by converting to greyscale and looking once. A color block that goes
  flat grey to the same value as the text over it is a print failure.
- Accent goes on section heads, the role line, and rules, not on bullets.
  Color on every bullet reads busy and breaks print reliably.

## Whitespace and grid discipline

Designed does not mean dense. The easiest way to look expensive is to leave
room.

- Margins at or above 0.75 in on all sides of a designed version. This still
  leaves print-safe territory and the page reads confident rather than
  cramped.
- Single column even in the designed version. If you want a sidebar of
  contact info, put it on the designed version only and accept that the
  parse-safe version stacks it on top. Never rely on a sidebar to carry
  email, phone, or dates.
- Grid: 12 or 24 point baseline strength is enough; align section heads and
  rules to the same grid so the eye finds them by position, not by color.
- Whitespace between sections should be visibly larger than between bullets
  inside a section, roughly 2 to 3x, so the sections pre-read as blocks.

## The one-page question, answered by career stage

- Under about six years or fewer than three roles: one page. Two pages at
  this stage reads as padding.
- Six to twelve years: one or two pages, whichever the content earns. Two
  pages is not a failure.
- More than twelve years or multiple senior roles: two pages is normal and
  three is the hard ceiling. A reader who has to choose which page to skim
  will skim page one and assume it is representative.
- One page achieved by deleting company names or dates is worse than an
  honest two pages.

## Icons that survive print, and never alone

Icons are the most common designed resume casualty.

- Any icon next to contact details must sit beside visible text saying what
  it is. An email beside an envelope icon extracts with no label and never
  matches the `email` field; on paper the icon is fine, in a portal it is not.
- Icons as decoration should be grayscale-print safe: do not rely on hue to
  distinguish them, and keep them at 3:1 minimum against the background if
  they mark a real boundary.
- Icons never carry meaning alone. A phone glyph with the number beside it is
  acceptable; a phone glyph only is a communication failure in both media.

## Skill-level charts and other credibility risks

Skill bars, radar charts, and percent-f proficiency ticks look playful and
read as unsupportable. They invite, without ever answering, the question
"what is 70 percent of Postgres". The sibling `infographic-resume` skill owns
the full argument for when a data-viz device earns its place and how to build
one that survives print. Default position here: no skill charts on a resume.

## Linking a portfolio

Whether creative or plain, the portfolio link is the strongest signal.

- Put the plain URL, not a linkword, on the first screen: `patlee.dev`, not
  "portfolio". People print, copy, and paste; a bare URL survives all three.
- If your work is visual, do not just link, curate: 3 to 5 strongest pieces,
  each with a one-sentence problem statement. A dump of 40 projects lowers
  the signal.
- Keep the URL short enough to read over the phone without repeating a
  character. Short domains are a real resume advantage.

## Print and format concerns

A designed resume is more likely to be printed, so print questions matter
here more than anywhere.

- Minimum margin 0.5 in even in the boldest layout, 0.75 in to be safe.
  Home printers cannot print into the last half inch; content there is
  clipped, not hidden.
- Screen color is RGB, print is CMYK. A saturated accent that glows on
  screen can shift muddy on paper, especially blues and reds. If you have
  real print production in mind, check the accent color in a CMYK preview
  and pick one whose print shift is acceptable. Otherwise just avoid
  saturated primaries at full volume.
- Bleed: not needed for a resume. Resumes are printed on standard paper cut
  to size, with no trim. Do not add bleed marks; they confuse rendering in
  portals that process the same file.
- Send PDF, not docx, for the designed version. PDF fixes fonts and layout.
  The parse-safe version can be PDF or plain text depending on the portal;
  the sibling word-resume-optimizer skill owns the .docx internals.

## Verify before shipping

The designed version too deserves a real check, not a visual one.

```bash
pdftotext designed.pdf - | head -30   # how a naive parser reads it, on faith
pdftotext ats.pdf - | head -30        # this one must be clean line by line
pdffonts designed.pdf                 # embedded fonts, Type 3 is unreadable
```

Also do a greyscale print of the designed version before sending it for the
fifth time: printing catches real errors, flat accents, clipped margins,
unreadable rules, before someone else prints it.

## See also

- `skills/career/latex-resume` owns the LaTeX typesetting side, the text
  extraction mechanics, and the build pipeline.
- `skills/career/word-resume-optimizer`, in parallel development, owns .docx
  ATS mechanics and the Word-specific parser path.
- `skills/design/accessibility-audit` gives the contrast computation rules
  and the never-color-alone discipline in full.
- `skills/infographic-resume`, in parallel development, owns the data-viz
  devices and when they belong on a page.

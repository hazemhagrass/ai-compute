# Prior art: what already exists, and why these skills exist anyway

The agent-skill ecosystem is saturated. Registries index tens of thousands of
`SKILL.md` files, Anthropic ships first-party skills for the common document
formats, and every popular topic has a dozen community versions.

So "this topic is already covered somewhere" is true of almost everything here.
It is the wrong test. The test this repo holds itself to:

> Does our version do something the well-known one does not, and can that
> claim be checked?

A skill that fails that test is removed, not kept out of sentiment. Four were
removed for exactly this reason (see the end of this file).

## The edge, stated per skill

### Verification instead of assertion

The clearest differentiator in this library: claims are executed before they
are written down.

| Skill | The well-known alternative | Our edge |
| --- | --- | --- |
| `data/sql-for-analysts` | Countless SQL-tips skills | Every claim was re-run in SQLite before publication: `NOT IN` with a NULL returning zero rows, join fan-out 600 -> 700 -> 900, `<>` silently dropping NULLs, `ROW_NUMBER`/`RANK`/`DENSE_RANK` diverging as `1,2,3,4` / `1,1,3,4` / `1,1,2,3`. The failures are reproducible, not remembered. |
| `design/accessibility-audit` | Many a11y-checklist skills | Contrast ratios are computed from the WCAG luminance formula rather than quoted. One stated ratio was wrong (`#6b6b6b` on white is 5.33:1, not 5.7:1) and was corrected by recomputing it. |
| `research/research-data-analysis` | Generic stats skills | The pooled-vs-Welch t-test claim was simulated: 29% false positives under unequal n and sd versus 5% for Welch; heavy tails cost power (20% vs 88% for Mann-Whitney), not alpha. |
| `career/word-resume-optimizer` | Many ATS-resume skills | Tested against real parsers: text boxes fail twice (invisible to `.docx` extraction *and* clipped on PDF export, so PDF is not the escape hatch), Word's default bullet is `U+F0B7` from the Symbol PUA, and `.doc` raises `PackageNotFoundError` rather than degrading. |
| `career/video-resume` | Video-intro advice posts | The ffmpeg commands were run against generated clips; loudnorm to -16 LUFS lands at about -15.3, which is stated rather than promised. |
| `finance/investment-portfolio-analyzer` | Portfolio-analysis skills | Every quoted figure was computed (XIRR 6.1804% with xnpv 0.0, fee drag, max drawdown -19.25%). One example was wrong until the period length was pinned: the stated MWR only reproduces if each period is six months. |
| `research/citation-manager` | Bibliography skills | Found by querying Crossref directly: it lowercases DOIs and returns a Unicode dash in page ranges. An example that could not be verified was dropped rather than fabricated. |

### A different angle on a crowded topic

| Skill | The well-known alternative | Our edge |
| --- | --- | --- |
| `office/excel-formulas` | Endless Excel skills | Organised around *silent wrong answers* rather than syntax: approximate-match `VLOOKUP` returning a plausible neighbour, text that looks numeric, float money. The failure mode that does not raise an error is the one that costs money. |
| `ai/prompt-engineering` | The single most duplicated skill topic | Concrete and falsifiable rules (instruction placement, two examples beating a paragraph of description, temperature by task) instead of "be specific". |
| `engineering/debugging` | Many debugging skills | Built on binary search over *three* axes (code, data, environment) and on questioning both assumptions, rather than a generic "reproduce, isolate, fix" loop. |
| `career/infographic-resume` | Resume-design skills | Takes a position most do not: percentage skill bars are a credibility problem, not a design flaw. "Python 85%" has no unit, no scale, no source, and is a written promise to be examined at that level in the interview. |
| `content/video-script-writer`, `content/podcast-production` | Content-creation skills | Reference links were fetched and confirmed live; a guessed URL that 404'd was replaced with one that resolved, and a dead FTC link was dropped rather than cited. |
| `meta/skill-authoring` | Skill-authoring guides | Enforced by machine. `scripts/doctor.sh` checks the frontmatter contract, `scripts/scan-skills.py` checks for injection, and CI fails the build. Guidance nobody can quietly violate. |

### Whole-library properties

These hold across all 94 skills and are rare in community collections:

- **CI-validated.** Structure, frontmatter contract, robot uniqueness, manifest
  freshness and a security scan run on every push. The contract check exposed
  18 genuine violations the repo had been carrying silently.
- **Prompt-injection scanned.** `scripts/scan-skills.py` runs over every
  `SKILL.md` and bundled script. It was tested against a fixture of 14 known
  bad payloads before being trusted, and the rules were corrected when they
  produced false positives on documentation examples.
- **Every `See also` link resolves.** Checked against disk, not assumed.
- **Versioned and installable.** Content-hash manifest, semver from a manifest
  diff, and a per-category plugin marketplace.

## Skills removed for having no edge

Kept honest by deleting rather than defending:

| Removed | Superseded by |
| --- | --- |
| `office/word-documents` | Anthropic's first-party `docx` skill (tracked changes, comments, TOC via raw XML) |
| `office/powerpoint-automation` | Anthropic's first-party `pptx` skill (templates, layouts) |
| `meta/readme-generator` | Ubiquitous upstream; ours was the thinnest file in the repo |
| `devtools/git-commit-writer` | Folded into `devtools/git-workflow`; the conventional-commit half is the most duplicated concept in the ecosystem |

Issues closed for the same reason rather than built: pr-description-template,
book-summary-writer, design-system-builder, mobile-first-design. Each was closed
with the specific upstream skill that already does it better.

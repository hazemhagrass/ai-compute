---
name: infographic-resume
description: "Use when charts or skill graphics go on a resume. Build the visual form honestly: real axes, real quantities, evidence instead of skill-percentage bars."
---

# Infographic Resume

A resume is a one-page document where every square centimetre must earn its
place, and a chart is the most expensive claim on it. The infographic resume
fails in one specific way: it encodes things that were never measured. A bar
named "Python 85%" is a number with no unit, no scale, and no source; to a
numerate reader it is not a strength but a credibility problem, and it invites
an interview question the candidate cannot answer. This skill teaches the form
while refusing its dishonest parts.

For the encoding rules that govern any chart you produce (form follows
question, bars from zero, colour as encoding, direct labelling), see
`../../data/data-visualization-principles`. That document is normative here;
this skill does not restate it, only applies it to the constraints of a one
page resume. For general visual craft (typography, hierarchy, layout), see
`../creative-resume-design`.

## 1. Only measured things become charts

Every fact on the page arrives in one of two bins. The bin decides its format.

**Genuinely quantitative, from a source you could name:**

- Years of use of a tool or language, if you can date the first commit.
- Team size you led or owned ("7 engineers").
- Money moved: budget owned, revenue influenced, costs cut, with units.
- Latency, throughput, or reliability changed, as a before/after pair.
- Users or requests served, with a time window.
- Uptime, error rates, deploy frequency, from a dashboard.
- Volume of output: releases, documents, systems owned, counts of anything.

**Not quantitative, no matter how the template formats them:**

- Skill "level" or "proficiency percentages".
- Passion, communication, leadership, creativity, adaptability.
- Familiarity ("exposure to", "familiar with") as a filled bar.
- Any three-digit number whose scale and unit you cannot state.

When a skill file says 85, ask: 85 of what? Percent of what denominator?
Perceived by whom, measured how? There is no answer, so the bar must go. The
same applies to bars of shaded squares, dot scales, thermometers, and
thermometer-style "o o o" levels with no anchor: fill a shape with opinion,
and the shape looks measured while measuring nothing.

Replace the bar with its unit and a depth signal, which survives scrutiny
(unit: years; source: commits, production; depth signal: distinguishes the 6
from the 1) while keeping the keywords:

```text
Python    6 yrs   -- testing, packaging, 2 prod services
Go        3 yrs   -- 2 services in prod, ~4k rps combined
Rust      1 yr    -- author of one internal CLI
```

## 2. Cut percentage bars, stars, and dot scales outright

These three encodings are not fixable by better design; they encode noise.

- **Percentage skill bars.** The length is a self-assessment that scales from
  nothing, so two honest candidates cannot agree on how to fill it, and the
  reader learns nothing beyond "claims Python more than Go", which is a
  ranking of confidence, not competence. Also actively harmful: an interview
  panel will target the longest bar. A 90% bar is a written promise to be
  examined at the 90% level on topics you may not have touched.
- **Five-star ratings.** Stars import a survey idiom, and surveys have a
  respondent. The reader is being shown your opinion of you, dressed as a
  measurement. Evidence, shipped artefacts, and counts beat any star.
- **Dot scales ("o o o o") and thermometers.** Same problem, quieter ink: a
  fill level with no anchor. No interviewer can calibrate against it, so it
  measures only bravado.

Put these things where the bar was:

1. **Shipped things.** "Built and maintain patlee.dev (open source)",
   "authored 3 internal services adopted by 4 teams".
2. **Scale signals.** Requests per second, data volume, team size, uptime of
   something you owned, "recovered from 3 P1 incidents on-call".
3. **Depth signals.** Conference talks, blog posts, RFCs authored, having
   written the docs others read, teaching or mentoring hours.
4. **A plain worded scale you actually defend.** If a recruiter wants a
   keyword plus a level, use words with a personal meaning you can state:
   "expert (led 2 migrations)" vs "working knowledge". Worded levels are
   falsifiable on sight; percentages pretend to precision they do not have.

A percentage on skills and a metric on an achievement are not the same genre.
"Cut p95 latency 1.9s to 640ms" is defensible because both endpoints had
dashboards. "Python 85" has nothing behind it.

## 3. Timelines and career arcs that actually work

Time is the one dimension a resume genuinely measured, so a timeline earns its
place.

- **Career arc / tenure strip**: one band per employer on a real year axis,
  role changes marked inside the band. Answers "how long, any gaps?" in one
  glance, using only facts.
- **Dated annotations on the band**: promotions, specialty changes, team
  growth, certifications. Real events at real positions.
- **Cut radar / spider competency wheels.** Incomparable axes, unverifiable
  shape, invites the reader to find the smallest spoke.
- **Cut "skill evolution" curves of invented values.** No numbers, no plot.

If you plot a timeline, draw it with matplotlib or as a clean SVG you
hand-check: a bar from a real start date to a real end date, employer name as
direct label, no legend. A date axis is ordinal, so bars running from the
candidate's first job rather than from the year zero are not the "truncated
bar" lie; keep the axis linear and unbroken, and label every employment gap
explicitly rather than snapping bars together to look continuous.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Honest career arc: real dates, direct labels, one accent colour
roles = [
    ("Acme Corp",      "Engineer -> Lead", 2018.5, 2021.25),
    ("Globex",         "Senior Engineer",  2021.25, 2024.5),
    ("Initech",        "Principal",        2024.5, 2026.5),
]
fig, ax = plt.subplots(figsize=(6, 2.2))
for i, (org, role, start, end) in enumerate(roles):
    y = len(roles) - 1 - i
    ax.barh(y, end - start, left=start, height=0.45,
            color="#1f6feb" if i == len(roles) - 1 else "#c9ccd1")
    ax.text(start + 0.05, y, f"{org} ({role})",
            va="center", ha="left", fontsize=9,
            color="white" if i == len(roles) - 1 else "black")
ax.set_yticks([])                 # the bar IS the label
ax.set_xticks([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
ax.set_xlim(2018, 2027)
ax.set_xlabel("years")
ax.spines[["top", "right", "left"]].set_visible(False)
ax.set_title("One axe, real dates, no gap removed", loc="left", fontsize=10)
fig.tight_layout()
fig.savefig("arc.png", dpi=120)
```

Note the title: an unbroken axis of years with bars anchored at real dates is
a chart an employer can audit against your employment history.

## 4. Impact on a real axis, with a stated unit

When you plot an impact claim, it is subject to every rule a chart in a
report is subject to, plus one: the resume gets about a quarter of the page,
so a chart earns its ink only if the magnitude is the message.

- **State the unit beside the value** and prefer before/after pairs to bare
  percentages. "p95 1.9s to 0.64s" beats "fast". If you must chart it, plot
  both endpoints on a zero-based axis so the length is proportional, and
  label both numbers at the bars.
- **If a percentage is the only number you have, name the baseline.** "Cut
  bundle size 38%" is weak; "bundle 2.1MB to 1.3MB" is strong. A percent
  without a base is what percentage skill bars are made of, and reads the
  same to a sceptical reader.
- **One chart per page, maximum.** Two claims compete for the ink budget and
  a one-page document will not carry that.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Impact magnitude: unit in the axis label, axis from zero, both bars labelled
fig, ax = plt.subplots(figsize=(4.2, 2.0))
stages = ["before", "after"]
p95_ms = [1900, 640]
ax.bar(stages, p95_ms, color=["#c9ccd1", "#1f6feb"], width=0.55)
for x, v in zip(range(2), p95_ms):
    ax.text(x, v + 40, f"{v} ms", ha="center", fontsize=10)
ax.set_ylim(0, 2200)
ax.set_ylabel("p95 latency, ms")
ax.spines[["top", "right"]].set_visible(False)
ax.set_title("Checkout p95 under the rewrite", loc="left", fontsize=10)
fig.tight_layout()
fig.savefig("impact.png", dpi=120)
```

Two bars, one axis, units named, both numbers labelled, sorted so the "after"
bar is the accent. This survives an interview: the candidate can say what the
dashboard was and what population of requests the metric covers.

## 5. Data-ink on a page where space is the constraint

A one-page resume cannot afford a chart legend, an axis of ticks, or a
decorative banner. Count the lines a visual replaces versus the lines it
costs: a tenure strip replaces four one-line bullets at four lines of ink; a
skill wheel replaces nothing (the bullet text must stay anyway for keywords)
and costs twelve lines. Delete it. On that budget:

- **Draw in one accent colour plus greys.** The accent applies to exactly one
  element per chart: the thing you are arguing about.
- **Direct labels only, no legends, no keys.** The label must sit on the
  mark itself.
- **Drop every element that does not carry a claim**: borders, shadows,
  gradient fills, background bands, icons repeating words.
- **Round to the precision of the decision**, "6 years", not "6.4 years".
- **One typeface, two weights.** A chart in a different typeface from the
  bullets reads as a sticker, not as a claim.

## 6. Colour, greyscale, and the printed copy

Resumes get printed and reprinted in black and white downstream. So:

- **Let lightness carry the message**, with colour as reinforcement. If the
  accent-blue bar becomes mid-grey and the context bar becomes
  slightly-lighter-grey, the encoding has failed. Pick lightness values with
  real separation: very dark versus very light.
- **Add direct labels before adding a second encoding.** Labels make colour
  decorative, which is the safe arrangement.
- **Never encode a distinction by red or green alone**, or by shape the
  reader must look up. Safe default: single hue with a lightness ramp
  (Blues, viridis), or Okabe-Ito accents against grey.
- **Test by converting to greyscale and to colourblind simulation before
  sending.** A one-line check catches the failure the eye skips over. One
  colour per meaning across the page: if the accent blue means "the element
  you are illustrating" in the timeline, it cannot also mean "passion high"
  in the skills block.

## 7. The ATS parse problem, and the mandatory plain-text twin

A chart-heavy resume exports to a PDF that an applicant tracking system (ATS)
reads through its text layer. The extraction mechanics are covered in
`../latex-resume`; the points that matter specifically for charts are:

- **Chart text flattened by a design tool (Figma, Canva, Illustrator) is not
  text**: the parser sees pixels or nothing. Tools that keep a real text
  layer (matplotlib, LaTeX, HTML) are the safe class.
- **Text on curved paths, inside shapes, or rotated** extracts out of order
  or not at all. Put such claims in a normal paragraph instead.
- **Icons standing in for words** (envelope for email) leave the field empty
  in keyword-matching parsers.
- **A chart may never be the only carrier of a keyword**: names and figures a
  recruiter could search must also appear in a text bullet.
- **Ship a generated plain-text twin, always**: required wherever a portal
  takes pasted text; generated once, not improvised per application.

```bash
# Verify what a pessimistic parser sees before sending anything
pdftotext -raw resume.pdf - | head -35
pdftotext resume.pdf - | grep -i -E 'pat@example|555'
```

If a chart's numbers do not also appear as text near the chart (in a bullet
or caption), a keyword extractor loses the numbers entirely. Chart on the
page, same numbers repeated in the adjacent text: one line, both readers
covered.

## 8. Tooling

Choose the tool by whether it characterises your chart (editable encoding)
or decorates it (fixed pixels).

| Tool | Class | Notes |
| --- | --- | --- |
| matplotlib | data, exact | Real axes, smallest risk; exports SVG or PDF for LaTeX/HTML. |
| plotly (kaleido) | data, exact | Vector PDF/SVG output; heavier dependency for a one-off. |
| LaTeX (TikZ) | document-native | Text preserved if drawn with real nodes; see `../latex-resume` for sidebar/icon pitfalls. |
| HTML/CSS (flexbox charts) | document-native | Bars as divs with widths on a real scale; text stays text; fiddly to keep a zero baseline. |
| Excel / Google Sheets | data, fast | Fine for the impact bar; often raster on export. |
| Figma / Canva / Illustrator | design | Flattens text; never for data claims, at most the header/banner. |

For matplotlib, running the snippets and reading the PNG back before building
the page catches truncated axes and unreadable labels at build time, not in
the hiring manager's inbox.

## 9. Every visual claim is an interview question

The rule that makes the genre work: for each chart element, write the question
a panel will ask, and the number or name you would answer with. If no answer
exists, delete the element.

- Python percentage bar: "What does 85 mean?" No answer. Cut.
- Tenure strip: "How long at Globex?" Mar 2021 to Sep 2024. Keep.
- Impact bar: "Where did the 640ms come from?" Datadog dashboard,
  checkout-service p95, week of the rewrite, n=all checkout traffic. Keep.
- Radar of "skills": "What is on the axes?" Weighted vibes. Cut.
- Dot scale on "communication": "Rate yourself?" A word, not a number.
  Replace with a story about a doc, a decision write-up, or a notice you
  wrote that set a tone. Otherwise cut.

Practical check: after any visual edit, print the page and apply one question
per mark. Each mark that triggers a question you cannot answer comes out.

## Quick checklist

- Every number has a unit, a scale, and a source you could name.
- No percentage skill bars, star ratings, dot scales, or competency radars.
- Columns replaced by: shipped things, scale, depth signals, or worded levels.
- One chart per page, axis from zero for length encodings, unit named.
- Career arc uses real dates and shows the gaps honestly.
- Palette works in greyscale and colourblind simulation; one accent colour,
  bound to one meaning page-wide.
- Plain-text twin generated and checked with `pdftotext -raw`.
- Any keyword a search should hit also lives in a text bullet.

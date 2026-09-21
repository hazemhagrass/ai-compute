# PowerPoint Automation

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for generating branded `.pptx` decks from data with python-pptx, driving everything through a corporate template's layouts and placeholders instead of hand-placing shapes.

## What it does

Turns a data source into a finished deck that already looks like the company's decks:

1. Opens a corporate template so slide size, master, theme fonts, and color scheme are inherited.
2. Prints the template's layout and placeholder map so you address shapes by stable `idx`, not position.
3. Fills title and body placeholders, building real bullet outlines with `paragraph.level`.
4. Adds tables, charts (via `CategoryChartData`), and aspect-preserving images at EMU-correct positions.
5. Writes speaker notes per slide.
6. Estimates whether text fits its box before writing it, because python-pptx cannot compute autofit shrinkage.
7. Saves once, at the end, to a path nothing else has open.

It also names what python-pptx cannot do (animations, transitions, SmartArt) and gives the template-side workaround.

## When to use this

Concrete triggers:

- A recurring deck (weekly metrics, monthly board pack, per-client summary) is being rebuilt by hand.
- One deck must be produced per row of a CSV, database query, or API response.
- Generated slides look off-brand: Calibri 18pt black where the deck uses the theme font.
- Shapes land in the top-left corner because positions were passed as bare integers.
- Text spills out of a placeholder in the saved file but looks fine once a human clicks into the box.
- A picture is visibly stretched because both `width` and `height` were passed.
- Slide code breaks after someone edits the template, because placeholders were indexed by position.

Skip it when:

- The deck is a one-off that a designer will lay out anyway.
- Animations, transitions, or SmartArt are the point of the deck.
- The audience would be better served by a PDF, dashboard, or HTML report.

## Quick start

Build a four-slide regional review deck: cover, bullets, table, chart, all from one template.

```bash
python3 -m pip install python-pptx pillow
```

**Step 1: inspect the template**

```python
from pptx import Presentation

prs = Presentation("templates/corporate-16x9.pptx")
print(prs.slide_width.inches, prs.slide_height.inches)

for i, layout in enumerate(prs.slide_layouts):
    print(i, layout.name)
    for ph in layout.placeholders:
        print("   idx", ph.placeholder_format.idx, ph.name)
```

```
13.333 7.5
0 Title Slide
   idx 0 Title 1
   idx 1 Subtitle 2
1 Title and Content
   idx 0 Title 1
   idx 1 Content Placeholder 2
5 Title Only
   idx 0 Title 1
```

**Step 2: the data**

```python
REGIONS = [
    {"region": "EMEA",     "revenue": 24_600_000, "growth": 0.141,
     "highlights": ["Germany +22%", "Nordics flat"]},
    {"region": "Americas", "revenue": 31_200_000, "growth": 0.083,
     "highlights": ["Enterprise renewals strong"]},
    {"region": "APAC",     "revenue": 12_900_000, "growth": 0.204,
     "highlights": ["Japan launch landed", "India pipeline doubled"]},
]
```

**Step 3: cover and bullet slides**

```python
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

def body_of(slide, idx=1):
    return next(p for p in slide.placeholders
                if p.placeholder_format.idx == idx).text_frame

cover = prs.slides.add_slide(prs.slide_layouts[0])
cover.shapes.title.text = "FY26 Q3 Regional Review"
cover.placeholders[1].text = "Generated 2026-09-22"
cover.notes_slide.notes_text_frame.text = "Thirty seconds on the headline, then move on."

summary = prs.slides.add_slide(prs.slide_layouts[1])
summary.shapes.title.text = "Headlines"
tf = body_of(summary)
tf.text = "Group revenue up 12.6% YoY"
for rec in REGIONS:
    p = tf.add_paragraph()
    p.text = f"{rec['region']}: {rec['growth']:.1%}"
    p.level = 1
    for h in rec["highlights"]:
        q = tf.add_paragraph()
        q.text = h
        q.level = 2
```

**Step 4: the table slide**

```python
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Revenue by region"

headers = ["Region", "Revenue", "YoY"]
gf = slide.shapes.add_table(len(REGIONS) + 1, 3,
                            Inches(1.2), Inches(1.9),
                            Inches(10.9), Inches(0.45 * (len(REGIONS) + 1)))
table = gf.table
table.columns[0].width = Inches(4.5)
table.columns[1].width = Inches(3.7)
table.columns[2].width = Inches(2.7)

for c, head in enumerate(headers):
    cell = table.cell(0, c)
    cell.text = head
    run = cell.text_frame.paragraphs[0].runs[0]
    run.font.bold = True
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

for r, rec in enumerate(REGIONS, start=1):
    for c, value in enumerate([rec["region"],
                               f"${rec['revenue']:,.0f}",
                               f"{rec['growth']:.1%}"]):
        cell = table.cell(r, c)
        cell.text = value
        cell.text_frame.paragraphs[0].runs[0].font.size = Pt(11)
```

**Step 5: the chart slide**

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = [r["region"] for r in REGIONS]
chart_data.add_series("Revenue ($M)",
                      tuple(r["revenue"] / 1_000_000 for r in REGIONS))

slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Revenue mix"
chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1.2), Inches(1.9), Inches(10.9), Inches(4.8),
    chart_data,
).chart
chart.has_legend = False
chart.plots[0].gap_width = 60
chart.plots[0].has_data_labels = True

prs.save("out/fy26-q3-review.pptx")
```

**Step 6: verify by reopening, not by eye**

```python
check = Presentation("out/fy26-q3-review.pptx")
print(len(check.slides._sldIdLst), "slides")
for s in check.slides:
    print(s.shapes.title.text if s.shapes.title else "(no title)",
          "|", len(s.shapes), "shapes")
```

## Key concepts

- **EMU.** The English Metric Unit is python-pptx's native length: 914400 per inch, 12700 per point, 360000 per centimetre. Always wrap numbers in `Inches()`, `Pt()`, `Cm()`, or `Emu()`; a bare int is EMU and lands at the slide corner. Read back with `shape.width.inches`.
- **Template vs presentation.** `Presentation(path)` loads slide size, master, theme, and layouts from that file. `Presentation()` loads the 4:3 Office default. The template is the single source of branding; never mutate it from the generator.
- **Layout vs master.** The slide master holds theme-wide defaults (fonts per outline level, background, placeholder geometry). A layout is one arrangement derived from the master. A slide is created from a layout and inherits through layout to master.
- **Placeholder `idx`.** The stable identifier of a placeholder inside its layout, stored in the template XML. Filter `slide.placeholders` on `placeholder_format.idx`; iteration order is not visual order.
- **Placeholder vs textbox.** A placeholder inherits font, size, color, bullet glyphs, and autofit from the layout. A textbox inherits nothing and renders Office default. Use textboxes only for one-off decoration.
- **Text frame, paragraph, run.** A shape has one `text_frame`, which has paragraphs, which have runs. Formatting lives on the run (`run.font`), bullet depth on the paragraph (`paragraph.level`, 0 to 8), wrapping and autofit on the frame.
- **Autofit is a rendering result, not a stored size.** python-pptx can set `auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE` but cannot compute the shrunken point size, so overflow persists in the file until PowerPoint recalculates. Estimate the fit yourself or split the slide.
- **ChartData.** Charts are built from a `CategoryChartData` (categories plus one or more equal-length series), not from raw lists. Length mismatches produce a silently truncated chart.
- **What python-pptx cannot do.** Animations, slide transitions, and SmartArt are not modelled. Bake them into the template's layouts by hand, or substitute tables and grouped autoshapes.

## Common pitfalls

**Bare numbers for positions**

```python
# Bad: 1 EMU, roughly one millionth of an inch
slide.shapes.add_textbox(1, 1, 4, 2)

# Good: helpers convert to EMU
slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(2))
```

Reason: every length in python-pptx is an EMU, and 914400 of them make one inch.

**Building from the default presentation**

```python
# Bad: 4:3, Office theme, every run needs manual styling
prs = Presentation()

# Good: inherit slide size, theme fonts, and colors
prs = Presentation("templates/corporate-16x9.pptx")
```

Reason: the template's master carries the branding, so shapes come out on-brand for free.

**Indexing placeholders by position**

```python
# Bad: breaks when the template reorders shapes
slide.placeholders[1].text = "Body"

# Good: idx is stable template metadata
next(p for p in slide.placeholders
     if p.placeholder_format.idx == 1).text_frame.text = "Body"
```

Reason: `slide.placeholders` iteration order is not guaranteed to match visual order.

**Faking bullet levels with whitespace**

```python
# Bad: one paragraph containing newlines and spaces
tf.text = "Revenue up 14%\n    - EMEA drove 9 points"

# Good: real paragraphs with outline levels
tf.text = "Revenue up 14%"
p = tf.add_paragraph(); p.text = "EMEA drove 9 points"; p.level = 1
```

Reason: levels inherit their font size and bullet glyph from the master; whitespace does not.

**Trusting autofit with unbounded text**

```python
# Bad: text spills out of the box in the saved file
body.text_frame.text = long_paragraph

# Good: cap the content, then set the flag as a safety net
body.text_frame.text = long_paragraph[:600].rsplit(" ", 1)[0] + "..."
body.text_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
```

Reason: the shrunken font size is computed by PowerPoint at render time, not written by python-pptx.

**Styling a table cell through a non-existent font attribute**

```python
# Bad: AttributeError, cells have no .font
cell.font.size = Pt(11)

# Good: go through the cell's text frame runs
cell.text_frame.paragraphs[0].runs[0].font.size = Pt(11)
```

Reason: formatting lives on runs, and a cell reaches them through its text frame.

**Stretching images**

```python
# Bad: forces the picture into the box, distorting it
slide.shapes.add_picture(p, Inches(1), Inches(1),
                         width=Inches(6), height=Inches(4.5))

# Good: pass one dimension and let the other scale
slide.shapes.add_picture(p, Inches(1), Inches(1), width=Inches(6))
```

Reason: python-pptx preserves the native aspect ratio only when exactly one dimension is given.

**Mismatched chart series length**

```python
# Bad: 4 categories, 3 values
chart_data.categories = ["Q1", "Q2", "Q3", "Q4"]
chart_data.add_series("2026", (21.7, 23.9, 26.4))

# Good: one value per category
chart_data.add_series("2026", (21.7, 23.9, 26.4, 30.1))
```

Reason: the chart part is written without validation and PowerPoint silently truncates it.

**Saving over a file that is open in PowerPoint**

```python
# Bad: the save succeeds, the viewer keeps the stale copy
prs.save("out/deck.pptx")

# Good: write a new file, then swap it in once nothing has it open
prs.save("out/deck.tmp.pptx")
os.replace("out/deck.tmp.pptx", "out/deck.pptx")
```

Reason: an open file hides the change and makes the run look like a no-op.

## See also

- `SKILL.md` in this directory: the twelve core rules, the fit estimator, and the batch-generation pattern.
- python-pptx docs: "Working with Presentations", "Understanding Shapes", "Text handling", and the `chart` API reference.
- Office Open XML: the `<p:timing>` and diagram parts, if you ever need to confirm why animations and SmartArt are out of scope.

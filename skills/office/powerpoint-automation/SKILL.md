---
name: powerpoint-automation
description: Use when generating a .pptx deck in code. Build slides with python-pptx from a template, placeholders, tables, charts.
---

Generate PowerPoint decks programmatically with python-pptx: start from a corporate template so theme fonts and colors come for free, fill layout placeholders instead of hand-placing textboxes, and size text against the box before you write it.

## Setup

```bash
python3 -m pip install python-pptx
```

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
```

## Core rules

### 1. Never pass raw numbers as positions; every length is an EMU

python-pptx measures everything in English Metric Units (914400 EMU per inch, 12700 per point). A bare integer is read as EMU, so `left=1` places the shape 1/914400 of an inch from the edge, which looks like zero.

```python
# Bad: 1 EMU, not 1 inch. The shape lands in the corner.
slide.shapes.add_textbox(1, 1, 4, 2)

# Good: helpers convert to EMU for you
slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(2))
```

Read values back as floats with the unit properties:

```python
shape = slide.shapes[0]
print(shape.width)          # 3657600 (EMU)
print(shape.width.inches)   # 4.0
print(shape.width.pt)       # 288.0
print(Emu(914400).cm)       # 2.54
```

### 2. Start from a corporate template, not `Presentation()`

`Presentation()` with no argument loads the default 4:3 Office theme. A template carries the slide size, master, theme fonts, color scheme, and branded layouts, so every shape you add inherits the right look without you setting a single font.

```python
# Bad: default theme, 4:3, you now hand-style every run forever
prs = Presentation()

# Good: inherit the brand
prs = Presentation("templates/corporate-16x9.pptx")
print(prs.slide_width.inches, prs.slide_height.inches)  # 13.333 7.5
```

Strip a template down to an empty starting file once, keep it in the repo, and never edit it from code.

### 3. Print the layout and placeholder map before writing any slide code

Layout indexes differ per template. Discover them instead of guessing.

```python
for i, layout in enumerate(prs.slide_layouts):
    print(i, layout.name)
    for ph in layout.placeholders:
        print("   idx", ph.placeholder_format.idx,
              ph.placeholder_format.type, ph.name)
```

```
0 Title Slide
   idx 0 CENTER_TITLE (13) Title 1
   idx 1 SUBTITLE (4) Subtitle 2
1 Title and Content
   idx 0 TITLE (13) Title 1
   idx 1 BODY (2) Content Placeholder 2
```

Address placeholders by `idx`, never by position in `slide.placeholders`, because iteration order is not guaranteed to match visual order.

```python
# Bad: breaks the moment the template reorders shapes
slide.placeholders[1].text = "Body"

# Good: idx is stable and lives in the template XML
body = next(p for p in slide.placeholders
            if p.placeholder_format.idx == 1)
body.text_frame.text = "Body"
```

### 4. Fill placeholders instead of adding free-floating textboxes

A placeholder inherits font family, size, color, bullet glyphs, and autofit from the layout and master. A textbox inherits nothing, so it renders in the Office default (Calibri 18pt black) and drifts from the deck as soon as the brand changes.

```python
# Bad: unstyled box that ignores the theme
tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(1))
tb.text_frame.text = "Q3 Revenue"

# Good: the layout owns the styling
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Q3 Revenue"
```

Use a textbox only for genuinely one-off decoration (a callout, a footnote) that no layout provides.

### 5. Build bullet hierarchies with `paragraph.level`, not indent characters

`text_frame.text` sets the first paragraph. Every further bullet is a new paragraph with `level` 0 to 8, and each level picks up its own size and glyph from the master.

```python
tf = body.text_frame
tf.text = "Revenue up 14% YoY"          # level 0, paragraph 0

p = tf.add_paragraph()
p.text = "EMEA drove 9 points of it"
p.level = 1

p = tf.add_paragraph()
p.text = "Germany and Nordics only"
p.level = 2
```

```python
# Bad: fake indentation, no real outline, breaks in outline view
tf.text = "Revenue up 14% YoY\n    - EMEA drove 9 points"
```

### 6. Assume text will overflow, and estimate before you write

PowerPoint's "shrink text on overflow" is computed by the PowerPoint rendering engine, not by python-pptx. python-pptx can set the autofit flag, but it cannot recompute the shrunken font size, so a file written with overflowing text opens with text spilling out of the box until a human clicks into it.

```python
# Bad: hope it fits
body.text_frame.text = long_paragraph

# Good: cap the content, then set the flag
from pptx.enum.text import MSO_AUTO_SIZE

def fits(text, box_width_in, box_height_in, font_pt):
    # average glyph is ~0.52 of the font size wide, 1.2 line spacing
    chars_per_line = int(box_width_in * 72 / (font_pt * 0.52))
    lines = sum(max(1, -(-len(line) // chars_per_line))
                for line in text.split("\n"))
    return lines * font_pt * 1.2 <= box_height_in * 72

if not fits(long_paragraph, 9.0, 4.5, 18):
    long_paragraph = long_paragraph[:600].rsplit(" ", 1)[0] + "..."

tf = body.text_frame
tf.word_wrap = True
tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
tf.text = long_paragraph
```

The estimator is deliberately conservative. When a slide must be exact, split the content across two slides rather than trusting autofit.

### 7. Style tables through the cell's text frame, header row separately

`add_table` returns a `GraphicFrame`; the table is on `.table`. Column widths are set per column, row heights per row, both in EMU.

```python
rows, cols = len(data) + 1, len(headers)
gf = slide.shapes.add_table(rows, cols, Inches(0.6), Inches(1.6),
                            Inches(12), Inches(0.4 * rows))
table = gf.table
table.columns[0].width = Inches(5)
for c in range(1, cols):
    table.columns[c].width = Inches(7 / (cols - 1))

for c, head in enumerate(headers):
    cell = table.cell(0, c)
    cell.text = head
    run = cell.text_frame.paragraphs[0].runs[0]
    run.font.bold = True
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

for r, row in enumerate(data, start=1):
    for c, value in enumerate(row):
        cell = table.cell(r, c)
        cell.text = str(value)
        cell.text_frame.paragraphs[0].runs[0].font.size = Pt(11)
```

```python
# Bad: there is no cell.font; this raises AttributeError
cell.font.size = Pt(11)
```

Merge with `table.cell(0, 0).merge(table.cell(0, 2))`.

### 8. Charts take a ChartData object, never a list of lists

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = ["Q1", "Q2", "Q3", "Q4"]
chart_data.add_series("2025", (18.2, 19.4, 21.0, 24.6))
chart_data.add_series("2026", (21.7, 23.9, 26.4, 30.1))

gf = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(0.8), Inches(1.5), Inches(11.5), Inches(5),
    chart_data,
)
chart = gf.chart
chart.has_legend = True
chart.legend.include_in_layout = False
chart.plots[0].gap_width = 60
```

Every series must have exactly as many values as there are categories; a mismatch writes a corrupt chart part that PowerPoint silently truncates.

### 9. Preserve image aspect ratio by passing one dimension

Passing both `width` and `height` stretches the image. Pass one and python-pptx scales the other.

```python
# Bad: distorts anything that is not exactly 4:3
slide.shapes.add_picture(path, Inches(1), Inches(1),
                         width=Inches(6), height=Inches(4.5))

# Good: scale to a bounding box, keeping the ratio
from PIL import Image

def place_image(slide, path, left_in, top_in, max_w_in, max_h_in):
    w_px, h_px = Image.open(path).size
    scale = min(max_w_in / w_px, max_h_in / h_px)
    pic = slide.shapes.add_picture(path, Inches(left_in), Inches(top_in),
                                   width=Inches(w_px * scale))
    # center inside the box
    pic.left = Inches(left_in + (max_w_in - pic.width.inches) / 2)
    pic.top = Inches(top_in + (max_h_in - pic.height.inches) / 2)
    return pic
```

If Pillow is not available, add the picture with only `width` set and read back `pic.height` to check it against the box.

### 10. Put the script, not the slide, in the speaker notes

```python
notes = slide.notes_slide.notes_text_frame
notes.text = "Open with the EMEA number. Do not read the table aloud."
```

Accessing `slide.notes_slide` creates the notes part on first use, so guard nothing; just write it.

### 11. python-pptx cannot create animations, transitions, or SmartArt

The library does not model the `<p:timing>` tree, slide transitions, or SmartArt diagram parts. Do not attempt to fake them with raw XML in a generator you have to maintain.

Do this instead:
- Put the animations and transitions in the **template's layouts** by hand once; slides created from those layouts keep them.
- Replace SmartArt with a table or a set of grouped autoshapes you build in code.
- For build-in style reveals, generate N nearly identical slides (a "poor man's build") and let PowerPoint advance them.

### 12. Batch generation: one data row in, one slide out

```python
def build_deck(records, template, out_path):
    prs = Presentation(template)
    title_layout, content_layout = prs.slide_layouts[0], prs.slide_layouts[1]

    cover = prs.slides.add_slide(title_layout)
    cover.shapes.title.text = "Regional Performance"
    cover.placeholders[1].text = "Generated automatically"

    for rec in records:
        slide = prs.slides.add_slide(content_layout)
        slide.shapes.title.text = rec["region"]
        body = next(p for p in slide.placeholders
                    if p.placeholder_format.idx == 1).text_frame
        body.text = f"Revenue: ${rec['revenue']:,.0f}"
        for note in rec["highlights"]:
            p = body.add_paragraph()
            p.text = note
            p.level = 1
        slide.notes_slide.notes_text_frame.text = rec.get("script", "")

    prs.save(out_path)
    return out_path
```

Keep the data shaping and the slide building in separate functions so you can unit test the data half without opening PowerPoint.

## Anti-patterns

- Building a deck from `Presentation()` and then hand-setting fonts on every run.
- Indexing `slide.placeholders[n]` by position instead of filtering on `placeholder_format.idx`.
- Passing both `width` and `height` to `add_picture`.
- Writing unbounded text into a fixed placeholder and trusting autofit.
- Calling `prs.save()` to a path that is open in PowerPoint (the write succeeds, the file is locked, and the change is invisible).
- Editing the template from the generator script, which makes the branded source drift.

## When to use this skill

Use it when:
- A report or deck must be produced repeatedly from data (weekly metrics, per-client summaries).
- A deck needs to stay on-brand across dozens of generated slides.
- Someone is copy-pasting slides by hand more than once a month.

Skip it when:
- The deck is a one-off narrative that a human will design anyway.
- The output needs animations, transitions, or SmartArt as its core value.
- A PDF or HTML report would serve the audience better.

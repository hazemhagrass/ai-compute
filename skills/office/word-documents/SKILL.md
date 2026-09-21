---
name: word-documents
description: Use when creating or editing .docx files. Build Word documents with python-docx using styles, templates, tables and sections.
---

Generate and edit Word documents with `python-docx` so the output is themable, reviewable, and survives being opened in real Word: formatting lives on runs, appearance comes from named styles, and structure comes from a template.

```bash
pip install python-docx   # import name is `docx`, package name is `python-docx`
```

## The object model, in the order you will need it

```
Document
  .sections[]      page size, margins, headers, footers
  .paragraphs[]    block text; .style = named style; .runs[] = spans with .font
  .tables[]        .rows[] / .columns[] / .cell(r, c)
  .styles[]        style catalogue inherited from the template
```

## Rules

### 1. Put character formatting on runs, never on the paragraph

A paragraph has no bold. Word stores character formatting in run properties, so `paragraph.add_run()` is the only place bold, italic, size, and color can live. `paragraph.style` sets block-level appearance (spacing, outline level, default font) and is a different thing.

```python
# Bad: there is no paragraph-level bold, this raises AttributeError
p = doc.add_paragraph("Total due: 1,200.00")
p.bold = True

# Good: split the sentence into runs and format each run
p = doc.add_paragraph()
p.add_run("Total due: ")
amount = p.add_run("1,200.00")
amount.bold = True
amount.font.size = Pt(12)
```

### 2. Every edit that changes appearance should change a style, not a run

Hard-coded fonts and sizes cannot be restyled later and will not follow the document theme. Name the intent, then let the style carry the look.

```python
# Bad: appearance welded into 400 runs
for line in rows:
    r = doc.add_paragraph().add_run(line)
    r.font.name = "Calibri"
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

# Good: define once, apply by name, restyle the whole document in one edit
from docx.enum.style import WD_STYLE_TYPE
style = doc.styles.add_style("Fine Print", WD_STYLE_TYPE.PARAGRAPH)
style.base_style = doc.styles["Body Text"]
style.font.size = Pt(9)
style.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
for line in rows:
    doc.add_paragraph(line, style="Fine Print")
```

### 3. Start from a template .docx to inherit styles

`Document()` with no argument loads python-docx's own minimal default template, which has a thin style catalogue and none of your branding. Passing a path makes that file the starting point: styles, theme, numbering, headers, and section setup all come along.

```python
doc = Document("templates/company-letter.docx")   # inherits the full style set
# Clear placeholder body content but keep styles and section setup
for p in list(doc.paragraphs):
    p._element.getparent().remove(p._element)
doc.add_paragraph("Quarterly Report", style="Title")
doc.save("out/report.docx")
```

Referencing a style that the template does not define raises `KeyError`. List what you actually have before using it:

```python
print([s.name for s in doc.styles if s.type == WD_STYLE_TYPE.PARAGRAPH])
```

### 4. Use heading styles, not big bold text

`doc.add_heading(text, level=n)` applies `Heading n`, which sets the outline level. Outline level is what drives the navigation pane, PDF bookmarks, and the table of contents. Bold 18pt body text produces none of those.

```python
# Bad: looks like a heading, is invisible to the TOC
r = doc.add_paragraph().add_run("Methodology")
r.bold = True
r.font.size = Pt(18)

# Good
doc.add_heading("Methodology", level=1)
```

### 5. A table of contents must be inserted as a field, and python-docx cannot refresh it

python-docx has no TOC API and no field-calculation engine. You can write the `TOC` field, but the page numbers stay empty until something recalculates it. Insert the field plus a "dirty" flag so Word offers to update it on open.

```python
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def add_toc(doc, levels="1-3"):
    """Insert a TOC field. Word recalculates it on open (Update Field / F9)."""
    p = doc.add_paragraph()
    run = p.add_run()._r
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    begin.set(qn("w:dirty"), "true")          # asks Word to refresh on open
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f'TOC \\o "{levels}" \\h \\z \\u'
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose Update Field to build this."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, sep, placeholder, end):
        run.append(el)
```

For an unattended pipeline that needs real page numbers, recalculate outside python-docx:

```bash
# Headless LibreOffice resolves fields while converting
libreoffice --headless --convert-to pdf out/report.docx --outdir out/
```

### 6. Style tables through `table.style`, and merge with `cell.merge`

Manual borders on every cell are unmaintainable and ignore the theme. Built-in style names like `"Table Grid"` and `"Light Grid Accent 1"` only exist if the template defines them.

```python
data = [("Region", "Q1", "Q2"), ("EMEA", "412", "538"), ("APAC", "301", "377")]

table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
table.autofit = True
for cell, text in zip(table.rows[0].cells, data[0]):
    cell.text = ""
    cell.paragraphs[0].add_run(text).bold = True
for region, q1, q2 in data[1:]:
    row = table.add_row().cells
    row[0].text, row[1].text, row[2].text = region, q1, q2
# Merge a new spanning title row
title_row = table.add_row()
merged = title_row.cells[0].merge(title_row.cells[2])
merged.text = "Totals follow"
```

Merging is destructive: the merged cell keeps the concatenated text of its sources. Set `cell.text` after merging, not before.

### 7. Know the difference between a page break and a section break

A page break moves text to the next page inside the same section, so margins, orientation, headers, and page numbering are unchanged. A section break starts a new section, which is the only way to change any of those mid-document.

```python
from docx.enum.text import WD_BREAK
from docx.enum.section import WD_SECTION, WD_ORIENT
from docx.shared import Inches

# Page break: same layout, next page
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# Section break: new layout rules from here on
section = doc.add_section(WD_SECTION.NEW_PAGE)
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width, section.page_height = section.page_height, section.page_width
section.left_margin = Inches(0.5)
```

Swapping `page_width` and `page_height` yourself is required: setting `orientation` alone changes a flag, not the dimensions.

### 8. Headers and footers belong to a section

```python
section = doc.sections[0]
section.different_first_page_header_footer = True
header = section.header
header.paragraphs[0].text = "Acme Corp: Confidential"
header.paragraphs[0].style = doc.styles["Header"]
section.footer.paragraphs[0].text = "Page "   # see the note on page numbers
```

Page numbers are a field, like the TOC, so they need the same `w:fldChar` treatment with `instrText` set to `PAGE`. By default a new section links its header to the previous one; set `section.header.is_linked_to_previous = False` before editing it independently.

### 9. Size images explicitly, with one dimension only

An image inserted at native size is scaled by its stored DPI, which is often wrong and can overflow the page. Give exactly one of `width` or `height` so python-docx preserves the aspect ratio.

```python
# Good: aspect ratio kept (Inches from docx.shared)
doc.add_picture("assets/chart.png", width=Inches(6.0))

# Bad: both dimensions set, the image is distorted
doc.add_picture("assets/chart.png", width=Inches(6.0), height=Inches(2.0))
```

To center it, style the containing paragraph, since the picture is a run inside it:

```python
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc.add_picture("assets/chart.png", width=Inches(6.0))
doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### 10. Find and replace must handle text split across runs

This is the single most common python-docx bug. Word splits a paragraph into runs at every formatting boundary, and also arbitrarily after spell-check or editing, so `"{{customer_name}}"` can be stored as `"{{cust"`, `"omer"`, `"_name}}"`. Per-run replacement silently misses it.

```python
# Bad: misses any placeholder that spans a run boundary
for p in doc.paragraphs:
    for run in p.runs:
        run.text = run.text.replace("{{name}}", "Dana Reid")

# Good: join, replace, write back
def replace_in_paragraph(paragraph, old, new):
    """Replace across run boundaries, keeping the first run's formatting."""
    full = "".join(run.text for run in paragraph.runs)
    if old not in full:
        return False
    full = full.replace(old, new)
    for run in paragraph.runs[1:]:
        run.text = ""              # blank the rest, keep run 1's formatting
    if paragraph.runs:
        paragraph.runs[0].text = full
    else:
        paragraph.add_run(full)
    return True

def replace_everywhere(doc, mapping):
    """Body paragraphs, table cells (recursively), headers and footers."""
    def walk(paragraphs):
        for p in paragraphs:
            for old, new in mapping.items():
                replace_in_paragraph(p, old, str(new))
    def walk_tables(tables):
        for table in tables:
            for row in table.rows:
                for cell in row.cells:
                    walk(cell.paragraphs)
                    walk_tables(cell.tables)
    walk(doc.paragraphs)
    walk_tables(doc.tables)
    for section in doc.sections:
        for part in (section.header, section.footer,
                     section.first_page_header, section.first_page_footer):
            walk(part.paragraphs)
            walk_tables(part.tables)
```

The collapse-to-first-run trick loses mixed formatting inside the paragraph. When a paragraph mixes bold and plain text around a placeholder, keep the placeholder inside a single run in the template so no collapse is needed.

### 11. Mail merge: one template, many documents

```python
import csv
from copy import deepcopy
from docx import Document

with open("data/recipients.csv", newline="", encoding="utf-8") as fh:
    recipients = list(csv.DictReader(fh))
for row in recipients:
    doc = Document("templates/offer-letter.docx")   # reload per document
    replace_everywhere(doc, {
        "{{name}}": row["name"],
        "{{role}}": row["role"],
        "{{salary}}": f"{int(row['salary']):,}",
        "{{start_date}}": row["start_date"],
    })
    doc.save("out/offer-{}.docx".format(row["name"].lower().replace(" ", "-")))
```

Reload the template for each recipient. Reusing one `Document` object leaks the previous recipient's values into the next file, because replacement is in place.

To concatenate many rendered bodies into one file, copy the body XML and insert a page break between blocks:

```python
def append_body(target, source):
    target.add_section(WD_SECTION.NEW_PAGE)
    for element in source.element.body:
        if element.tag.endswith("sectPr"):
            continue                      # never copy section properties
        target.element.body.append(deepcopy(element))
```

### 12. Tracked changes and comments are out of scope

python-docx has no API for revision marks (`w:ins`, `w:del`) or comments (`comments.xml`), and it does not preserve them reliably through a load and save cycle. Accept or reject revisions before automating a file. If a review trail is required, use Word automation (COM on Windows), the Microsoft Graph API, or hand-written OOXML, and say so instead of faking it.

## Anti-patterns

- Setting `run.font.name` for CJK or complex-script text without also setting `w:eastAsia` on `rPr`; the glyphs fall back to a default font.
- Calling `doc.add_paragraph(text, style="MyStyle")` before the style exists; it raises `KeyError`, so add styles first.
- Editing a .docx by unzipping and string-replacing the XML; it corrupts relationship ids for images and hyperlinks.
- Assuming `len(doc.paragraphs)` counts text inside tables; it does not, table paragraphs live under `table.rows[].cells[].paragraphs`.
- Writing page numbers as literal text; they go stale the moment content shifts.
- Saving over the template file. Always write to a separate output path.

## When to use this skill

Use it when generating reports, contracts, letters, or offer packs as .docx, when filling a corporate template from data, or when programmatically editing an existing Word file.

Skip it when the deliverable is really a PDF with no editing requirement (render from HTML or LaTeX instead), when you need tracked changes or comments, or when the layout is genuinely a spreadsheet.

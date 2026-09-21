# Word Documents

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for generating and editing Microsoft Word `.docx` files with `python-docx` so the result is themable, template-driven, and opens cleanly in real Word.

## What it does

Gives an agent the working model and the non-obvious rules for programmatic Word output:

- The paragraph/run model, and why character formatting can only live on runs.
- Named styles instead of hard-coded fonts, so a document can be restyled in one edit.
- Starting from a template `.docx` to inherit the full style catalogue, theme, and section setup.
- Heading styles and a real table of contents field, including the limitation that python-docx cannot recalculate it and the headless LibreOffice workaround.
- Tables with built-in styles, cell merging, and header rows.
- Sections versus page breaks, and per-section headers and footers.
- Images sized on one axis so aspect ratio survives.
- Find and replace that works when a placeholder is split across runs, which is the single most common python-docx bug.
- Mail-merge generation from a CSV or any row source.
- An explicit boundary: tracked changes and comments are out of scope for python-docx.

## When to use this

Concrete triggers:

- You need to emit reports, contracts, invoices, offer letters, or meeting packs as `.docx`.
- A corporate template exists and must be filled from data without losing its branding.
- An existing Word file needs programmatic editing (rename a party, update figures, append a section).
- Placeholders like `{{customer_name}}` are not being replaced even though they are visibly in the file.
- A generated document's table of contents or page numbers are blank.
- One document must mix portrait and landscape pages, or change margins partway through.

Skip it when:

- The deliverable is a read-only PDF with no editing requirement; render from HTML or LaTeX instead.
- You need tracked changes, comments, or revision history; python-docx cannot do these.
- The content is tabular data for analysis, which belongs in `.xlsx`.
- You only need to read text out of a `.docx`; a plain extractor is lighter.

## Quick start

One script that builds a complete styled report: template-derived styles, a title, a TOC field, headings, a styled table with a merged row, a sized image, and a landscape appendix.

```python
from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

def add_toc(doc, levels="1-3"):
    p = doc.add_paragraph()
    run = p.add_run()._r
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    begin.set(qn("w:dirty"), "true")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f'TOC \\o "{levels}" \\h \\z \\u'
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Update this field in Word to build the table of contents."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, sep, placeholder, end):
        run.append(el)

doc = Document()          # swap for Document("templates/brand.docx") in production

# 1. One custom style, so captions can be restyled globally later
caption = doc.styles.add_style("Figure Caption", WD_STYLE_TYPE.PARAGRAPH)
caption.base_style = doc.styles["Normal"]
caption.font.size = Pt(9)
caption.font.italic = True
caption.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

# 2. Header and footer live on the section
section = doc.sections[0]
section.header.paragraphs[0].text = "Acme Corp: Q3 Revenue Review"

# 3. Title page and TOC
doc.add_paragraph("Q3 Revenue Review", style="Title")
doc.add_paragraph("Prepared by Analytics, October 2026", style="Subtitle")
doc.add_heading("Contents", level=1)
add_toc(doc)
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# 4. Body: heading styles drive the TOC, runs carry emphasis
doc.add_heading("Summary", level=1)
p = doc.add_paragraph("Revenue reached ")
hero = p.add_run("4.2M")
hero.bold = True
hero.font.size = Pt(12)
p.add_run(" across both regions, up 19% quarter over quarter.")

# 5. Table with a built-in style, a bold header row and a merged total row
doc.add_heading("By region", level=2)
rows = [("EMEA", 2_410_000, 0.21), ("APAC", 1_790_000, 0.16)]
table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
for cell, label in zip(table.rows[0].cells, ("Region", "Revenue", "Growth")):
    cell.text = ""
    cell.paragraphs[0].add_run(label).bold = True
for region, revenue, growth in rows:
    cells = table.add_row().cells
    cells[0].text = region
    cells[1].text = f"{revenue:,}"
    cells[2].text = f"{growth:.0%}"
total_row = table.add_row()
merged = total_row.cells[0].merge(total_row.cells[1])
merged.text = "Total"                      # set text AFTER merging
merged.paragraphs[0].runs[0].bold = True
total_row.cells[2].text = f"{sum(r[1] for r in rows):,}"

# 6. An image, one dimension only, centered via its paragraph
doc.add_heading("Trend", level=2)
try:
    doc.add_picture("assets/trend.png", width=Inches(6.0))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("Figure 1: monthly revenue.", style="Figure Caption")
except FileNotFoundError:
    doc.add_paragraph("Figure 1 pending.", style="Figure Caption")

# 7. Landscape appendix needs a SECTION break, not a page break
appendix = doc.add_section(WD_SECTION.NEW_PAGE)
appendix.orientation = WD_ORIENT.LANDSCAPE
appendix.page_width, appendix.page_height = appendix.page_height, appendix.page_width
appendix.header.is_linked_to_previous = False
appendix.header.paragraphs[0].text = "Appendix A"
doc.add_heading("Appendix A: raw figures", level=1)

doc.save("out/q3-review.docx")
```

Resolve the TOC and page-number fields without opening Word:

```bash
libreoffice --headless --convert-to pdf out/q3-review.docx --outdir out/
```

## Key concepts

- **Paragraph vs run.** A paragraph is a block; a run is a span of identical character formatting inside it. Bold, italic, size, and color exist only on runs. `paragraph.style` controls block-level appearance.
- **Named style.** A reusable definition in the document's style catalogue. Applying `style="Body Text"` means the look can change later in one place, and the document follows the Word theme.
- **Template inheritance.** `Document("brand.docx")` starts from that file, bringing its styles, theme, numbering, and section setup. `Document()` starts from python-docx's minimal default with a thin style set.
- **Outline level.** What `Heading 1..9` sets and plain bold text does not. It drives the navigation pane, PDF bookmarks, and the TOC.
- **Field.** A placeholder Word calculates at open or refresh time: `TOC`, `PAGE`, `NUMPAGES`. python-docx can write the field XML but has no calculation engine, so values stay empty until Word or LibreOffice recalculates.
- **Section.** The unit that owns page size, orientation, margins, headers, and footers. Changing any of them mid-document requires a new section, not a page break.
- **Run splitting.** Word freely fragments a paragraph into runs, so a literal string in the file may be spread over several runs. Any text search must join run text first.

## Common pitfalls

**Setting formatting on the paragraph**

```python
# Bad: paragraphs have no bold attribute
doc.add_paragraph("Warning").bold = True

# Good: format the run
doc.add_paragraph().add_run("Warning").bold = True
```

Character formatting is stored in run properties in OOXML; there is nowhere on a paragraph to put it.

**Fake headings**

```python
# Bad: invisible to the TOC and navigation pane
r = doc.add_paragraph().add_run("Methodology")
r.bold = True
r.font.size = Pt(18)

# Good
doc.add_heading("Methodology", level=1)
```

Only real heading styles set the outline level that a TOC reads.

**Expecting the TOC to be populated**

```python
# Bad: assume the saved file shows page numbers
add_toc(doc); doc.save("report.docx")   # TOC body is empty

# Good: mark the field dirty, then recalculate outside python-docx
# libreoffice --headless --convert-to pdf report.docx
```

python-docx writes field instructions but never evaluates them.

**Per-run find and replace**

```python
# Bad: misses "{{name}}" stored as "{{na" + "me}}"
for run in p.runs:
    run.text = run.text.replace("{{name}}", "Dana")

# Good: join the runs, replace, write back into the first run
full = "".join(r.text for r in p.runs).replace("{{name}}", "Dana")
for r in p.runs[1:]:
    r.text = ""
p.runs[0].text = full
```

Word splits runs at every formatting boundary and after editing, so placeholders straddle them.

**Replacing only body paragraphs**

```python
# Bad: leaves placeholders in tables, headers and footers
for p in doc.paragraphs: ...

# Good: also walk table cells (recursively) and every section's header/footer
```

`doc.paragraphs` excludes anything inside a table, header, or footer.

**Reusing one Document across a mail merge**

```python
# Bad: replacement is in place, so row 2 inherits row 1's values
doc = Document("template.docx")
for row in rows: render(doc, row); doc.save(...)

# Good: reload the template per output file
for row in rows:
    doc = Document("template.docx"); render(doc, row); doc.save(...)
```

Nothing resets the document between iterations.

**Orientation without swapping dimensions**

```python
# Bad: sets a flag, page stays 8.5 x 11
section.orientation = WD_ORIENT.LANDSCAPE

# Good
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width, section.page_height = section.page_height, section.page_width
```

python-docx does not derive the dimensions from the orientation flag.

**Both image dimensions given**

```python
# Bad: distorts the picture
doc.add_picture("chart.png", width=Inches(6), height=Inches(2))

# Good: one axis, aspect ratio preserved
doc.add_picture("chart.png", width=Inches(6))
```

**Setting merged cell text before merging**

```python
# Bad: source texts get concatenated into the merged cell
row.cells[0].text = "Total"; row.cells[0].merge(row.cells[2])

# Good
row.cells[0].merge(row.cells[2]).text = "Total"
```

**Promising tracked changes**

```python
# Bad: there is no python-docx API for w:ins / w:del or comments.xml
# Good: accept revisions first, or use Word COM automation / Microsoft Graph,
#       and tell the user python-docx cannot do it
```

## See also

- `SKILL.md` in this directory: the twelve rules, the TOC field helper, the run-safe replace helpers, and the mail-merge loop.
- python-docx documentation: "Working with Text", "Working with Tables", "Working with Sections", and the `styles` API reference.
- ECMA-376 (Office Open XML) `w:p`, `w:r`, `w:fldChar`, and `w:sectPr` for anything the library does not expose.
- `libreoffice --headless --convert-to pdf` for resolving fields and producing a final PDF in CI.

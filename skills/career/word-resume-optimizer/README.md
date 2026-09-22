# Word Resume Optimizer

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="word-resume-optimizer robot" width="200">
</div>

Make a Microsoft Word resume that survives machine text extraction and still reads well to a human.

## What it does

An applicant tracking system never sees your document. It sees a string produced
by an extractor that walks the underlying XML and concatenates text runs.
Word's nicest layout features, text boxes, tables, headers and columns, either
sit outside that walk or scramble its order.

This skill covers the `.docx` mechanics:

- Which Word constructs silently lose content, with the extraction output to prove it.
- Using real Heading styles so a parser can segment your document.
- Section headings, date formats and bullet glyphs that parse.
- Font choices, embedding, and why `.doc` is a dead end.
- Choosing `.docx` or PDF on evidence rather than superstition.
- Verifying the file yourself with `unzip` and `python-docx` before you send it.
- Keyword alignment against a posting without stuffing.

It does not cover what the resume should say. Bullet structure, quantified
impact and the content rules live in the sibling LaTeX resume skill, linked at
the bottom.

## When to use this

Reach for it when:

- You are writing or editing a resume in Word and it will go through an online portal.
- A resume "disappeared" after upload, or a portal's parsed-fields preview came back with empty or garbled sections.
- Someone handed you a visually elaborate template with sidebars, icons or skill bars.
- You are generating resumes programmatically and need the output to be parseable.
- You are choosing between submitting `.docx` and PDF.

Skip it when you control the whole pipeline and nobody machine-reads the file,
for example a resume you only ever hand to people on paper.

## Quick start

Build a linear document with real styles, then extract it back and read the
result.

```python
# build.py
from docx import Document

d = Document()
d.add_paragraph("Pat Lee", style="Title")
d.add_paragraph("pat@example.com | +1 555 0100 | Seattle, WA | linkedin.com/in/patlee")

d.add_paragraph("Work Experience", style="Heading 1")
d.add_paragraph("Senior Engineer, Acme Corp", style="Heading 2")
d.add_paragraph("Mar 2021 - Present")
d.add_paragraph(
    "Cut p95 checkout latency from 1.9s to 640ms by replacing per-item "
    "queries with a batched loader.",
    style="List Bullet",
)

d.add_paragraph("Skills", style="Heading 1")
d.add_paragraph("Go, Postgres, Kubernetes, Redis, Terraform")
d.save("Pat-Lee-Resume.docx")
```

```python
# lint.py: this is what an ATS effectively sees
from docx import Document

d = Document("Pat-Lee-Resume.docx")
for p in d.paragraphs:
    if p.text.strip():
        print(f"[{p.style.name}] {p.text}")
print("tables:", len(d.tables))
```

Running `lint.py` prints:

```
[Title] Pat Lee
[Normal] pat@example.com | +1 555 0100 | Seattle, WA | linkedin.com/in/patlee
[Heading 1] Work Experience
[Heading 2] Senior Engineer, Acme Corp
[Normal] Mar 2021 - Present
[List Bullet] Cut p95 checkout latency from 1.9s to 640ms by replacing per-item queries with a batched loader.
[Heading 1] Skills
[Normal] Go, Postgres, Kubernetes, Redis, Terraform
```

Reading order intact, headings carrying real style names, `tables: 0`. That is
the pass condition.

Now the same content in a two-column table with the contact line in the page
header. The identical paragraph walk prints only:

```
tables: 1
```

Zero paragraphs. Name, phone, every job title and every date: gone, because a
body-paragraph walk never enters a table or a header part. Pulling the cells out
explicitly recovers the text, but in row-major order:

```
Go, Postgres, Kubernetes | Senior Engineer, Acme  Mar 2021 - Present
Redis, Terraform | Backend Lead, Globex  Jun 2018 - Feb 2021
```

A parser hunting for a job title now finds a string starting with "Go, Postgres".

Add a text box and it gets worse. A certifications line placed in one is absent
from the paragraph walk, absent from the table dump, and visible only by
grepping `word/document.xml` directly:

```bash
unzip -p resume.docx word/document.xml | grep -o '<w:t[^>]*>[^<]*' | sed 's/.*>//'
```

If a line appears in that grep but not in `lint.py`, it is content the employer
will never see.

## Key concepts

**Extraction order is the real layout.** The visual arrangement is decoration.
What matters is the sequence an extractor produces. Design so the two agree.

**Style semantics beat visual formatting.** A manually bolded 14pt line is a
`Normal` paragraph with decoration attached. `Heading 1` is a structural claim a
machine can act on. Restyle the built-in headings to change how they look while
keeping what they mean.

**Boring headings parse.** Parsers match section names against a fixed keyword
list. "Work Experience" is recognised. "Where I've Been" is a paragraph of prose.

**Dates need a month and an ASCII hyphen.** `Mar 2021 - Present` or
`03/2021 - Present`. Seasons, bare years and typographic dashes all cost you.

**Two readers, one file.** The parser runs first and decides whether a human
ever sees the document. Optimise for the parser without producing something a
human finds ugly, because both gates are real.

**Verify, do not assume.** Every claim in this skill was checked by building a
document and extracting it. Do the same to yours before submitting.

## Common pitfalls

**Skills in a sidebar text box.**
Bad: a right-hand text box listing certifications and tools.
Good: a plain `Skills` section, one `Heading 1` and one paragraph of
comma-separated terms.
Why: text-box content lives in `<w:txbxContent>`, outside the body flow. A
paragraph walk returns nothing for it, and the text box is fixed-size, so a PDF
export clips overflowing text as well. It loses in both directions.

**A table holding the whole layout.**
Bad: two columns, skills left, experience right, borders set to none.
Good: one linear column, skills as their own section below experience.
Why: invisible borders do not remove the grid from the XML. Cells extract
row-major, fusing unrelated content into single lines, and simple extractors
skip tables entirely.

**Contact details in the page header.**
Bad: name, email and phone in Word's header so they repeat on page two.
Good: the first two body paragraphs of page one.
Why: header text lives in `word/header1.xml`, a separate part that a body walk
never reads. You lose your own phone number. PDF export happens to rescue it,
but do not bet on the recipient accepting PDF.

**Word's default bullet character.**
Bad: clicking the bullet-list button and exporting straight to PDF.
Good: set the list glyph explicitly to `U+2022` in a Unicode text font, or
submit `.docx`.
Why: Word's default bullet is frequently `U+F0B7`, a Symbol-font private-use
codepoint. Harmless inside `.docx` because the glyph sits in `numbering.xml`,
but PDF extraction emits an unmapped character in front of every bullet.

**Skill rating graphics.**
Bad: `Python ●●●●○` or a bar chart of proficiencies.
Good: `Python (5 years, primary language at Acme)` in the skills line.
Why: images carry no extractable text, so the parser sees nothing. Reviewers
also discount self-assigned ratings, so you pay twice.

**Submitting `.doc` because a portal mentions "Word".**
Bad: saving as `.doc` for compatibility.
Good: `.docx`, noting the format in the cover note if the portal complains.
Why: `.doc` is an OLE2 binary from a different era. Modern tooling often fails
outright on it rather than degrading, so the upload can produce nothing at all.

**Pasting a keyword block at the bottom.**
Bad: a comma-separated wall of every term in the job posting.
Good: each true keyword appearing once in the bullet describing where you
actually used it, spelled the way the posting spells it.
Why: stuffing is detected, and a human reads the file immediately after the
parser does.

**Trusting the file because it looks right in Word.**
Bad: shipping after a visual proofread.
Good: running the paragraph walk and the `unzip` grep, and reading the portal's
parsed-fields preview after upload.
Why: the preview is the actual parser. Every heuristic here is a prediction of
what it will do; the preview is the answer.

## See also

- [latex-resume](../latex-resume/SKILL.md) for what the resume should say: bullet structure, quantified impact, and the LaTeX route when you own the toolchain.
- [excel-data-cleaning](../../office/excel-data-cleaning) for general `.docx` authoring and `python-docx` usage.
- [technical-writing](../../writing/technical-writing/SKILL.md) for tightening bullet prose.

---
name: word-resume-optimizer
description: Use when optimising a .docx resume for ATS parsers. Build linear Word documents whose text survives machine extraction and still reads well to a human.
---

# Word Resume Optimizer

A resume is read twice: once by a parser that flattens it to a string, once by a
human who skims it in about six seconds. Word gives you layout tools that serve
the second reader and destroy the first. This skill is about the mechanics of
getting both.

Scope: Microsoft Word `.docx` mechanics. For what the resume should *say*,
bullet structure, and quantified impact, see `skills/career/latex-resume/SKILL.md`,
which owns resume content and LaTeX typesetting. Do not duplicate it here.

## The core model

An ATS does not see your document. It sees the output of an extractor that walks
the XML and concatenates text runs. Anything the extractor skips is invisible,
and anything it reorders arrives scrambled. Your job is to make the extraction
order match the reading order.

Rule: if you cannot recover your own resume by running a text extractor over it,
neither can the employer.

## What actually breaks extraction

These are verified by building documents and extracting them back, not folklore.

### Text boxes: the worst offender

Content inside `<w:txbxContent>` is not part of the document body flow. A
paragraph walk over the document returns nothing for it. Extracting a document
whose certifications lived in a text box returned every other line and silently
dropped the certifications entirely. The text is present in `word/document.xml`,
so a grep finds it, but the common libraries that ATS vendors build on do not.

Worse, text boxes are fixed-size. Exporting that same document to PDF clipped
the box and the final word of the certification name was gone from the PDF too.
So the text box loses in both directions.

Never put content in a text box. Not skills, not contact details, not a "key
achievements" sidebar.

### Tables: content survives, order does not

Table cell text is reachable, but only if the parser looks for tables, and many
naive extractors iterate body paragraphs only and return nothing from a
table-based resume. Even when cells are read, a two-column layout is read
row-major. A skills column beside an experience column extracted as:

```
Go, Postgres, Kubernetes Senior Engineer, Acme Mar 2021 - Present
Redis, Terraform Backend Lead, Globex Jun 2018 - Feb 2021
```

The skill list and the job title fused into one line per row. A parser looking
for a job title now sees a string beginning with "Go, Postgres". Invisible
table borders do not help: the grid is in the XML regardless of stroke colour.

Use tables for nothing. If you want two visual columns of skills, use one
paragraph with comma-separated terms and let it wrap.

### Headers and footers

Header text lives in `word/header1.xml`, a separate part. A body paragraph walk
returns none of it. Contact details in the header are the classic way to lose
your own phone number. Interestingly, header text *does* survive PDF export and
PDF text extraction, so this is one failure mode that a PDF export repairs.
Do not rely on that. Put name, email, phone, city and profile links in the first
few body paragraphs of page one.

### Multi-column section layouts

Word's `Layout > Columns` produces a balanced-column flow. Extractors vary on
whether they reconstruct column order or interleave lines across the gutter.
The risk is unnecessary. A single column is also easier for a human to skim.

### Graphics, icons, photos, charts

A skills bar chart, a headshot, a little envelope icon before your email: none
of these carry extractable text. Anything meaningful rendered as an image is
gone. Rating dials ("Python ●●●●○") are doubly bad: no text, and no reviewer
believes them.

Drop images entirely unless applying in a market where a photo is conventional,
and even then never encode information in one.

## Use real Heading styles

Manually bolding a line and bumping it to 14pt produces a run with `<w:b/>` and
a font size. It produces no structure. Applying the built-in `Heading 1` style
stamps the paragraph with a style id that any extractor can read, which lets a
section-aware parser segment the document.

Verified difference on the same content: styled headings extract as
`[Heading 1] Work Experience` while the bolded version extracts as
`[Normal] Work Experience`, indistinguishable from a job description line.

Recommended structure:

- `Title` or `Heading 1` for your name.
- `Heading 1` for section names.
- `Heading 2` for each job title or degree.
- `List Bullet` for bullets, so the glyph lives in `numbering.xml` rather than
  as a literal character in your text.

Restyle the built-in headings to taste (colour, size, spacing). Redefining the
style keeps the semantics and changes only the look. That is the whole point of
styles.

## Section headings a parser recognises

Parsers match section names against a keyword list. Be boring.

| Use | Do not use |
| --- | --- |
| Work Experience, Professional Experience | Where I've Been, My Journey |
| Education | Academic Adventures |
| Skills, Technical Skills | Toolbox, Superpowers |
| Certifications | Badges |
| Projects | Things I Built |
| Summary, Professional Summary | About Me, Hello |

One heading per concept. Do not merge "Skills and Interests".

## Dates that parse

Write `Mar 2021 - Present` or `03/2021 - Present`. Both are unambiguous and
widely recognised.

Avoid: seasons (`Spring 2021`), bare years for jobs (`2021 - 2023` loses months
and reads as a gap-hiding move), ISO week-of-year, and non-ASCII dashes. Use an
ASCII hyphen as the range separator. Fancy dash characters are a common source
of mojibake in downstream systems.

Put the date on the same line as the title or on the line directly beneath it.
Never in a separate column, because that is a table.

## Bullet glyphs

Measured, by putting each glyph in a document and extracting the rendered PDF:

| Glyph | Result |
| --- | --- |
| `U+2022` bullet | Extracts cleanly. Use this. |
| `U+00B7` middle dot | Extracts cleanly. |
| `U+2023` triangular bullet | Extracts cleanly but unusual. |
| `-` ASCII hyphen | Extracts cleanly, looks cheap. |
| `U+F0B7` Symbol font bullet | Private-use codepoint. Extracts as an unmapped character. |

The last row is the trap, and it surprised me: Word's default bullet list
frequently renders as `U+F0B7`, a Symbol-font private-use character, not a real
bullet. In the `.docx` itself this is harmless because the glyph lives in
`numbering.xml` and never appears in the paragraph text. But export that file to
PDF and the extracted text carries a private-use codepoint in front of every
bullet. If you submit PDF, set the list bullet character explicitly to `U+2022`
in a Unicode text font.

## Fonts

Pick a font the receiving machine already has: Calibri, Cambria, Arial,
Helvetica, Georgia, Times New Roman, Garamond. Body text 10pt to 12pt.

Do not embed fonts in a resume. Embedding inflates the file, is stripped by some
pipelines, and buys nothing that a standard font does not already give you. If
you have used something exotic, the PDF export is what preserves it, at the cost
of everything below.

## .docx vs .doc

`.docx` is a ZIP of XML parts. `.doc` is an OLE2 compound binary from a
different era, and modern tooling often cannot open it at all: pointing a
current Word library at a converted `.doc` raises a package-not-found error
rather than degrading gracefully. Never submit `.doc`. If a portal demands it,
attach `.docx` and mention the format in the cover note.

## Should you submit .docx or PDF?

There is no universal answer, so decide on evidence.

Submit `.docx` when:

- The portal names it first, or the job post asks for "Word format".
- You cannot test the PDF export and the document uses list styles that may
  render private-use bullet glyphs.
- A recruiter will re-brand the document, which agencies routinely do.

Submit PDF when:

- Layout fidelity matters and the document is already linear.
- The document has a header you cannot move into the body, since PDF extraction
  recovers header text that `.docx` paragraph walks drop.
- The portal shows a PDF preview after upload, which lets you verify.

Always: if the portal offers a parsed-fields preview after upload, read it. That
is the actual parser, and it beats every heuristic in this file. Fix the source
document until the preview is right.

Never: submit both formats hoping one parses. Duplicate submissions get
deduplicated unpredictably.

## Verify by extracting

Do not guess. Extract.

```bash
# Every text node in the body, including text-box content a parser would miss
unzip -p resume.docx word/document.xml | grep -o '<w:t[^>]*>[^<]*' | sed 's/.*>//'

# Which parts exist at all (header1.xml and any media/ are warning signs)
unzip -l resume.docx
```

```python
from docx import Document

d = Document("resume.docx")
for p in d.paragraphs:
    if p.text.strip():
        print(f"[{p.style.name}] {p.text}")
print("tables:", len(d.tables))          # must be 0
```

Read the output as prose. If it reads top to bottom in the order you intended,
with section headings carrying real style names and zero tables, the document is
sound. Anything present in the `unzip` output but absent from the paragraph walk
is content a parser will lose.

For PDF submissions, run `pdftotext -raw resume.pdf -` and read that instead.

## Keyword alignment without stuffing

Take the job description, list its concrete nouns (tools, platforms, methods,
certifications), and check which ones are true of you. For each true one, make
sure the exact string appears at least once in natural prose, in the job or
project where you actually used it.

Match the posting's spelling: a parser matching on `Node.js` may not match
`NodeJS`. When both spellings are common, write one in a bullet and the other in
the skills line.

Do not: paste a keyword block, repeat terms, or hide white text. Keyword
stuffing is detected, and a human reads the document after the parser does.

## File naming

`Firstname-Lastname-Resume.pdf`. No spaces, no version numbers, no `final_v3`,
no the company's name unless asked. Some upload handlers mangle spaces and
non-ASCII characters in filenames.

## Generating programmatically

`python-docx` builds a compliant file and is also the fastest way to lint one.
Use real style names, never manual formatting:

```python
from docx import Document

d = Document()
d.add_paragraph("Pat Lee", style="Title")
d.add_paragraph("pat@example.com | +1 555 0100 | Seattle, WA")
d.add_paragraph("Work Experience", style="Heading 1")
d.add_paragraph("Senior Engineer, Acme Corp", style="Heading 2")
d.add_paragraph("Mar 2021 - Present")
d.add_paragraph(
    "Cut p95 checkout latency from 1.9s to 640ms by batching per-item queries.",
    style="List Bullet",
)
d.save("Pat-Lee-Resume.docx")
```

Then run the verification snippet above against the output before you send it.

## See also

- `skills/career/latex-resume/SKILL.md` for resume content, bullet structure,
  and quantified impact, plus the LaTeX route when you control the toolchain.
- `skills/office/word-documents/SKILL.md` for general Word document authoring.
- `skills/writing/technical-writing/SKILL.md` for tightening bullet prose.

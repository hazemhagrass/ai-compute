---
name: latex-resume
description: "Use when building a resume in LaTeX. Survive the ATS parser's text extraction while still reading well to a human."
---

# LaTeX Resume

A resume is read twice: once by a parser that flattens your PDF to a stream of
text, once by a person who spends about 30 seconds on it. Most LaTeX templates
optimize for the second reader and silently fail the first.

## Design for the text layer, not the page

An applicant tracking system (ATS) does not see your layout. It extracts the
PDF text layer, in the order the PDF stores it, and maps the result onto fields
like `name`, `title`, `company`, `dates`. Anything not in that stream is
invisible; anything stored out of order arrives scrambled.

- Multi column layouts merge columns. A smart extractor may recover the visual
  order, but one reading the raw content stream emits the columns interleaved,
  so a job title lands glued to an unrelated skill keyword.
- Text inside `tikzpicture` sits at absolute coordinates in node order, so the
  raw stream follows source order, not visual order.
- Headers and footers get dropped as boilerplate by many parsers, which is
  exactly where people put their phone number and email.
- Icons as glyphs or images carry no text, so the email beside a Font Awesome
  envelope loses its label and never matches the `email` field.
- Tables used for date alignment emit cell order, which is not visual order.

You can watch this happen. `pdftotext -raw` reads the content stream in storage
order, the pessimistic case a simple parser sees. A `tabular` pairing a skills
column against an experience column extracts as:

```text
Go, Postgres Senior Engineer, Acme 2021-Present
Kubernetes Cut latency 60%
Redis Backend Lead, Globex 2018-2021
```

Every role is now welded to a skill it has nothing to do with.

```latex
% Bad: absolute coordinates, no reading order
\begin{tikzpicture}
  \node at (0,0) {\Large Pat Lee};
  \node at (0,-0.6) {pat@example.com};
\end{tikzpicture}

% Good: plain text in the body
\begin{center}
  {\LARGE\bfseries Pat Lee}\\[2pt]
  pat@example.com \textbullet{} +1 555 0100 \textbullet{} Seattle, WA
\end{center}
```

## Use single column unless you have a parsed sample proving otherwise

Single column costs some whitespace and buys a text layer that extracts in
reading order on every parser. Two column is the most common reason a well
written resume scores badly, and the PDF looks fine either way.

- Put every section at full text width, stacked top to bottom.
- Right align dates with `\hfill` inside the same line as the role, not in a
  separate column, so the date stays attached to its job in the text stream.
- If you want density, cut words, not columns.

```latex
% Bad: the two minipages interleave in extraction
\begin{minipage}[t]{0.3\textwidth}
  \section*{Skills} Go, Postgres, Kubernetes
\end{minipage}\hfill
\begin{minipage}[t]{0.65\textwidth}
  \section*{Experience} Senior Engineer, Acme
\end{minipage}

% Good: full width, date attached to the role line
\section*{Experience}
\textbf{Senior Engineer}, Acme \hfill Mar 2021 -- Present
```

## Pick a document class by what it emits, not by how it looks

Templates that win on GitHub stars usually lose on extraction: the features
that make them distinctive (tikz banners, icon fonts, sidebars) are exactly the
ones that erase text.

| Class or template | Text layer | Verdict |
| --- | --- | --- |
| `article` plus your own macros | plain, single column | safe, you control every line |
| `moderncv` (`classic`, `banking`) | plain paragraphs | safe, keep `\photo` off |
| `awesome-cv` | text plus icon glyphs | usable if a text label sits beside every icon |
| `altacv`, `twentysecondcv` | tikz boxes, sidebar | risky, sidebar content is lost or reordered |
| `deedy-resume` | two column | risky, columns interleave |

Start from `article`. A resume needs roughly six macros, and writing them takes
less time than auditing someone else's class.

## Ship a preamble that embeds real vector fonts

Accented characters are the tell. Under default `OT1` encoding LaTeX builds an
accent by overprinting two glyphs, so extraction returns a base letter plus a
combining mark instead of one character, and a search for a name containing an
accent fails to match. Bitmap `.pk` fonts, still possible on old TeX installs,
are worse: they embed as Type 3 with no usable character map.

Extracting the same line proves it. Under `OT1` the word reads "naive" on the
page but extracts as `na` + dotless i + a separate combining diaeresis:

```text
OT1:        Resume of Pat Lee, naı̈ve café, fiancée.
T1+lmodern: Resume of Pat Lee, naïve café, fiancée.
```

- Load `fontenc` with `T1` and `lmodern`, so you get vector Type 1 fonts and
  accented characters extract as single characters.
- Or compile with LuaLaTeX and `fontspec`, which embeds OpenType fonts with a
  proper `ToUnicode` map.
- Never rely on default `OT1` Computer Modern for a document a machine reads.

This preamble compiles with `pdflatex` and produces an extractable text layer:

```latex
\documentclass[letterpaper,11pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[margin=0.75in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}

\pagestyle{empty}
\setlist[itemize]{leftmargin=1.2em, itemsep=2pt, topsep=2pt, parsep=0pt}
\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{10pt}{6pt}
\newcommand{\role}[4]{%
  \textbf{#1}, #2 \hfill #3\\
  \textit{#4}\\[2pt]}
```

Then a body of plain `center`, `\section`, `\role` and `itemize` blocks. Verify
the embedding with `pdffonts resume.pdf`: every row should say `Type 1`,
`TrueType`, or `Type 0`, and a `Type 3` row means the text layer is unreadable.

## Write every bullet as verb, work, result

A parser matches keywords, a human scans for evidence. The three part bullet
serves both: the verb carries the skill keyword, the work carries the technology
keyword, the result gives the human a reason to keep reading.

- Open with a past tense action verb, never with "Responsible for" or
  "Worked on", because those describe a job description rather than your output.
- Name the concrete thing you touched, so the keyword match is real and the
  interviewer has something to ask about.
- Close with a measured change, so the reader can size the work without asking.

```
% Bad: describes a job description, not your output
\item Responsible for improving the performance of the checkout service.
\item Worked on the team that migrated our infrastructure to Kubernetes.

% Good: verb, work, result
\item Cut p95 checkout latency from 1.9s to 640ms by replacing per-item
      queries with a batched loader, removing the nightly timeout alerts.
\item Migrated 14 services from EC2 to Kubernetes over two quarters with no
      customer facing downtime, cutting deploy time from 25 min to 4 min.
```

## Quantify from evidence, and use scope when you have no metric

An invented number is a question you cannot answer in the interview, and one
unravelled claim discredits the whole page. Lacking a measurement, state scope:
team size, request volume, services owned, budget, users served.

- Cite a metric only if you could name the dashboard or query behind it.
- Prefer before and after pairs over percentages, since a percentage with no
  baseline is unreadable and reads as padding.
- Replace missing metrics with countable scope, not with adjectives.

```
% Bad: unsourced percentage, no baseline
\item Improved system performance by 300\% and greatly increased reliability.

% Good: before/after pair, and countable scope where no metric exists
\item Reduced error budget burn from 4 incidents per month to 1 by adding
      idempotency keys to the webhook consumer.
\item Owned on-call for 14 services across a six-person team.
```

## Keep one master file and switch sections with a flag

Divergent copies drift: you fix a typo in the backend version and mail the
frontend one with the typo still in it. Keep a single `.tex`, select content at
build time, and let the filename record which variant you sent.

```latex
\usepackage{xstring}
\providecommand{\TargetRole}{general}
\newcommand{\onlyfor}[2]{\IfStrEq{\TargetRole}{#1}{#2}{}}
```

Wrap whole bullets or whole sections, then define the flag on the command line:

```latex
\onlyfor{backend}{\item Designed the sharded Postgres write path
  behind 40k orders/hour.}
\onlyfor{frontend}{\item Rebuilt the checkout flow in React, cutting
  bundle size 38\%.}
```

```bash
latexmk -pdf -jobname=lee-backend \
  -pdflatex="pdflatex -interaction=nonstopmode %O \"\\def\\TargetRole{backend}\\input{%S}\"" \
  resume.tex
```

Passing the `\def` as a bare filename fails, because `latexmk` rejects a
filename containing a backslash; it has to go through `-pdflatex`.

Keep the shared 90 percent unconditional. If more than a third of the document
is conditional you are maintaining two resumes with extra steps.

## Make links work on screen and on paper

`hyperref` gives a clickable PDF, but a printed or extracted copy keeps only the
anchor text. If the anchor text is "here" or "LinkedIn", the URL is gone. Load
it as `\usepackage[hidelinks]{hyperref}` and put the visible URL in the anchor.

```latex
% Bad: anchor text deletes the address in print and extraction
Portfolio available \href{https://patlee.dev}{here}.

% Good: the URL is the anchor text
\href{https://patlee.dev}{patlee.dev} \textbullet{}
\href{https://github.com/patlee}{github.com/patlee}
```

## Hold the page count and cut in a fixed order

One page is the default below roughly ten years of experience; two is fine above
that. Three means the reader picks which page to skim. When you are over, cut in
this order, because it removes the least evidence per line reclaimed.

1. Objective or summary paragraphs that restate the bullets below them.
2. Generic skill entries (`Microsoft Office`, `Agile`) matching nothing a
   recruiter searches for.
3. Coursework, GPA, and honors, once you have one full time role.
4. Roles older than about ten years, compressed to one line each.
5. The third and later bullets on any role older than your current one.

Never buy space by shrinking margins below 0.5in or the body below 10pt: it
reads as desperation and some parsers clip the narrow gutter.

## Build the same PDF every time

The PDF you review must be the PDF you send. A local TeX Live that differs from
the one you used last month changes line breaking, which silently pushes a job
onto page two.

- Drive the build with `latexmk`, so the pass count needed by `hyperref` is
  decided for you rather than guessed.
- Pin the toolchain in Docker or use one Overleaf project, so font and package
  versions do not move under you.
- Commit the `.tex` and the `latexmkrc`; treat the PDF as a build artifact.

```bash
# .latexmkrc: $pdf_mode = 1; $pdflatex = 'pdflatex -interaction=nonstopmode
# -halt-on-error %O %S'; $clean_ext = 'out';
docker run --rm -v "$PWD":/work -w /work \
  texlive/texlive:TL2024-historic latexmk -pdf resume.tex
```

## Read what the parser reads before you send

The only reliable check is extraction. Run it on the exact file you are about to
attach, and read the output as prose.

```bash
latexmk -pdf resume.tex
pdftotext resume.pdf - | head -40        # what a good parser sees
pdftotext -raw resume.pdf - | head -40   # what a naive parser sees
```

Read both. `-raw` is the pessimistic case, and a layout that survives `-raw`
survives everything. Check, in order:

- Your name, email, and phone appear in the first few lines as plain text.
- Every job title sits adjacent to its company and its dates, not separated by
  an unrelated skill keyword (that separation is the two column failure).
- Accented characters arrive as one character each, not a letter plus a floating
  combining mark, and no bullet text is split across lines.

Bad: sending the PDF because it looked right in the viewer.

Good: `pdftotext resume.pdf - | grep -i -E 'pat@example|555 0100'` returning both
lines before you attach the file.

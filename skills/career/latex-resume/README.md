# LaTeX Resume

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Build a LaTeX resume whose PDF text layer survives an ATS parser and still reads well to a human.

## What it does

Treats a resume as a document with two readers: a parser that flattens the PDF to a stream of text, and a person who gives it about 30 seconds. Most LaTeX templates optimise for the second reader and silently fail the first. The skill applies rules across four stages:

1. **Design for the text layer.** Single column, no `tikzpicture` text, no contact details in headers or footers, no icons without a text label beside them. An applicant tracking system extracts content objects in storage order, not visual order, so anything laid out in parallel columns interleaves.
2. **Compile something extractable.** `T1` fontenc plus `lmodern` (or LuaLaTeX with `fontspec`) so glyphs embed as vector fonts with a real character map. Under default `OT1`, accented characters extract as a letter plus a floating combining mark, so a search for the name misses.
3. **Write bullets as verb, work, result.** The verb carries the skill keyword, the work carries the technology keyword, the result gives the human a reason to keep reading. Numbers only where you could name the dashboard behind them.
4. **Verify by extraction, not by eye.** `pdffonts` to confirm no Type 3 row, `pdftotext` on the exact file you are about to attach, read as prose.

It is the career-facing sibling of [`technical-writing`](../../writing/technical-writing/SKILL.md). That skill is about writing for a reader who chose to read you. This one assumes the first reader is a machine that did not, and that the machine decides whether the human ever sees the page.

## When to use this

Use it when:

- Writing or rebuilding a resume in LaTeX, from scratch or from a template
- Diagnosing why a strong resume gets no responses through online application portals
- Auditing an existing `.tex` before a hiring push, especially one inherited from a GitHub template
- Maintaining role-targeted variants (backend, frontend, management) from one source
- Preparing a PDF that will be uploaded to a portal rather than emailed to a person

Skip it when:

- The employer asks for a plain-text or form-filled application, where no PDF is parsed
- You are writing an academic CV with no page limit and no ATS in the loop, where the completeness conventions differ
- The document is a portfolio or design piece whose layout is the point. Use [`technical-writing`](../../writing/technical-writing/SKILL.md) for the prose and accept that parsing is not a goal.

## Quick start

A worked example. You have a `resume.tex` built from a two column GitHub template and no interview calls.

**Step 1: read what the parser reads.** Before changing anything, look at the current text layer.

```bash
latexmk -pdf resume.tex
pdftotext resume.pdf - | head -40
```

If job titles sit next to unrelated skill keywords, the columns are interleaving. Run `pdftotext -raw resume.pdf -` too: that reads the raw content stream, which is the pessimistic case a naive parser sees, and a layout that survives `-raw` survives everything.

**Step 2: check the fonts.**

```bash
pdffonts resume.pdf
```

Every row should read `Type 1`, `TrueType`, or `Type 0`. A `Type 3` row means the text layer is unreadable no matter how the layout is fixed.

**Step 3: start from `article`.** A resume needs roughly six macros. Writing them costs less than auditing someone else's class.

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
```

**Step 4: put contact details in the body, as plain text.** Not in a header, not in a tikz node, not as an icon alone.

```latex
\begin{center}
  {\LARGE\bfseries Pat Lee}\\[3pt]
  pat@example.com \textbullet{} +1 555 0100 \textbullet{} Seattle, WA
\end{center}
```

**Step 5: keep dates on the role line.** `\hfill` right aligns without creating a second column, so the date stays attached to its job in the extracted stream.

```latex
\textbf{Senior Engineer}, Acme \hfill Mar 2021 -- Present
```

**Step 6: rewrite bullets as verb, work, result.**

```
\item Cut p95 checkout latency from 1.9s to 640ms by replacing per-item
      queries with a batched loader, removing the nightly timeout alerts.
```

Before and after pairs beat percentages, because a percentage with no baseline is unreadable.

**Step 7: make links carry their URL.** A printed or extracted copy keeps only the anchor text, so "here" loses the address entirely.

```latex
\href{https://patlee.dev}{patlee.dev} \textbullet{}
\href{https://github.com/patlee}{github.com/patlee}
```

**Step 8: add variant flags to the one master file.** Not a second copy.

```latex
\usepackage{xstring}
\providecommand{\TargetRole}{general}
\newcommand{\onlyfor}[2]{\IfStrEq{\TargetRole}{#1}{#2}{}}
```

```bash
latexmk -pdf -jobname=lee-backend \
  -pdflatex="pdflatex -interaction=nonstopmode %O \"\\def\\TargetRole{backend}\\input{%S}\"" \
  resume.tex
```

The flag has to go through `-pdflatex`, since `latexmk` rejects a filename containing a backslash. The filename records which variant you sent. Keep the shared 90 percent unconditional.

**Step 9: pin the toolchain.** Line breaking moves between TeX Live versions, which silently pushes a job onto page two.

```bash
docker run --rm -v "$PWD":/work -w /work \
  texlive/texlive:TL2024-historic latexmk -pdf resume.tex
```

**Step 10: confirm the contact details extract.** On the exact file you will attach.

```bash
pdftotext resume.pdf - | grep -i -E 'pat@example|555 0100'
```

Both lines should come back before you upload anything.

## Key concepts

### The text layer is the document

An ATS does not see your page. It extracts the PDF text layer in storage order and maps the result onto fields like `name`, `title`, `company`, `dates`. Anything outside that stream is invisible, and anything stored out of order arrives scrambled. Every layout decision is really a decision about what that stream looks like.

### Why two columns fail

The extractor can walk content objects in the order the PDF stores them, which for a two column layout means a sidebar merges line by line with the main column. Each job becomes a fragment glued to an unrelated skill keyword. Extracting a skills-against-experience `tabular` with `pdftotext -raw` returns exactly that:

```text
Go, Postgres Senior Engineer, Acme 2021-Present
Kubernetes Cut latency 60%
Redis Backend Lead, Globex 2018-2021
```

A layout-aware extractor may recover the visual order, but you do not get to choose which one the employer runs. The PDF looks perfect in a viewer, so the failure is undetectable without running extraction. Single column costs whitespace and buys correct reading order on every parser.

### Encoding decides whether text is searchable

Accented characters are the tell. Under default `OT1`, LaTeX builds an accent by overprinting two glyphs, so extraction returns a base letter plus a separate combining mark rather than one character, and a search for the name fails to match. The same line extracts as `naı̈ve` under `OT1` and `naïve` with `\usepackage[T1]{fontenc}` plus `\usepackage{lmodern}`. Bitmap `.pk` fonts, still possible on old TeX installs, are worse: they embed as Type 3 with no usable character map at all. LuaLaTeX with `fontspec` embeds OpenType with a proper `ToUnicode` map.

### Templates are chosen by what they emit

The features that make a template distinctive on GitHub (tikz banners, icon fonts, sidebars) are exactly the features that erase text. `article` with your own macros and `moderncv` in `classic` or `banking` emit plain paragraphs. `awesome-cv` is usable only if a text label sits beside every icon. `altacv`, `twentysecondcv`, and `deedy-resume` put content in sidebars or parallel columns, so their text layer is lost or reordered.

### Verb, work, result

The three part bullet serves both readers at once. The past tense action verb carries the skill keyword, the concrete thing you touched carries the technology keyword and gives an interviewer something to ask about, and the measured change lets the human size the work without asking. "Responsible for" and "Worked on" describe a job description rather than your output.

### Scope substitutes for metrics

An invented number is a question you cannot answer in the interview, and one unravelled claim discredits the whole page. Cite a metric only if you could name the dashboard or query behind it. Where you have no measurement, state countable scope (team size, request volume, number of services, users served) rather than reaching for adjectives.

### One master file, flags not copies

Divergent copies drift: you fix a typo in the backend version and mail the frontend version with the typo. Keep one `.tex`, select content at build time with a flag, and let the filename record the variant. If more than a third of the document is conditional, you are maintaining two resumes with extra steps.

### Cut in a fixed order

One page is the default below roughly ten years of experience, two above that. When you are over, cut in the order that removes the least evidence per line reclaimed: summary paragraphs that restate the bullets below them, then generic skill entries, then coursework and GPA, then roles older than about ten years compressed to one line, then third and later bullets on older roles. Never buy space by shrinking margins below 0.5in or the body below 10pt.

### Reproducible builds

The PDF you review must be the PDF you send. Drive the build with `latexmk` so the pass count `hyperref` needs is decided rather than guessed, pin TeX Live in Docker or use one Overleaf project, commit the `.tex` and the `latexmkrc`, and treat the PDF as a build artifact.

## Common pitfalls

### Contact details in a header or a tikz node

Bad:

```latex
\begin{tikzpicture}
  \node at (0,-0.6) {pat@example.com};
\end{tikzpicture}
```

Good:

```latex
\begin{center}
  pat@example.com \textbullet{} +1 555 0100
\end{center}
```

Tikz places glyphs at absolute coordinates in source order rather than visual order, and many parsers drop headers and footers as boilerplate. Either way the email may never reach the `email` field.

### A sidebar for skills

Bad:

```latex
\begin{minipage}[t]{0.3\textwidth}
  \section*{Skills} Go, Postgres, Kubernetes
\end{minipage}\hfill
\begin{minipage}[t]{0.65\textwidth}
  \section*{Experience} Senior Engineer, Acme
\end{minipage}
```

Good:

```latex
\section*{Experience}
\textbf{Senior Engineer}, Acme \hfill Mar 2021 -- Present
```

The two minipages interleave in extraction, so "Kubernetes" lands between the title and the company. If you want density, cut words, not columns.

### Bullets that describe the job, not the work

Bad:

```
\item Responsible for improving the performance of the checkout service.
```

Good:

```
\item Cut p95 checkout latency from 1.9s to 640ms by replacing per-item
      queries with a batched loader, removing the nightly timeout alerts.
```

The first version matches no keyword a recruiter searches for and gives an interviewer nothing to ask about.

### Numbers with no baseline behind them

Bad:

```
\item Improved system performance by 300\% and greatly increased reliability.
```

Good:

```
\item Reduced error budget burn from 4 incidents per month to 1 by adding
      idempotency keys to the webhook consumer.
```

A percentage with no baseline is unreadable, and a number you cannot source becomes an interview question you lose.

### Anchor text that hides the URL

Bad:

```latex
Portfolio available \href{https://patlee.dev}{here}.
```

Good:

```latex
\href{https://patlee.dev}{patlee.dev}
```

Printed and extracted copies keep only the anchor text, so "here" deletes the address.

### Shipping because the viewer looked right

Bad: attaching the PDF after checking it on screen.

Good: `pdffonts resume.pdf` showing no Type 3 row, then `pdftotext resume.pdf - | head -40` read end to end, with the name, email, and phone visible in the first few lines and every job title adjacent to its company and dates.

The viewer renders the page. The parser reads the stream. Only one of them is looking at what the employer receives.

## See also

- [`technical-writing`](../../writing/technical-writing/SKILL.md) - structure and style for the prose, once the layout is parseable
- [`literature-review`](../../research/literature-review/SKILL.md) - the same evidence discipline applied to sources, useful for keeping claims traceable
- [`truth-first`](../../research/truth-first/SKILL.md) - grounding individual claims, the rule behind "cite a metric only if you could name the dashboard"
- [`technical-writing`](../../writing/technical-writing) - the same audience-first framing applied to a repo front page
- [`planning`](../../workflow/planning/SKILL.md) - breaking a rebuild into checkable stages
- [`skill-authoring`](../../meta/skill-authoring/SKILL.md) - writing skills like this one

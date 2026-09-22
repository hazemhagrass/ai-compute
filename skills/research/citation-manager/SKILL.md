---
name: citation-manager
description: Use when managing a .bib file or bibliography. Verify every entry, dedupe on DOI, keep citations reproducible.
---

Treat the bibliography as data, not as prose. A citation is correct when a reader can follow it to exactly one document, and reproducible when rebuilding the project from a clean checkout produces the same reference list. Publisher-exported BibTeX satisfies neither by default.

[`literature-review`](../literature-review/SKILL.md) owns finding and screening the papers. This skill owns what happens after: storing them, deduplicating them, and emitting them without silent corruption. [`truth-first`](../truth-first/SKILL.md) governs whether the claim a citation supports is grounded.

## Rules for entries

### 1. Know which fields the entry type requires
An entry missing a required field does not error loudly. It renders a reference that cannot be followed.

Classic BibTeX required fields:

| Type | Required | Common use |
|---|---|---|
| `@article` | author, title, journal, year | Journal paper |
| `@inproceedings` | author, title, booktitle, year | Conference paper |
| `@book` | author or editor, title, publisher, year | Monograph |
| `@incollection` | author, title, booktitle, publisher, year | Chapter in an edited volume |
| `@techreport` | author, title, institution, year | Technical report, standard |
| `@phdthesis` | author, title, school, year | Dissertation |
| `@misc` | none | Preprints, software, datasets, web pages |

`@misc` requires nothing, which is why bad importers default to it. An `@misc` entry is a promise that you will supply the fields yourself.

BibLaTeX renames several of these and adds types classic BibTeX lacks. `journal` becomes `journaltitle`, `address` becomes `location`, `school` becomes `institution`, and `year` is usually replaced by `date` in ISO form (`date = {2021-03-14}`). BibLaTeX adds `@online` (with `url` and `urldate`), `@dataset`, `@software`, and `@thesis` with a `type` field. BibLaTeX accepts legacy field names for compatibility; classic BibTeX does not accept the new ones.

Verified behaviour, `bibtex` against an `@article` with no `journal` field:

```
Warning--empty journal in nojournal
(There were 2 warnings)
```

The compile succeeds. The rendered entry was `Jane Doe. A paper missing its journal. 2020.` A reader cannot find that paper. Read the `.blg` log, not just the exit code.

### 2. Never trust publisher-exported BibTeX
Exports are generated from a database schema that does not match BibTeX's, by code nobody maintains. Check every export before it lands in the `.bib`.

Failure modes seen in real exports:

- **Mangled capitalisation.** Titles arrive in the publisher's house style, and the style you compile with reimposes its own.
- **Missing DOI.** Especially from library catalogue and Google Scholar exports.
- **Wrong or mangled DOI case.** Crossref content negotiation for the ACL Anthology BERT paper returns `DOI={10.18653/v1/n19-1423}` with the record's `N19` lowercased. DOIs are case-insensitive for resolution but not for string comparison, which breaks naive deduplication.
- **Non-BibTeX characters in numeric fields.** That same export returns a `pages` value joined by a literal Unicode en dash rather than the BibTeX `--`, which some styles pass through and some mangle.
- **Wrong year for online-first articles.** A paper published online in one year and assigned to an issue in the next has two dates. Publishers export whichever their schema calls primary. Cite the version of record's year, and if you rely on the online-first date say so.
- **Conference papers exported as `@article`.** The venue then renders as a journal name with no proceedings information, no publisher, and no location.

**Rule**: an export is a draft. Reconcile it against the publisher's own citation page or the DOI's registered metadata before committing it.

### 3. Protect capitalisation with braces
BibTeX styles apply their own title casing. A style that lowercases titles will lowercase proper nouns, acronyms, and gene names along with everything else. Braces around a substring make it opaque to case changes.

**Bad:**

```bibtex
title = {Studies of DNA in Drosophila cells}
```

**Good:**

```bibtex
title = {Studies of {DNA} in {Drosophila} cells}
```

Verified: the same two entries compiled under six stock BibTeX styles, unprotected first, protected second.

```
--- plain ---
[1] Richard Roe. Studies of dna in drosophila cells.
[2] Richard Roe. Studies of DNA in Drosophila cells.
--- ieeetr ---
[1] R. Roe, "Studies of dna in drosophila cells,"
[2] R. Roe, "Studies of DNA in Drosophila cells,"
--- acm ---
[1] Roe, R. Studies of dna in drosophila cells.
[2] Roe, R. Studies of DNA in Drosophila cells.
```

`apalike` and `siam` behaved identically. The same holds for CSL: under the APA CSL style, pandoc rendered the unprotected title as `Gene expression in drosophila and the hedgehog pathway` and the braced one correctly.

Brace the substring, not the whole field. `title = {{Studies of DNA in Drosophila cells}}` also survives, but it opts the entry out of every style's casing rules, so a style that wants sentence case cannot apply it.

### 4. Treat the DOI as the canonical identifier
Titles vary, author name formats vary, venue strings vary. The DOI is the one field that identifies the work.

Resolve metadata from the DOI rather than retyping it. Content negotiation against `doi.org` returns registered metadata directly:

```bash
curl -sLH "Accept: application/x-bibtex" https://doi.org/10.18653/v1/N19-1423
curl -sLH "Accept: application/vnd.citationstyles.csl+json" https://doi.org/10.18653/v1/N19-1423
```

The CSL JSON form is the better starting point. For that DOI it returned `"type": "proceedings-article"` with the full proceedings title and publisher, while the BibTeX form of the same record lowercased the DOI. Registered metadata is still not automatically correct, but it is the registrant's own record rather than a third party's re-export.

Store the DOI bare (`10.18653/v1/N19-1423`), not as a URL, and let the style build the link. Only fall back to `url` when no DOI exists.

### 5. Deduplicate on normalised DOI, then on title plus year
The same paper arrives from three databases with three keys, three title spellings, and three entry types. Match mechanically.

1. Normalise the DOI: strip any `https://doi.org/` or `doi:` prefix, lowercase, remove punctuation. This is what catches the lowercased-DOI export.
2. Where a DOI is absent, fall back to a normalised title plus year signature: NFKD normalise, lowercase, strip everything that is not alphanumeric. This collapses double spaces, curly quotes, and punctuation differences.
3. Resolve each cluster by hand. Keep the entry with the most complete required fields and the correct entry type.

Verified against three entries for one paper, two carrying the same DOI in different cases and one with no DOI:

```
DUPLICATE [doi=1048550arxiv170603762]
    @article{Vaswani2017}
    @inproceedings{vaswani_attention_2017}
unique    [title+year=attentionisallyouneed2017]
    @misc{NIPS2017_3f5ee243}
```

The DOI pass caught the pair. The third entry needed the title fallback, and note that its raw title contained a double space, which normalisation removed. Preprint and published versions carry different DOIs for the same work, so DOI matching will never merge them. Handle those under rule 7.

### 6. Fix the citation key convention before the first import
A key is a name you will type by hand for years and that appears in every collaborator's diff. Pick one scheme and apply it to everything, including imports.

`lastnameYYYYfirstword`, lowercase, ASCII only: `vaswani2017attention`, `devlin2019bert`.

- Lowercase and ASCII-only, since some toolchains fold case and non-ASCII keys break older BibTeX.
- No spaces, commas, or braces. These terminate the key.
- Disambiguate collisions with a letter suffix (`smith2020a`, `smith2020b`) and never reuse a retired key for a different work.
- Rename imported keys on the way in. Publisher keys like `NIPS2017_3f5ee243` are opaque and collide across exports.

**A key, once cited, is frozen.** Renaming a key is a rename across every document that uses it. If you must rename, grep the whole repository for the old key and confirm zero undefined references afterwards.

### 7. Cite the version you actually read, and prefer the version of record
A preprint and its published version are different documents with different content and different DOIs.

- If a published version exists, cite it. Numbers, framing, and sometimes conclusions change during review.
- If you read and relied on the preprint, cite the preprint, with its version pinned (`arXiv:1706.03762v5`, not `arXiv:1706.03762`, which resolves to the latest version).
- Never cite the published version while quoting the preprint's numbers.
- Mark preprints as preprints in the entry so the reader can weight them. In BibLaTeX use `@online` or `@misc` with `eprint`, `eprinttype = {arxiv}`, and `eprintclass`; do not dress a preprint as `@article` with a journal name it never appeared in.

### 8. Archive web sources and record an access date
Web pages change and disappear. A URL alone is a citation that decays.

For any `@online` or `@misc` web source, record all four of: `url`, `urldate` (BibLaTeX) or `note = {Accessed ...}` (classic BibTeX), the page title as it read on that date, and an archived snapshot URL from a web archive. Cite the archived copy alongside the live URL, so that the claim remains checkable after the original moves.

Prefer a stable identifier wherever one exists. A standard has a document number, a software release has a version tag and often a DOI, a law has a section reference. Use those before falling back to a URL.

## Rules for the toolchain

### 9. Know where the `.bib` comes from and keep one source of truth
Reference managers and plain files both work. Mixing them silently does not.

- **Zotero** stores in its own database and exports BibTeX, BibLaTeX, or CSL JSON. Better BibTeX extends it with stable pinned citation keys and auto-export on change, which is what makes it usable in a version-controlled project.
- **JabRef** edits `.bib` files directly, so the file in the repository is the database. No export step, no drift.
- **BibDesk** (macOS) also edits `.bib` directly and tracks attached files.
- **CSL JSON** is the interchange format. It is a flat JSON array of objects with `id`, `type`, `title`, `container-title`, `author` as `{family, given}` pairs, `issued` as `date-parts`, and `DOI`. Its type vocabulary is its own: `paper-conference`, not `inproceedings`.

Pick one master format. If the master is a manager's database, the exported `.bib` is a build artefact and must be regenerated, never hand-edited.

### 10. Use `pandoc --citeproc` for markdown, and read its warnings
Pandoc reads `.bib`, `.bibtex`, and `.json` (CSL JSON) bibliographies, and renders with a CSL style. It reports undefined keys rather than failing.

Verified run with one key deliberately absent from the `.bib`:

```
[WARNING] Citeproc: citation missingkey not found
Transformers (Vaswani and Shazeer 2017) and BERT (Devlin and Chang 2019;
missingkey?).
```

The `?` marker ships in the output if nobody reads the warning. Treat citeproc warnings as build failures.

Pandoc also converts formats, which makes it a useful normaliser: `pandoc refs.bib -t csljson` emits CSL JSON, and it maps `@inproceedings` to `"type": "paper-conference"` correctly.

### 11. Fetch CSL styles from the official repository and pin them
CSL styles come from the Citation Style Language styles repository, which carries styles for thousands of journals. Download the specific `.csl` file and commit it with the project:

```bash
curl -sO https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl
pandoc --citeproc --csl apa.csl doc.md -o doc.pdf
```

A style referenced by URL or by a name resolved from a system directory makes the build depend on what happens to be installed. A committed `.csl` makes it reproducible.

### 12. Keep the `.bib` in version control and diffable
A bibliography that is not diffable hides silent edits.

- One field per line, consistent indentation, sorted by citation key. Enforce it with a formatter so that reordering by a manager's export does not produce a thousand-line diff.
- Commit the `.bib`, the `.csl`, and for LaTeX the `.bbl` when submitting, since publishers often require it.
- Do not commit `.aux`, `.blg`, or `.bcf`. They are regenerated and they conflict on every merge.
- Review bibliography diffs like code. A one-character change to a DOI is a broken citation and looks like noise.

### 13. Check for uncited entries and undefined citations before submitting
Both are silent by default and both are checkable.

LaTeX records every cited key in the `.aux` file. Diff that against the keys in the `.bib`:

```python
import re
cited = set()
for group in re.findall(r'\\citation\{(.+?)\}', open('doc.aux').read()):
    cited.update(group.split(','))
have = set(re.findall(r'@\w+\s*\{\s*([^,\s]+)', open('refs.bib').read()))
print("UNDEFINED:", sorted(cited - have) or "none")
print("UNCITED:  ", sorted(have - cited) or "none")
```

Verified output on a document citing one key that does not exist, with one `.bib` entry never cited:

```
UNDEFINED (cited, not in .bib): ['ghostkey']
UNCITED   (in .bib, never cited): ['conf2019']
```

LaTeX reports the undefined one too, as `LaTeX Warning: There were undefined references`, and renders the citation as `[?]` in the PDF. It never reports the uncited one, because an unused entry is legal.

Undefined citations must be zero. Uncited entries are usually fine in a working `.bib` and usually wrong in a submission, where the reference list is supposed to match what the paper cites.

### 14. Run the full build, from clean, before you believe the bibliography
BibTeX needs at least three passes: LaTeX to write the `.aux`, `bibtex` to read it and write the `.bbl`, then LaTeX twice more to place the labels. Stopping early produces `[?]` for every citation even when the `.bib` is perfect. Verified: after one LaTeX pass plus `bibtex`, every citation still rendered as `[?]`; after the additional passes the same document rendered `[2], [1], [?]`, with only the genuinely missing key unresolved.

Use `latexmk`, which runs the passes to convergence, or `biber` with BibLaTeX. Delete `.aux`, `.bbl`, and `.bcf` first, because a stale `.bbl` will happily render entries you deleted from the `.bib`.

## Before you submit

1. Does every entry have the required fields for its type, with no warnings in the `.blg`?
2. Is every entry type right, especially conference papers not exported as `@article`?
3. Is every proper noun and acronym in every title brace-protected?
4. Does every entry that has a DOI carry it, bare and correctly cased?
5. Did deduplication run on normalised DOI and on title plus year?
6. Is every preprint marked, and pinned to a version?
7. Does every web source have an access date and an archived snapshot?
8. Are undefined citations zero, and are uncited entries intentional?
9. Does a clean build from a fresh checkout reproduce the reference list?

# Citation Manager

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="citation-manager robot" width="200">
</div>

Keep a bibliography correct and reproducible: verify every entry, deduplicate on DOI, and catch broken citations before submission rather than after.

## What it does

Treats the `.bib` file as data with a schema rather than as prose at the end of a document. The skill covers the mechanics that sit between finding a paper and printing its reference:

1. **Entry correctness.** Which fields each BibTeX and BibLaTeX type actually requires, what a missing field renders as, and why publisher-exported BibTeX is a draft rather than a result.
2. **Capitalisation protection.** Which styles lowercase proper nouns, and how brace protection stops them.
3. **Identity and deduplication.** The DOI as canonical identifier, resolving metadata from it, and merging the same paper arriving from three databases under three keys.
4. **Toolchain.** Zotero, JabRef, BibDesk, CSL JSON as interchange, `pandoc --citeproc` for markdown, CSL styles, and the multi-pass LaTeX build.
5. **Pre-submission checks.** Undefined citations, uncited entries, archived web sources, and a clean rebuild.

It sits downstream of [`literature-review`](../literature-review/SKILL.md), which owns searching and screening. That skill decides which papers are in. This one makes sure the citations to them survive the build.

## When to use this

Use it when:

- Maintaining a `.bib` file that more than one person or more than one document touches
- Importing references from publisher exports, Google Scholar, or a library catalogue
- A citation renders as `[?]`, a proper noun comes out lowercased, or an author appears twice in the reference list
- Preparing a submission where the reference list must match the cited set exactly
- Setting up a markdown or LaTeX writing project so the bibliography build is reproducible
- Merging bibliographies from collaborators who used different citation key conventions

Skip it when:

- A single throwaway document with three hand-typed references
- The venue supplies and controls the bibliography (cite as instructed instead)
- The question is which papers to include, not how to store them. Use `literature-review`.

## Quick start

Three checks that catch most real bibliography bugs. All output below is from actual runs.

**1. Does a missing required field break anything?** An `@article` with no `journal`, compiled with classic BibTeX:

```
$ bibtex doc
Warning--I didn't find a database entry for "ghostkey"
Warning--empty journal in nojournal
(There were 2 warnings)
```

The build succeeds. The rendered reference was `[1] Jane Doe. A paper missing its journal. 2020.` A reader cannot follow that to a document. Warnings live in the `.blg` file, not in the exit code.

**2. Does the style lowercase your proper nouns?** Two identical entries, one with `title = {Studies of DNA in Drosophila cells}` and one with `title = {Studies of {DNA} in {Drosophila} cells}`, under three stock styles:

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

`apalike` and `siam` behaved the same way. The pattern holds outside LaTeX too: under the APA CSL style, `pandoc --citeproc` rendered the unprotected title as `Gene expression in drosophila and the hedgehog pathway`.

**3. Are there undefined citations or uncited entries?** Diff the `.aux` against the `.bib`:

```python
import re
cited = set()
for group in re.findall(r'\\citation\{(.+?)\}', open('doc.aux').read()):
    cited.update(group.split(','))
have = set(re.findall(r'@\w+\s*\{\s*([^,\s]+)', open('refs.bib').read()))
print("UNDEFINED:", sorted(cited - have) or "none")
print("UNCITED:  ", sorted(have - cited) or "none")
```

```
UNDEFINED (cited, not in .bib): ['ghostkey']
UNCITED   (in .bib, never cited): ['conf2019']
```

The undefined key also rendered as `[?]` in the PDF and raised `LaTeX Warning: There were undefined references`. The uncited entry was reported by nothing, because an unused entry is legal.

For markdown, `pandoc --citeproc` reports the same class of problem:

```
[WARNING] Citeproc: citation missingkey not found
Transformers (Vaswani and Shazeer 2017) and BERT (Devlin and Chang 2019;
missingkey?).
```

Note the `missingkey?` in the rendered text. It ships if nobody reads the warning.

## Key concepts

**Required fields are type-specific.** `@article` needs journal, `@inproceedings` needs booktitle, `@book` needs publisher. `@misc` requires nothing, which is why lazy importers default to it and why an `@misc` entry is a promise to supply the fields yourself.

**BibLaTeX is a different schema.** `journal` becomes `journaltitle`, `address` becomes `location`, `year` becomes an ISO `date`, and it adds `@online`, `@dataset`, `@software`. It accepts legacy names; classic BibTeX does not accept the new ones. Pick one and stay in it.

**Brace protection is per-substring.** Braces make text opaque to a style's case folding. Brace the acronym or proper noun, not the whole title, so styles that want sentence case can still apply it.

**The DOI is the identity.** Titles, author formats, and venue strings all vary across exports. Store the DOI bare and resolve metadata from it with content negotiation against `doi.org`, which returns the registrant's own record as BibTeX or as CSL JSON.

**CSL JSON is the interchange format.** A flat array of objects with `id`, `type`, `container-title`, `author` as `{family, given}`, and `issued` as `date-parts`. Its type vocabulary differs from BibTeX's: a conference paper is `paper-conference`. `pandoc refs.bib -t csljson` converts, and maps the types correctly.

**A citation key is frozen once cited.** Renaming is a rename across every document in the repository. Fix the convention before the first import and rewrite publisher keys on the way in.

**Preprint and published are different documents.** Different DOIs, sometimes different numbers. Deduplication on DOI will never merge them, so they need a human decision. Cite what you read, pin preprint versions.

**The LaTeX build needs three passes.** LaTeX writes `.aux`, `bibtex` reads it and writes `.bbl`, LaTeX runs twice more to place labels. Verified: after one pass plus `bibtex`, every citation still rendered as `[?]` even though the `.bib` was fine.

## Common pitfalls

**Trusting a publisher export.**
Bad: paste the "Export BibTeX" output straight into `refs.bib`.
Good: reconcile it against the DOI's registered metadata first. Real exports arrive with conference papers typed as `@article`, no DOI, house-style capitalisation, and the online-first year instead of the issue year. Crossref's own BibTeX for the ACL BERT paper returned the DOI lowercased as `10.18653/v1/n19-1423` and a `pages` range joined with a Unicode dash instead of `--`.

**Leaving acronyms and proper nouns unbraced.**
Bad: `title = {Studies of DNA in Drosophila cells}`.
Good: `title = {Studies of {DNA} in {Drosophila} cells}`. Five of five stock styles tested rendered the first as `studies of dna in drosophila cells`, and APA CSL did the same. The style is not broken; you did not tell it which words are names.

**Bracing the entire title.**
Bad: `title = {{Studies of DNA in Drosophila cells}}`.
Good: brace only the protected substrings. Whole-field bracing survives lowercasing but opts the entry out of every style's casing rules, so a journal requiring sentence case gets your capitalisation instead of its own, inconsistently with the rest of the list.

**Deduplicating on the title string.**
Bad: compare titles as they arrive. Three exports of one paper differed in case, in a double space, and in entry type.
Good: normalise the DOI (strip prefix, lowercase, strip punctuation) and cluster on that, then fall back to normalised title plus year for entries with no DOI. Verified on three entries for one paper: the DOI pass merged the two that carried it in different cases, and the title fallback was needed for the third.

**Treating a citeproc or bibtex warning as noise.**
Bad: the build exited 0, ship it.
Good: read the `.blg` and the citeproc warnings. Both tools warn and continue. The visible failure is a `[?]` or a trailing `?` in the rendered text that a reader finds before you do.

**Hand-editing an exported `.bib`.**
Bad: fix a title in `refs.bib` when Zotero is the master and regenerates it on every change.
Good: fix it in the master and re-export, or make the `.bib` itself the master with JabRef or BibDesk. One source of truth. An exported file is a build artefact.

**Citing a URL with no access date and no archive.**
Bad: `url = {https://example.com/post}`.
Good: `url`, `urldate`, the title as it read then, and an archived snapshot. Web pages change and vanish, so a bare URL is a citation with an expiry date. Prefer a stable identifier (DOI, standard number, version tag) whenever one exists.

**Renaming a citation key after it has been cited.**
Bad: tidy `NIPS2017_3f5ee243` to `vaswani2017attention` mid-project.
Good: normalise keys at import time. If a rename is unavoidable, grep the whole repository for the old key and confirm zero undefined references afterwards.

**Committing build artefacts.**
Bad: `.aux`, `.blg`, and `.bcf` in version control, conflicting on every merge.
Good: commit the `.bib` and the `.csl` (so the style is pinned, not resolved from whatever is installed), and the `.bbl` only when a publisher requires it on submission.

**Believing a bibliography you built incrementally.**
Bad: trust the reference list from a working directory full of stale `.bbl` and `.aux` files. A stale `.bbl` renders entries you already deleted from the `.bib`.
Good: delete the artefacts and rebuild from clean, with `latexmk` or `biber`, before you believe the output.

## See also

- [`literature-review`](../literature-review/SKILL.md) for finding, screening, and extracting from the papers that end up in the `.bib`
- [`truth-first`](../truth-first/SKILL.md) for whether the claim a citation is attached to is actually grounded in the source
- [`academic-paper-writing`](../academic-paper-writing/SKILL.md) for the document the bibliography belongs to
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for prose that cites without overclaiming
- [`git-workflow`](../../devtools/git-workflow/SKILL.md) for keeping the `.bib` diffable and artefacts out of the repository

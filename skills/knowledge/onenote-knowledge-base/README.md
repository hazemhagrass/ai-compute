# OneNote Knowledge Base

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="onenote-knowledge-base robot" width="200">
</div>

A skill for running OneNote as a knowledge base that stays findable, shareable without accidents, and honest about what export leaves behind.

## What it does

This skill turns a OneNote notebook from a pile of notes into something a
colleague can search successfully without knowing your filing habits. It covers
the retrieval mechanics, the sharing model, the failure modes, and the exit path.

| Area | What the skill enforces |
| --- | --- |
| Hierarchy | Three levels at most; titles carry the rest |
| Page titles | Type prefix plus the proper nouns a searcher remembers |
| Text vs images | Never let a screenshot be the only copy of text |
| Tags | Five or fewer, shared vocabulary, Tag Summary as the payoff |
| Page links | Copy Link to Page plus index pages, which is what makes it a base |
| Templates | Meeting, Decision, Runbook as section defaults |
| Permissions | Notebook is the only real permission boundary |
| Sync | Conflict pages found and reconciled, not ignored |
| History | Treated as retention-limited recovery, not version control |
| Export | Stated plainly: what each format keeps and what it loses |
| Archiving | Close finished notebooks so they leave live search |
| Scope | When to move the content to a spreadsheet, Word, or a repo |

It is prescriptive and opinionated, including about OneNote's weakest point:
portability. The skill does not pretend export is solved.

## When to use this

Use it when you are:

- Setting up a shared notebook a team will rely on rather than skim.
- Inheriting a notebook nobody can search and deciding what to fix first.
- Writing a runbook, decision record, or meeting note that must be found later.
- About to share a notebook outside your team and unsure what that exposes.
- Recovering from sync conflicts, a deleted page, or a lost edit.
- Weighing a migration off OneNote and needing the real cost of export.

Do not use it for: picking a notes app from scratch (this assumes OneNote is
already the tool), tracking structured data, managing documents that need review
and diffs, or anything requiring per-page access control. Those need a different
tool, and the skill says which.

## Quick start

A team keeps auth-service knowledge in OneNote and nobody can find anything.
Here is the notebook before and after.

### Before

```
Notebook: Team
  Section group: Engineering
    Section group: Backend
      Section group: Services
        Section: Auth
          Section: 2024
            Page: Notes
            Page: Notes 2
            Page: Meeting
            Page: [screenshot of terminal output]
```

Four failures: six levels of guessing, titles that match no query, a page whose
only content is an image of text, and no links between anything.

### After

```
Notebook: Engineering (shared with the eng group, edit)
  Section group: Auth Service
    Section: Runbooks
      Page: Index - Auth Service runbooks
      Page: Runbook - rotate the Stripe webhook secret
      Page: Runbook - recover from a token refresh 5xx spike
    Section: Decisions
      Page: Decision - drop MySQL 5.7 support
    Section: Meetings
      Page: Meeting - billing migration kickoff - decisions and owners
```

The runbook page body, with text kept as text:

```
Preconditions
- [ ] VPN connected
- [ ] kubectl context set to staging-1

Steps
1. Trigger the deploy:

   ./scripts/deploy.sh --env staging --wait

2. If it stalls, the error is:

   error: timed out waiting for rollout of deployment/api

   Cause: old pods hold the PVC. Fix:

   kubectl delete pod -l app=api --field-selector status.phase=Failed

Verify
  curl -s localhost:8080/healthz   ->   {"status":"ok"}

Related
  Decision - drop MySQL 5.7 support   [Copy Link to Page]
  Meeting - billing migration kickoff [Copy Link to Page]

To Do: Ana - delete the legacy webhook secret after the Friday deploy
```

What changed and why it works:

1. Hierarchy shrank from six levels to three, so nobody has to guess a branch.
2. Titles start with a type (`Runbook`, `Decision`, `Meeting`) and name the
   vendor and service, so a search for "webhook secret" lands directly.
3. The error string `timed out waiting for rollout` is typed, so the person who
   pastes it into search at 2am finds this page.
4. Commands are text, copy-pasteable, and survive export.
5. An index page fronts the section, ordered by importance instead of alphabet.
6. `Related` links make the decision reachable from the runbook and back.
7. The `To Do` line names an owner and a trigger, so it reads correctly in the
   Tag Summary where it appears without context.

Then export the notebook to `.onepkg` and to PDF, and store both with your
backups. That step is the one people skip until they need it.

## Key concepts

**Hierarchy is navigation, titles are retrieval.** Search scans page text and
titles across a notebook and ignores your nesting. Every level you add is a level
a colleague has to guess. Three levels plus disciplined titles beats six levels.

**Titles are queries.** Write the title as the thing someone will type: a type
prefix, then the proper nouns they will remember. Spell out acronyms in the body,
because search matches literal strings.

**Text as text.** OneNote runs optical character recognition (OCR) on images, so
image text is partly searchable, but quality collapses on small fonts, code
punctuation, and low-contrast themes. Handwriting recognition is worse. A pasted
screenshot of text cannot be searched reliably, copied, diffed, or read aloud.
Screenshots corroborate; they are not the record.

**Tags feed the Tag Summary.** Tags mark a line, not a page. Their value is the
Tag Summary pane collecting tagged lines across the notebook, which only works
with a small shared vocabulary and lines that carry their own context.

**Links make it a base.** Copy Link to Page gives a durable link that survives
moving the page. A hierarchy expresses one relationship per page; links express
the rest. Index pages let you order by importance instead of by name or date.

**Notebook is the permission boundary.** Sharing is a OneDrive or SharePoint file
permission, inherited forward to pages created later. There is no reliable
per-page permission, and "anyone with the link" makes the link the credential:
forwardable, sign-in-free, and public for as long as it exists.

**Conflicts are kept, not merged.** Per-page sync merges edits to different
parts of a page. Simultaneous edits to the same paragraph produce a conflict page
sitting in the sidebar looking ordinary. Nothing is lost; nothing is resolved
either. Somebody reconciles it by hand.

**History is recovery, not version control.** Page Versions keeps recent
per-author versions with no diffs, no branches, and no commit messages, under a
retention limit an administrator can change. Deleted pages sit in the notebook
recycle bin until purged.

**Portability is the real cost.** `.onepkg` keeps everything and is readable only
by OneNote. PDF keeps the look and loses page links, tags, and editability. Word
export keeps text per page and loses canvas layout, links as links, tags as
metadata, and history. Manual Markdown keeps exactly what you retype. Choosing
OneNote is accepting that.

## Common pitfalls

### Pasting a screenshot instead of the text

Bad:

> [screenshot of the terminal showing the failing deploy]

Good:

> ```bash
> ./scripts/deploy.sh --env staging --wait
> ```
>
> Error: `error: timed out waiting for rollout of deployment/api`

Reason: OCR on screenshot-resolution monospace with punctuation is unreliable,
so the page will not surface for the error string, which is the only thing
anyone will search for. The text also survives export; the image does not carry
its meaning through PDF or Word.

### Building hierarchy instead of writing titles

Bad: `Team > Engineering > Backend > Services > Auth > 2024 > Page: Notes`

Good: `Engineering > Auth Service > Runbooks > Page: Runbook - rotate the Stripe
webhook secret`

Reason: search ignores nesting entirely, so deep trees add guessing without
adding retrieval. The title is what actually matches a query.

### Using a section for confidential material

Bad: a `Salaries` section inside the shared `Team` notebook.

Good: a separate `Compensation` notebook shared only with named people.

Reason: permissions attach to the notebook file, not the section. Anyone with
notebook access reads every section, including ones you add next month.

### Sharing with "anyone with the link"

Bad: send an anyone-with-the-link edit URL into a group chat.

Good: share with a named group or individuals; if a link is unavoidable, set an
expiry and revoke it once the need passes.

Reason: the link is the credential and it is forwardable. One paste into the
wrong thread publishes the notebook, and nothing in the notebook records that it
happened.

### Trusting page history as a safety net

Bad: no exports, on the grounds that Page Versions can restore anything.

Good: scheduled `.onepkg` plus PDF exports stored with other backups.

Reason: history is retention-limited, per-author, diff-free, and can be trimmed
or disabled by an administrator. It recovers a recent mistake; it does not
survive a deleted notebook or a tenant change.

### Ignoring conflict pages

Bad: leave the red-marked duplicate page in the sidebar for later.

Good: after any offline stretch, scan the section for conflict pages, merge the
content into the live page, then delete the conflict page.

Reason: conflict pages look like ordinary pages, so the notebook silently grows
two divergent copies of the truth and readers pick whichever they open first.

### Keeping a tracker in OneNote

Bad: a 200-row OneNote table used as the inventory of customer environments.

Good: a spreadsheet or database for the rows, plus a OneNote page that explains
the fields and links to it.

Reason: OneNote tables have no types, no cross-page formulas, and no filtering or
querying, so every question about the data becomes manual reading. Prose belongs
in OneNote; rows do not.

### Using free-form canvas layout for content that must migrate

Bad: notes scattered in positioned text boxes across the page canvas.

Good: one top-to-bottom column with headings.

Reason: canvas positioning is the least portable feature in the product. Every
export path either flattens it unpredictably or drops it, so a visually organised
page becomes an unordered dump the moment you leave OneNote.

## See also

Sibling skills in this repository:

- [technical-writing](../../writing/technical-writing/SKILL.md) for the page-body
  rules this skill assumes: task-first ordering, runnable snippets, and failure
  modes written in the exact words the system emits.
- [technical-writing](../../writing/technical-writing) for the index-page
  habit applied to a repo, which is the same problem as a section index.
- [database-design](../../engineering/database-design/SKILL.md) for where the
  structured data should go once you accept a OneNote table is not a table.
- [git-workflow](../../devtools/git-workflow/SKILL.md) for content that needs
  real diffs, branches, and review rather than page history.
- [systematic-web-research](../../research/systematic-web-research/SKILL.md) for
  capturing sources so a research page cites something verifiable.
- [planning](../../workflow/planning/SKILL.md) for the decision records that a
  Decision template is meant to hold.

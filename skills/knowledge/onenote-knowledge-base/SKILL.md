---
name: onenote-knowledge-base
description: "Use when OneNote is your knowledge base. Keep pages findable, shareable, and honest about what export loses."
---

# OneNote as a Knowledge Base

For someone who already stores team or personal knowledge in OneNote and needs it
to stay retrievable a year from now. Not for choosing a notes app from scratch,
and not for structured data, versioned documents, or anything that needs diffs
(see "When OneNote is the wrong tool").

A knowledge base is not a pile of notes. The difference is whether a specific
answer can be found by someone who does not already know where it lives. In
OneNote that hinges on four things: page titles, page links, tags, and the
discipline to keep text as text.

## Stop nesting at three levels

OneNote gives you notebook > section group > section > page > subpage. Use the
first three and the fifth sparingly.

| Level | Use it for | Stop when |
| --- | --- | --- |
| Notebook | A permission boundary or a lifecycle boundary | You are splitting by topic rather than by who may read it |
| Section group | A coarse domain inside one notebook | You have fewer than three sections to put in it |
| Section | The unit a person clicks to browse | Sections scroll off the sidebar |
| Page | One answerable question or one event | The page has more than one title-worthy subject |
| Subpage | A continuation of the parent page only | You are using it as a category |

Deep nesting stops helping the moment the person searching does not know which
branch to open. Search does not care about your hierarchy; it searches page text
and titles across the whole notebook. Every level you add is a level someone has
to guess. Two or three levels plus good titles beats six levels every time.

Bad: `Engineering > Backend > Services > Auth > 2024 > Incidents > Page: Notes`

Good: `Engineering > Auth Service > Page: Auth incident - token refresh 5xx spike`

## Title pages the way people search

The title is the strongest retrieval signal and the thing most people leave as
"Untitled page" or "Notes". Write the title as the query someone will type.

Bad titles:

- `Meeting`
- `Notes 3`
- `Follow up`
- `Stuff from Dave`

Good titles:

- `Meeting - billing migration kickoff - decisions and owners`
- `Runbook - rotate the Stripe webhook secret`
- `Decision - drop MySQL 5.7 support`
- `How to get VPN access for contractors`

Rules that hold up:

- Lead with the page type (`Meeting`, `Decision`, `Runbook`, `How to`) so a
  search for a type returns a clean list.
- Include the proper nouns a searcher will remember: service names, vendor
  names, person names, error strings.
- Spell out acronyms at least once in the body, because search matches the
  literal string. A page titled `SSO` will not surface for "single sign-on".
- Put the exact error text in the body of a troubleshooting page. `502 upstream
  timed out` is what someone will paste into search at 2am.

## Keep text as text

OneNote indexes typed text and runs optical character recognition (OCR) on
images, so image text is partially searchable. Partially is the problem. OCR
quality drops on low-contrast themes, small fonts, code with punctuation, and
anything rendered at screenshot resolution. Handwriting recognition on inked
pages is worse and language-dependent. Treat both as unreliable for retrieval.

A pasted screenshot of a terminal, a config file, a chat thread, or an error
dialog is a retrieval dead end: it cannot be searched reliably, cannot be
copied, cannot be diffed, and cannot be read by a screen reader.

Bad:

> [screenshot of a terminal showing the failing command and its output]

Good:

> Command that fails:
>
> ```bash
> ./scripts/deploy.sh --env staging --wait
> ```
>
> Error: `error: timed out waiting for rollout of deployment/api`
>
> [screenshot attached as supporting evidence, not as the only record]

Screenshots are fine as corroboration. They are not fine as the record. If the
only copy of a decision is a picture of a whiteboard, transcribe it on the same
page before closing it.

## Tags exist so the Tag Summary can find them

OneNote tags mark a line, not a page, and their payoff is the Tag Summary pane,
which collects every tagged line across a notebook into one list. That only
works if the tag vocabulary is small and shared.

- Pick five or fewer tags and write them at the top of the notebook's first
  page so newcomers use the same ones.
- Tag the actionable line, not the heading. `To Do` on a heading tells the
  summary nothing about what to do.
- Include the owner and the trigger in the tagged line itself, because the
  summary shows the line out of context: `To Do: Ana - revoke the old webhook
  secret after the Friday deploy`.
- Regenerate the summary rather than trusting an old one; it is a snapshot, not
  a live view.

Tags do not replace titles. A tag narrows within a notebook; a title is what
makes a page findable from anywhere.

## Links between pages are what make it a base

Copy Link to Page (right-click a page in the sidebar) yields a durable link that
survives moving the page between sections. Paste those links into other pages.
This is the single highest-leverage habit in OneNote, because a hierarchy can
only express one relationship per page and links express all the others.

Where links pay off:

- A meeting page links to the decision page it produced, and the decision page
  links back to the meeting.
- A runbook links to the incident that motivated it.
- Every section has an index page at the top linking the pages worth reading,
  in reading order. Sidebars sort alphabetically or by date; an index page
  sorts by importance.
- A superseded page opens with `Superseded by: <link>` rather than being
  deleted, so old links and old memories still land somewhere useful.

Bad: "See the other page about the migration."

Good: "See [Decision - drop MySQL 5.7 support](link) for the rationale."

## Templates for recurring page types

If a page type recurs, make it a template (Insert > Page Templates > save
current page as template) and set it as the default for a section. Consistency
beats completeness: identical headings make pages skimmable and make gaps
obvious.

Three templates carry most teams:

**Meeting.** Date and attendees, agenda, decisions, action items (each tagged
`To Do` with an owner), links to related pages. Decisions go above notes,
because that is what people come back for.

**Decision.** The decision in one sentence at the top, then context, options
considered, what was chosen and why, who decided, and what would make this
reversible. Nobody scrolls for the decision.

**Runbook.** Preconditions as a checklist, numbered steps with the exact
commands, how to verify success, how to roll back, and who to escalate to. Steps
must be copy-pasteable, which means no screenshots of commands.

## The sharing model is coarser than it looks

A OneNote notebook is a file in OneDrive or SharePoint, and sharing is a file
permission, not a page permission.

| Grant | What the recipient can reach |
| --- | --- |
| Share notebook, can edit | Every section and page in that notebook, including ones added later |
| Share notebook, can view | Same scope, read-only |
| "Anyone with the link" | Anyone holding the URL, no sign-in, forwardable, outside your directory |
| Share a section or page | Usually a copy or a link that still requires notebook-level access |

Consequences worth stating plainly:

- There is no reliable per-page permission. Confidential material needs its own
  notebook, not its own section.
- "Anyone with the link" means the link is the credential. Forwarded once, it is
  public for as long as it lives. Prefer named people or a group; if you must
  use a link, set an expiry and remove it afterwards.
- Access is inherited forward. A page added to a shared notebook next month is
  shared the moment you create it.

Before sharing, ask what the notebook will contain in six months, not what it
contains now.

## Sync conflicts and recovery

OneNote syncs per page and merges edits when they touch different parts of a
page. When two people edit the same paragraph while one is offline, it cannot
merge, so it keeps both: your version stays, and the other lands as a conflict
page (a red-marked copy, usually titled with the conflicting author and a
timestamp) placed next to the original. Nothing is discarded, but nothing is
merged either. Someone has to reconcile by hand and then delete the conflict
page.

- Conflict pages are easy to miss because they sit in the sidebar looking like
  ordinary pages. Check for them after any offline stretch.
- Page history (View > Page Versions) keeps recent versions per author and lets
  you restore or copy from one. It is retention-limited and it is not a version
  control system: no diffs, no branches, no commit messages, and history can be
  disabled or trimmed by an administrator.
- Deleted pages go to the notebook recycle bin and are purged after a retention
  window. After that, recovery depends on the OneDrive or SharePoint backup,
  not on OneNote.
- Do not rely on history as your safety net for anything you would be unable to
  rewrite. Export the notebook on a schedule instead.

## Export and portability: say it plainly

OneNote is the least portable of the major note apps, and no habit fully fixes
that. Plan around it rather than discovering it during a migration.

| Format | Keeps | Loses |
| --- | --- | --- |
| `.one` / `.onepkg` | Everything | Readable only by OneNote |
| PDF (page, section, notebook) | Visual layout | Links between pages, tag structure, editability |
| Word `.docx` (per page) | Text, most basic formatting, images | Free-form canvas positioning, page links, tags, history |
| Manual copy to Markdown | Text you move | Everything you do not move by hand |

What is lost in every non-`.one` path: the free-form canvas layout, inter-page
links as links, tag metadata as metadata, page history, and the notebook and
section structure as machine-readable hierarchy. Third-party converters exist
and vary in fidelity; verify a sample before trusting one with a whole notebook.

Two habits reduce the pain: keep content as plain text in a single top-to-bottom
column (canvas positioning is the least portable feature), and keep the
structural meaning in titles and body text rather than only in the hierarchy.

## Archiving finished notebooks

Closed projects should stop competing with live ones in search.

1. Add a final page titled `Archive note - <notebook name>` stating what the
   notebook covered, when it stopped being maintained, and where the successor
   lives.
2. Export the notebook to `.onepkg` and store it with your other backups.
3. Also export to PDF, so it stays readable without OneNote.
4. Remove edit permissions, keep read access for people who need it.
5. Close the notebook locally so it leaves your notebook list and your search
   results. Closing does not delete it; it can be reopened from OneDrive.

## When OneNote is the wrong tool

Move the content out rather than fighting the tool:

- **Structured data** (inventories, tracked issues, anything you want to filter,
  sort, or aggregate). A OneNote table has no types, no formulas across pages,
  and no queries. Use a spreadsheet or a database.
- **Documents needing review and diffs** (specs, policies, contracts). Page
  history has no diff view and no review workflow. Use Word with track changes,
  or a repository with pull requests.
- **Code, configuration, and anything a machine consumes.** Version control it.
- **Anything needing per-page access control.** The permission model cannot do
  it inside one notebook.
- **A long-lived record you must be able to migrate.** If portability is a hard
  requirement, choose plain files now instead of an export project later.

## Quick checklist

- Three levels of hierarchy at most; titles carry the rest.
- Every page title starts with a type and names its proper nouns.
- No pasted screenshot is the only copy of any text.
- Five or fewer tags, documented on the notebook's first page.
- Each section has an index page of links in reading order.
- Recurring page types have a template set as the section default.
- Confidential material lives in its own notebook, never its own section.
- No "anyone with the link" share without an expiry.
- Conflict pages checked after every offline stretch.
- Notebook exported to `.onepkg` and PDF on a schedule, not on demand.

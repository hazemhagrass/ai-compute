---
name: obsidian-zettelkasten
description: "Use when an Obsidian vault stops paying off. Keep notes atomic and linked so you can write from them later."
---

# Obsidian Zettelkasten

A vault is not a library. A library stores things you might read again; a
Zettelkasten stores things you have already thought, in a shape you can
assemble into new writing. The only claim made here is that one: linked atomic
notes let you draft from your notes instead of from a blank page. Nothing in
this skill makes you faster, and a vault with 4,000 notes is not evidence of
anything.

## Title every note as a claim, not a topic

A topic title is a folder in disguise: it invites you to keep appending to one
note forever, and it tells you nothing when it shows up in a backlink list. A
claim title states what the note argues, so a future backlink is readable
without opening it.

Bad:

> `Rate limiting.md`

Good:

> `Token buckets absorb bursts that fixed windows reject.md`

The test: read the title alone and ask whether you could disagree with it. If
disagreement is impossible, it is a topic and the note will grow unbounded.

## One idea per note, enforced by the refactor pass

A note holds one idea when you can restate its claim in a sentence without
using "and". When you cannot, split it. This is routine maintenance, not
failure, because notes accrete a second idea as you learn.

The split procedure:

1. Find the two claims. Write each as a title.
2. Create the second note. Move the supporting text into it.
3. In each note, add a sentence saying how it relates to the other, then link.
4. Reopen the backlinks of the original note. Repoint any that meant the idea
   that moved.

Step 4 is the one people skip, and skipping it silently strands references.

## Three note types, three different jobs

Mixing these is the most common reason a vault becomes unusable: you cannot
trust anything because you no longer know what is a quote, what is your idea,
and what is a stray thought.

| Type | Contains | Written in | Lives until |
| --- | --- | --- | --- |
| Fleeting | A raw capture, half a sentence | Whatever is at hand | Processed, then deleted |
| Literature | A source's argument in your words, with a page or locator | One per source | Permanent, but never edited as if it were yours |
| Permanent | Your claim, standing alone, linked | Careful prose | Forever, revised in place |

Rules that keep them apart:

- A literature note never states your opinion. Put the opinion in a permanent
  note and link to the literature note as its evidence.
- A permanent note never quotes at length. If it needs the quote, it needs the
  link to the literature note instead.
- A fleeting note that survives a week was actually a permanent note. Promote
  it or delete it; do not let it sit.

## Linking is the work, not the cleanup

A note with no links is a lost note. Not metaphorically: search will surface it
only if you remember its vocabulary, and you will not, because you wrote it
once. The link is what makes a note findable by the route people actually take,
which is arriving from an adjacent idea they were already thinking about.

Write the link sentence. A bare wikilink records that you noticed a connection
and discards what the connection was.

Bad:

> Related: [[Token buckets absorb bursts that fixed windows reject]]

Good:

> This is why per-user quotas feel unfair under bursty traffic:
> [[Token buckets absorb bursts that fixed windows reject]] smooths the burst,
> but the quota is still charged at the peak.

The second version is reusable prose. When you later write the piece, you paste
the sentence and it already carries the argument.

Minimum bar: every new permanent note leaves with at least one outbound link
and one sentence explaining it. If you cannot find anything to connect it to,
that is a signal the idea is not yet yours.

## Maps of Content instead of a folder tree

A Map of Content (MOC) is a note whose body is an annotated list of links into
one region of the vault. It is structure you discover after the notes exist,
not a taxonomy you guess at before.

A MOC earns its place when you notice you keep re-finding the same eight notes
together. Write it then, not earlier.

```markdown
# MOC - Rate limiting

Everything here answers: how do you shed load without punishing good clients?

- [[Token buckets absorb bursts that fixed windows reject]] is the default
  answer, and the rest of this map is about where it fails.
- [[Per-user quotas price fairness in the wrong unit]] explains why the
  bucket alone is not enough once clients differ in size.
- [[Backpressure beats rejection when the caller can wait]] is the
  alternative when you control both sides of the call.

Open question: nothing here covers coordinated multi-tenant fairness.
```

The annotations are the point. A MOC that is a bare bullet list of links is a
folder with extra steps.

## Folders, links, and tags each earn their place

| Mechanism | Good at | Fails at | Use it for |
| --- | --- | --- | --- |
| Folders | Exactly one location per note | Ideas that belong in two places | Note type only: `fleeting/`, `literature/`, `permanent/` |
| Links | Expressing why two ideas relate | Broad sweeps across the vault | The primary structure, always |
| Tags | Cutting across the tree by state | Being a topic hierarchy | Workflow state: `#needs-source`, `#to-split` |
| MOCs | Curated entry points with reasoning | Completeness | Regions you enter often |

The failure is using tags as a second topic hierarchy. `#productivity` on 300
notes tells you nothing that opening the tag pane does not immediately undo.

## Note IDs and title stability

Obsidian updates links when you rename a note, but only inside the vault, only
with "Automatically update internal links" enabled, and only for links it can
parse. Anything outside that boundary breaks silently: notes you exported,
links in a synced task manager, URLs you shared.

Two workable policies. Pick one per vault and do not mix them.

- **Title as identity.** Filenames are the claim. Links read naturally. Accept
  that renaming is an event you do deliberately, with the setting on, and that
  external references will break.
- **Timestamp ID as identity.** Filenames are `202409221431 Token buckets
  absorb bursts.md`. The ID never changes, so renames are cosmetic and external
  links survive. Cost: links read worse unless you alias every one.

Check the setting before you trust either:

```
Settings -> Files and links -> Automatically update internal links: ON
Settings -> Files and links -> Default location for new notes: (a fixed folder)
```

## Daily notes are an inbox, not a filing system

A daily note is where capture lands so that capture is never blocked by a
decision about where something goes. It is not where the idea lives.

Bad: a daily note containing a three-paragraph worked-out argument, which is
now findable only if you remember the date you had the thought.

Good: a daily note line that says `caught: fixed windows punish bursty clients
-> promote`, which you process within the week into a titled permanent note,
then strike through in the daily.

Process the inbox on a fixed cadence. An unprocessed daily note from five weeks
ago is a fleeting note that outlived its week.

## Search and graph view are diagnostics

The graph is not a picture of your thinking. It is a picture of your linking
discipline, which makes it useful for exactly two checks:

- **Orphans.** Filter to notes with no links. Each one is either unfinished or
  should not exist. Both are actionable.
- **Hubs.** A note with 40 backlinks is usually two or three notes that never
  got split. Read it and run the refactor pass.

Search is the better daily tool. Two queries worth keeping:

```
path:permanent/ -[[
tag:#to-split
```

The first finds permanent notes containing no outbound wikilink. The second is
your own refactor queue. Neither is decorative; both produce a list of notes to
fix today.

## Plugin restraint and vault portability

The durable asset is a folder of plain markdown. Every plugin that stores data
outside the note body is a bet that the plugin will outlive your interest in
the notes.

- Safe: plugins that read and write ordinary markdown (link helpers, templates
  that expand to plain text).
- Risky: plugins whose output only renders inside Obsidian (custom block
  syntaxes, database views backed by plugin state).
- Test: open the vault in any plain text editor. Anything unreadable there is
  something you will lose.

Keep frontmatter minimal and standard. `source`, `created`, and `tags` survive
any tool; a plugin-specific key does not.

## Sync conflicts and backup

Markdown merges badly because a note is one long paragraph-shaped blob, so the
goal is avoiding concurrent edits, not resolving them.

- Close the vault on one device before editing on another. Most conflicts come
  from a background sync on a device you thought was idle.
- Expect conflict artifacts as separate files (`note (conflicted copy).md` or
  similar, depending on the sync tool). Search for the pattern weekly rather
  than discovering them by accident.
- Back up with git, in addition to whatever sync you use. Sync propagates
  deletions; git lets you recover from them. Commit on a schedule, not by hand.
- Exclude the workspace and plugin cache from git so every device does not
  produce a diff on open.

## Quick checklist

- Every new note titled as a claim you could disagree with.
- Every permanent note leaves with one outbound link and a link sentence.
- Fleeting notes processed or deleted within the week.
- Literature notes carry a locator and none of your opinions.
- Tags describe workflow state, not topics.
- Orphan query run periodically; hubs split rather than admired.
- Vault readable in a plain text editor with every plugin removed.

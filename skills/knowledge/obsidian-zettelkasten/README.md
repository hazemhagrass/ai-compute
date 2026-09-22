# Obsidian Zettelkasten

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="obsidian-zettelkasten robot" width="200">
</div>

A method for running an Obsidian vault as a Zettelkasten, so that linked atomic notes can be assembled into writing later instead of accumulating unread.

## What it does

This skill gives you a set of rules for a note vault, each aimed at one
specific way vaults stop being useful.

| Rule | Prevents |
| --- | --- |
| Title every note as a claim | Topic notes that grow forever and say nothing in a backlink list |
| One idea per note | Hub notes nobody can cite because they argue three things |
| Separate fleeting, literature, permanent | Losing track of what is a quote and what is your own thinking |
| Write the link sentence | Bare wikilinks that record a connection and discard what it was |
| Maps of Content over folders | Guessing a taxonomy before the notes exist |
| Folders, links, tags each scoped | Tags degenerating into a second, worse folder tree |
| Stable IDs and rename policy | Links breaking silently outside the vault |
| Daily notes as inbox only | Arguments buried under the date you happened to think them |
| Graph and search as diagnostics | Admiring the graph instead of fixing orphans |
| Plugin restraint | A vault that only opens in one version of one app |
| Sync and backup discipline | Conflict copies found weeks later, deletions propagated everywhere |

The honest claim: none of this makes you think faster or produce more. It makes
a specific later task possible, which is drafting a piece from notes you
already wrote rather than from an empty document.

## When to use this

Use it when:

- You have a vault with hundreds of notes and have never written anything out
  of it.
- Your notes are long topic files (`Rate limiting.md`) that you keep appending
  to and never read.
- You capture constantly into daily notes and nothing ever leaves them.
- You are choosing between folders, tags, and links and keep changing your mind.
- You are about to install a plugin that stores structure outside the markdown.
- You are setting up a new vault and want the conventions decided before the
  note count makes them expensive to change.

Do not use it for: project or task management (a Zettelkasten has no concept of
done), reference storage where you only need retrieval and never synthesis
(a search index is cheaper), or team wikis where the audience is other people
rather than your future writing self. Those want stable shared structure, which
is the opposite of emergent structure.

## Quick start

You just read an article about rate limiting and have a rough thought. Here is
the full round trip from capture to a note that will still be useful.

**1. Capture in today's daily note.** Do not decide anything yet.

```markdown
# 2024-09-22

- caught: fixed windows punish bursty clients even when they are under quota
  -> promote
```

**2. Write the literature note.** Source's argument, your words, with a
locator, no opinions.

```markdown
---
source: "Smith, Designing Rate Limiters, ch. 4"
created: 2024-09-22
tags: [literature]
---

# Smith on fixed windows

Smith describes the boundary effect: a fixed window counter resets at a wall
clock instant, so a client can send a full window's allowance just before the
reset and again just after, producing twice the intended rate over that span
(ch. 4, "Window boundaries").
```

**3. Write the permanent note.** Title is a claim. It links out, with a
sentence explaining the link.

```markdown
---
created: 2024-09-22
tags: [permanent]
---

# Token buckets absorb bursts that fixed windows reject

A fixed window makes a binary decision at a clock boundary, so identical
traffic is accepted or rejected depending on when it arrives. A token bucket
carries capacity across that boundary, which means burstiness stops being a
timing accident.

The failure this fixes is documented in [[Smith on fixed windows]]: the
boundary effect is the same mechanism seen from the abuse side, where a client
exploits the reset rather than being punished by it.

This is why per-user quotas still feel unfair under bursty traffic:
[[Per-user quotas price fairness in the wrong unit]] shows the bucket smooths
the burst but the quota is charged at the peak.
```

**4. Strike the daily note line.** The idea now lives somewhere titled.

```markdown
- ~~caught: fixed windows punish bursty clients~~ -> promoted
```

**5. Check the orphan query.** In Obsidian search:

```
path:permanent/ -[[
```

Expect the new note not to appear. If it does, it left without an outbound
link and you are one week from forgetting it exists.

## Key concepts

**Atomicity is testable.** A note holds one idea if you can restate its claim
in one sentence without "and". The test is mechanical, which matters because
"is this atomic enough" is otherwise an unanswerable question you will use to
procrastinate.

**Claim titles over topic titles.** Read the title alone and ask whether you
could disagree with it. `Rate limiting` is not disagreeable, so it is a
container and will grow without limit. `Token buckets absorb bursts that fixed
windows reject` is a position, so it has a natural boundary.

**The link sentence is the deliverable.** A wikilink records that a connection
exists. A sentence records what the connection is, which is the part you cannot
reconstruct later. It is also reusable prose: when you finally write the piece,
link sentences are the paragraphs you already have.

**Emergent structure.** A Map of Content is written after you notice you keep
re-finding the same notes together, never before. Predefined folders force a
decision at capture time, when you know the least about where an idea belongs.

**Note types are a trust boundary.** Literature notes carry a source and no
opinion. Permanent notes carry your claim and no long quotes. Keeping them
separate is what lets you cite your own vault without re-verifying everything.

**Titles are addresses.** Renaming rewrites links inside the vault only, and
only with the update setting enabled. Either commit to title-as-identity and
rename deliberately, or use timestamp IDs so the address never moves.

**Portability is the real asset.** Plain markdown in a folder outlives the app.
Anything a plugin stores outside the note body is data you will lose the day
the plugin stops being maintained.

## Common pitfalls

### Linking without saying why

Bad:

> Related: [[Token buckets absorb bursts that fixed windows reject]]

Good:

> This is why per-user quotas feel unfair under bursty traffic:
> [[Token buckets absorb bursts that fixed windows reject]] smooths the burst,
> but the quota is still charged at the peak.

The reason: in six months the bare link tells you two notes touched, and you
will reopen both to rediscover something you already knew once.

### Titling by topic

Bad: `Rate limiting.md`

Good: `Token buckets absorb bursts that fixed windows reject.md`

The reason: a topic title has no boundary, so the note absorbs every related
thought and becomes uncitable. A claim title fills up and tells you to split.

### Using tags as a topic hierarchy

Bad: `#productivity`, `#systems`, `#engineering` on every note.

Good: `#needs-source`, `#to-split` on the notes that need work.

The reason: a topic tag with 300 members is a list you cannot act on. A state
tag is a queue that empties, so opening it produces work rather than browsing.

### Leaving arguments in daily notes

Bad: a daily note containing three paragraphs working out why backpressure
beats rejection.

Good: a daily note line reading `caught: backpressure beats rejection when the
caller can wait -> promote`, processed into a titled note within the week.

The reason: a daily note is addressed by date, and you will not remember the
date. Nothing in a daily note is findable by the idea it contains.

### Admiring the graph

Bad: opening graph view, observing that it looks dense, closing it.

Good: filtering to orphans and splitting any note with 40 backlinks.

The reason: density reflects linking habit, not understanding. The graph is
only useful when a specific query returns a specific list of notes to fix.

### Trusting the plugin to keep your data

Bad: structure stored in a plugin's own database or a custom block syntax that
renders only in Obsidian.

Good: structure stored as wikilinks and plain frontmatter keys (`source`,
`created`, `tags`).

The reason: open the vault in any text editor. Whatever is unreadable there is
what you lose when the plugin stops being maintained.

### Editing on two synced devices

Bad: leaving the vault open on a desktop while editing on a phone.

Good: closing the vault on one device first, and grepping weekly for conflict
copies (`note (conflicted copy).md` or your sync tool's equivalent).

The reason: markdown notes are one long blob, so sync tools cannot merge them
and silently keep both. Also keep git alongside sync: sync propagates a
deletion everywhere, git lets you undo it.

## See also

- [literature-review](../../research/literature-review/SKILL.md) for searching a
  body of work systematically before it becomes literature notes.
- [citation-manager](../../research/citation-manager/SKILL.md) for keeping the
  source locators in literature notes verifiable.
- [truth-first](../../research/truth-first/SKILL.md) for not letting a
  paraphrase in a literature note drift into a claim the source never made.
- [blog-post-writer](../../writing/blog-post-writer/SKILL.md) for the step this
  whole method exists to serve: writing the piece from the notes.
- [technical-writing](../../writing/technical-writing/SKILL.md) for the house
  rules on worked examples and bad/good pairs used throughout this skill.

---
name: context-file-audit
description: "Use when auditing always-loaded agent context files. Classify decay, verify every claim, change nothing before approval."
---

# Context File Audit

Persistent context is the text an agent reads before every single turn: memory
files, a user profile, a root instructions file, per-project rule files. It is
the most expensive text in the system, because it is paid for on every turn, and
the least reviewed, because nothing forces a review.

It rots in predictable ways. A fact that was true when written stops being true.
A rule gets written twice in different words, so a later edit fixes one copy and
leaves the other. Two entries end up in direct conflict and the agent follows
whichever it read last. An entry describes a tool that is no longer installed.

This skill is the audit that catches that. It is read-only until a human says
otherwise, and every finding is backed by evidence from the machine rather than
by rereading the entry and agreeing with it.

## The read-only contract

The audit changes nothing. No file is written, no entry is removed, no config is
touched, until the human approves specific changes.

This is not caution for its own sake. An agent auditing its own context is
judging the instructions it is currently operating under, and the cheapest
outcome is always to declare them fine. Forcing the audit to produce a proposal
that a human approves makes the conclusion falsifiable.

If approval does not arrive, the turn ends and nothing has changed.

## What counts as an always-loaded file

Audit what is actually injected into every session, not everything that looks
like documentation:

- Agent memory files, whatever the runtime calls them
- A user or profile file describing who the human is
- A root instructions file that applies to every session
- Per-project rule files, when the audit is scoped to that project

Do not audit task-scoped files that load only when a matching task appears. They
are not paid for on every turn, so they are governed by a different standard and
a different skill.

## The six decay modes

Classify every entry into exactly one of these. "Good" and "bad" are not
categories, because they carry no instruction about what to do next.

| Mode | Test | Action |
|---|---|---|
| Stale | The world moved: the path, tool, version, or role named no longer matches reality | Propose removal or a corrected rewrite |
| Duplicate | The same instruction appears twice, in the same file or across two | Propose keeping the clearer one, deleting the other |
| Contradictory | Two entries cannot both be followed | Name both, recommend one, ask |
| Unverifiable | No way to confirm it against the machine, the repo, or the human | Flag as unverified, do not silently keep |
| Misplaced | It is a procedure or a lesson tied to one kind of task | Propose moving to a task-scoped file |
| Inert | True, confirmable, and changes no decision the agent makes | Propose removal |

Inert is the mode people miss. An entry can be perfectly accurate and still earn
nothing, because no behaviour differs whether it is present or absent.

Bad, because nothing acts differently either way:

```
User has a laptop and a desktop.
```

Good, because it changes a command the agent would otherwise get wrong:

```
Python is python3 on this machine; plain `python` is not on PATH.
```

## Verify against the machine, not against the text

An entry is confirmed by checking something outside the file. Rereading it and
finding it plausible is not verification.

| Claim shape | Where the evidence is |
|---|---|
| A path or directory exists | The filesystem |
| A tool or runtime is available | Ask the shell which version answers |
| A project convention holds | The repo: its config, its history, its existing files |
| A service or port is in use | The running process list |
| A preference about how the human works | The human. Ask |

Bad, an audit line with no evidence behind it:

```
Entry looks fine and is still relevant.
```

Good, an audit line that names what was checked:

```
Entry: "deploy script lives at scripts/deploy.sh"
Checked: file does not exist; scripts/ contains deploy.mjs
Mode: stale. Proposed: update the filename.
```

Anything that cannot be checked is reported as unverifiable, with the reason. An
unverifiable entry is not automatically wrong, and it is not automatically kept
either. It goes to the human with its status stated plainly.

## Contradictions get named, never resolved alone

When two entries conflict, report both, recommend one, and ask. Do not pick
silently.

The reason is specific to contradictions: both entries looked correct to whoever
wrote them, and the conflict usually encodes a real change of mind that only the
human can date. Picking the newer one is a guess that reads as a decision.

Bad:

```
Removed the older conflicting entry about commit style.
```

Good:

```
Contradiction in MEMORY.md:
  (a) "Commits reference issues with Refs #N, never Closes #N"
  (b) "Close the issue in the commit message when work is done"
Both cannot hold. (a) matches every commit in this repo's history.
Recommend keeping (a) and deleting (b). Confirm before I touch either.
```

## Imperative phrasing hijacks later sessions

An always-loaded entry written as a command is re-read as a standing order in
every future session, including sessions where the human is asking for something
else. Declarative phrasing carries the same information without competing with
the current request.

Bad, a memory entry that overrides live instructions:

```
Always respond in under three sentences.
```

Good, the same fact stated as a fact:

```
User usually prefers short answers.
```

Flag imperative entries during the audit and propose the declarative rewrite.
This is a rewrite, not a deletion, so it is usually the easiest finding for a
human to approve.

## The placement test

Most bloat is misplacement rather than excess. Ask one question of every entry:

**Does this apply to every session regardless of the task?**

If yes, it belongs in always-loaded context. If it only matters while doing one
kind of work, it belongs in a task-scoped file that loads when that work
appears, where it can be longer and more detailed at no per-turn cost.

Bad, in always-loaded memory:

```
When migrating the database: take a backup, run the migration against a copy
first, check the rollback path, then apply.
```

Good, in always-loaded memory:

```
Production database is Postgres 16 on the app host.
```

The migration procedure is not wrong. It is a procedure, so it moves to the file
that loads when a migration is happening.

## What an entry costs

An always-loaded entry is read on every turn for as long as it exists. Two
consequences follow.

A short precise entry beats a long vague one, not because short is a virtue but
because the vague one will be re-read many times without ever changing an
outcome.

Do not set an entry count or a word budget. A count cannot tell a dense rule
from a padded one, so optimising for it removes whichever entries happen to be
long and keeps whichever happen to be short. Judge each entry on whether it
changes a decision, and let the total be whatever that produces.

## Procedure

1. List every always-loaded file with its path and one line on what it is for.
   If the runtime's file names are not known, ask rather than assume.
2. Read each file fully. Do not skim, and do not summarise before classifying.
3. Classify every entry into one of the six modes, with the evidence checked for
   each. Entries that pass all tests are reported as verified, not silently
   dropped from the report.
4. Collect contradictions separately, since they need an answer rather than an
   approval.
5. Produce a per-file proposal: the file as it is now, and the file as it would
   be, with each change traceable to a finding.
6. Stop. Ask for approval, including answers to any contradictions.
7. Apply only what was approved. Report what changed per file, and say plainly
   when a proposed change was not approved and was therefore skipped.

## Reporting format

Report per file, not as one flat list, because approval is per file and a human
reading a flat list cannot tell how much of any one file is about to change.

For each file give the findings first, then the before and after. Keep the
before and after limited to the lines that change plus enough surrounding text
to locate them. Printing an entire unchanged file hides the diff inside noise.

## Pitfalls

**Auditing your own instructions is biased toward approval.** The evidence
requirement exists to counter that. An audit that finds nothing on a file that
has never been audited is a result worth double checking, not a clean bill.

**A confident entry is not a verified one.** Specific, well written entries feel
true. Check the path, the version, the convention.

**Removing a stale entry can remove the only record of a decision.** When an
entry is stale because a decision changed, propose the corrected entry rather
than deletion, so the current decision stays written down.

**Two files can each be internally consistent and still conflict.** Check across
files, not only within one.

**The human's answer is evidence.** For preferences and intentions, asking is
the verification step, not a failure to verify.

## See also

- [skill-authoring](../skill-authoring/README.md) for where task-scoped
  procedures belong once they are moved out of always-loaded context

# Context File Audit

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

An audit for the files an agent reads before every turn: classify how each entry has decayed, check every claim against the machine, and change nothing until a human approves.

## What it does

`SKILL.md` in this directory encodes a procedure for reviewing always-loaded
agent context: memory files, a user profile, a root instructions file, and
per-project rule files.

The audit does four things a casual review does not:

1. **Classifies rather than judges.** Every entry lands in one of six decay
   modes (stale, duplicate, contradictory, unverifiable, misplaced, inert), and
   each mode carries its own action. "Looks fine" is not an outcome.
2. **Requires evidence from outside the file.** A path is confirmed against the
   filesystem, a tool against the shell, a convention against the repo. Reading
   an entry and finding it plausible does not count.
3. **Stays read-only until approved.** Nothing is written, moved, or deleted
   during the audit. The output is a proposal with before and after per file.
4. **Escalates contradictions instead of resolving them.** When two entries
   conflict, both are named and one is recommended, but the human decides.

## When to use this

Load it when:

- Persistent context has grown and nobody has read it end to end in a while
- An agent has acted on something that is no longer true
- Two instructions seem to conflict and you want them found rather than guessed
- Setting up a new machine or project and importing context from an old one
- Before handing an agent config to someone else

Do not load it to write a *new* memory entry. That is a one-line decision, not
an audit. This skill is for reviewing what already accumulated.

Do not use it on task-scoped files that load only when a matching task appears.
Those are not paid for on every turn and are governed by a different standard.

## Quick start

Point the agent at this skill and let the procedure run. It will:

1. List every always-loaded file with its path and purpose. If it cannot tell
   which files the runtime injects, it asks rather than assumes.
2. Read each file completely and classify every entry with its evidence.
3. Collect contradictions separately, because those need an answer rather than
   an approval.
4. Show each file as it is and as it would be.
5. Stop and wait.

A finding looks like this:

```
Entry: "deploy script lives at scripts/deploy.sh"
Checked: file does not exist; scripts/ contains deploy.mjs
Mode: stale. Proposed: update the filename.
```

The evidence line is the part that matters. An audit line reading "entry looks
fine and is still relevant" has checked nothing.

## Key concepts

### The six decay modes

**Stale** is the obvious one: the path, tool, version, or role named no longer
matches reality.

**Duplicate** matters more than it looks. When the same rule is written twice in
different words, a later edit fixes one copy and leaves the other, and now the
file contradicts itself without anyone having written a contradiction.

**Contradictory** entries cannot both be followed. The agent follows whichever
it read last, which makes behaviour depend on file order.

**Unverifiable** is a status, not a verdict. It means no evidence is available,
so the entry goes to the human with that stated. It is neither silently kept nor
silently removed.

**Misplaced** entries are correct but in the wrong file. A procedure tied to one
kind of task belongs where it loads for that task, not in every session.

**Inert** entries are the ones people miss. Accurate, confirmable, and they
change no decision the agent makes:

Bad, because nothing acts differently either way:

```
User has a laptop and a desktop.
```

Good, because it changes a command the agent would otherwise get wrong:

```
Python is python3 on this machine; plain `python` is not on PATH.
```

### Imperative phrasing hijacks later sessions

An always-loaded entry written as a command is re-read as a standing order in
every future session, including ones where the human is asking for something
else.

Bad, this competes with live instructions:

```
Always respond in under three sentences.
```

Good, same information, no hijack:

```
User usually prefers short answers.
```

The audit flags imperative entries and proposes the declarative rewrite. It is
usually the easiest finding to approve, because nothing is lost.

### The placement test

One question decides where an entry belongs: **does this apply to every session
regardless of the task?**

Yes means always-loaded. Otherwise it belongs in a task-scoped file, where it
can be longer and more detailed at no per-turn cost. Most bloat is misplacement
rather than excess.

### No word budget

The skill deliberately ships no entry count or character target.

A count cannot distinguish a dense rule from a padded one. Optimising for it
removes whichever entries happen to be long and keeps whichever happen to be
short, which is uncorrelated with which ones earn their place. Each entry is
judged on whether it changes a decision, and the total is whatever that
produces.

## Common pitfalls

**An agent auditing its own instructions is biased toward approval.** The
cheapest outcome is to declare everything fine. The evidence requirement and the
human approval step exist to make the conclusion falsifiable. An audit that
finds nothing in a file nobody has ever reviewed deserves a second pass.

**A confident entry is not a verified one.** Specific, well written entries feel
true. That feeling is not evidence. Check the path.

**Removing a stale entry can delete the only record of a decision.** When an
entry is stale because a decision changed, propose the corrected version rather
than deletion, so the current decision stays written down somewhere.

**Two files can each be internally consistent and still conflict with each
other.** Check across files, not only within one.

**Silently picking the newer of two conflicting entries reads as a decision.**
It is a guess. Both entries looked right to whoever wrote them, and only the
human knows which survived.

**Printing whole unchanged files hides the diff in noise.** Show the lines that
change plus enough context to locate them.

**Asking the human is a verification step.** For preferences and intentions,
there is no filesystem to check. Asking is the evidence, not an admission of
failure.

## See also

- [skill-authoring](../skill-authoring/README.md) for where task-scoped
  procedures belong once they move out of always-loaded context

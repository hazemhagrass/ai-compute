---
name: skill-authoring
description: "Use when writing or editing an agent skill file. Enforces trigger-first descriptions, lessons over logs, and progressive disclosure."
---

# Skill Authoring

A skill is a file another agent loads when it recognises a matching task. It has
exactly one job: make an agent that has no other context act correctly. Every
rule below serves that job.

## Frontmatter mechanics

Two fields are required: `name` and `description`.

`name` must match the skill's directory name, lowercase, hyphens only, under 64
characters. A mismatch means the loader cannot resolve the file by name.

`description` is the only text a model sees before deciding whether to load the
skill. The first 57 characters are the trigger it pattern-matches on, so those
characters must describe the SITUATION, not the skill. Lead with
`Use when <trigger>.` then one short clause of behavior.

Bad:

```yaml
description: "This skill provides comprehensive guidance and best practices for database migration workflows."
```

The first 57 characters are "This skill provides comprehensive guidance and best pr" which matches nothing.
A description that opens by describing itself is a skill that never loads.

Good:

```yaml
description: "Use when a migration fails to deploy or a schema changes. Ordering, backfills, rollback rules."
```

The first 57 characters carry a failure symptom and a task type, both of which
an agent can match against what it is currently doing.

Rules:

- Start `description` with `Use when`. No exceptions.
- Put the trigger conditions first, the behavior second.
- Name concrete artifacts in the trigger (file types, commands, error text, tool
  names). Agents match on nouns they can see in their own context.
- Keep `description` to one or two sentences. It is an index entry, not a summary.
- Do not put the skill name inside the description. The name is already indexed.

## Write lessons, not logs

A lesson transfers to a situation the author never saw. A log describes one
situation that already ended.

Log (useless):

> During the checkout outage we found that the retry wrapper was swallowing the
> 409 from the payments API, which took three hours to track down.

Lesson (useful):

> Never swallow 4xx in a retry wrapper: retrying a 409 hides a conflict the
> caller must resolve, so re-raise every non-5xx status.

Logs fail for two reasons. They date the skill, so a reader has to judge whether
the story still applies, and judging costs more than reading. And they contain
no instruction: the reader has to reverse-engineer the rule from the narrative,
and different readers reverse-engineer different rules.

Convert every war story into the imperative rule it produced, then delete the
story. If a rule looks arbitrary without its reason, attach the reason in the
same sentence (`because ...`), not a paragraph of history.

## One rule per line

- Imperative mood: "Validate the payload before dispatch", not "The payload
  should ideally be validated".
- One rule per bullet. Two rules in one bullet means the second gets skipped.
- Attach the reason only when the rule looks arbitrary. Obvious rules do not
  need justifying, and padding makes the skimmable parts unskimmable.
- No hedging words: "generally", "usually", "consider", "it may be wise to". An
  agent reading a hedge treats the rule as optional. If it is optional, state
  the condition under which it applies instead.

## Ban dates and incident narration

Never put any of these in a skill: calendar dates, PR numbers, ticket ids,
commit hashes, release versions tied to a moment, person names, or sentences
beginning "we discovered", "recently", "as of".

They make the skill look stale even when the rule is still true, and a reader
who distrusts one section distrusts the file. Version numbers are allowed only
when they are part of a stable constraint (`requires Python 3.10+ for
`match`/`case``), never as a changelog.

## Progressive disclosure

Keep SKILL.md short and skimmable: the rules an agent needs to act, and nothing
else. Depth goes into `references/` files, linked from the body, so they cost
nothing until the agent actually needs them.

- Name reference files by TOPIC, not by type or origin:
  `references/rollback.md`, not `references/notes-2.md` or `references/misc.md`.
- Link each reference from the body with a line saying when to open it:
  `See references/rollback.md when a migration has already shipped.`
- A reference file that nothing links to will never be read. Link it or delete it.

Target for SKILL.md: roughly 150 to 240 lines. Past that, move the deepest
section into a reference and leave a one-line pointer.

## Extend before you fragment

Add to an existing reference file before creating a new one. Fragmentation is
worse than length: an agent reading one 400-line reference has the whole topic,
while an agent facing six 60-line files has to guess which ones matter and will
miss at least one.

Create a new reference only when the new material has a different trigger, that
is, a reader would open it at a different moment than any existing file.

## Include counter-examples

Most skills fail by being too vague to act on, not by being wrong. A reader
cannot tell a vague rule from a precise one until they see both.

Vague:

> Handle errors appropriately and make sure the code is well tested.

Actionable:

> Wrap every external call in a timeout (default 10s) and assert on the error
> branch in tests, not just the success branch.

Pair the two forms wherever a rule risks sounding like advice. The contrast is
what teaches.

## Directory layout

```
skills/<category>/<name>/
  SKILL.md           required
  references/        optional, topic-named deep dives
  scripts/           optional, runnable helpers
  templates/         optional, files meant to be copied
```

- All supporting files live inside the skill's own folder. A skill that reaches
  into a sibling skill's directory breaks when either one moves.
- Reference paths in the body are relative to the skill folder.
- Scripts must run from the repo root and state their own invocation in a
  comment at the top, because the agent will not read the whole file first.

## Minimal template

Copy this and fill it in.

```markdown
---
name: my-skill
description: "Use when <observable trigger>. <One line of behavior>."
---

# My Skill

<One or two sentences: what this covers and what it deliberately excludes.>

## When to use

- <Concrete situation 1>
- <Concrete situation 2>
- Not for: <the nearest adjacent case this skill does NOT cover>

## Rules

- <Imperative rule>, because <reason, only if non-obvious>.
- <Imperative rule>.

## Workflow

1. <First action, with the exact command or file to touch.>
2. <Second action.>
3. <Verification step: how the agent knows it worked.>

## Counter-examples

Vague: <the version that sounds fine but cannot be acted on>
Actionable: <the version with a threshold, command, or named artifact>

## References

- references/<topic>.md: open when <trigger for that depth>.
```

## Test before you ship

One question decides it: could another agent, given this file and nothing else,
act correctly?

Run these checks:

- Read only the first 57 characters of `description`. Do they say when to load
  the skill? If not, rewrite them.
- Find every claim with no action attached. Delete it or turn it into a rule.
- Find every rule with no threshold, command, or named artifact. Make it
  concrete or cut it.
- Hand the skill to a fresh agent on a real task in scope. Wherever it asks a
  question the skill should have answered, that gap is the next edit.
- Grep the file for dates, ticket ids, and "we discovered". Should return nothing.

## When not to write a skill

- One-off knowledge. If the situation will not recur, put it in the reply, not
  in a file.
- Anything that belongs in code: a default value, a validation rule, a lint
  rule. Code enforces; a skill only advises, and advice loses.
- Anything that belongs in a comment next to the line it explains. Proximity
  beats a separate file.
- Anything that will be stale in a week (a temporary workaround, an in-flight
  migration, a pinned broken dependency). A stale skill is worse than no skill,
  because it is followed.
- Restating a tool's own documentation. Link it and record only what the docs
  get wrong or leave out.

## Editing an existing skill

- Patch the specific lines. Do not rewrite a whole SKILL.md to change one rule:
  wholesale rewrites lose accumulated detail that looked redundant.
- When a rule proves wrong, replace it. Do not append a contradicting rule
  lower in the file; an agent reads both and follows the first.
- When you learn something new, first check whether it sharpens an existing
  rule. A sharper rule beats an additional one.
- Keep the file's ordering stable: triggers, rules, workflow, references.
  Readers skim by position.

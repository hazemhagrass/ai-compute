# Skill Authoring

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

A skill for writing agent skills: how to phrase the description so the skill actually loads, how to turn experience into rules an agent can follow, and when to not write a skill at all.

## What it does

`SKILL.md` in this directory encodes the rules for authoring and editing agent
skill files. It covers five areas:

1. **Frontmatter mechanics.** `name` must match the directory name. `description`
   must start with `Use when` and carry the trigger in its first 57 characters,
   because that prefix is all a model sees when deciding whether to load the file.
2. **Lessons over logs.** Every war story gets converted into the imperative rule
   it produced, and the story gets deleted.
3. **Rule style.** Imperative mood, one rule per bullet, no hedging words, reasons
   attached only when the rule looks arbitrary.
4. **Progressive disclosure.** Keep `SKILL.md` at roughly 150 to 240 lines and push
   depth into topic-named files under `references/`, each linked from the body with
   a line saying when to open it.
5. **Ship checks.** A short list of greps and rewrites to run before declaring a
   skill done, plus the cases where the right answer is to write no skill.

It also ships a minimal `SKILL.md` template you can copy directly.

## When to use this

Load this skill when you are:

- Creating a new skill directory and writing its `SKILL.md` from scratch.
- Editing an existing skill because a rule turned out to be wrong or too vague.
- Reviewing someone else's skill and needing a concrete standard to review against.
- Deciding whether a piece of knowledge belongs in a skill, in code, in a comment,
  or just in a reply.
- Debugging a skill that exists but never gets loaded (almost always a
  `description` problem).

Do not load it for writing product documentation or user-facing READMEs. Those
have different readers and different rules.

## Quick start

Say you keep hitting the same problem: agents run database migrations without
checking whether the migration has already shipped, and rollbacks go wrong. That
recurs, so it earns a skill.

**1. Create the directory.** The folder name is the skill name.

```
skills/software-development/database-migrations/
  SKILL.md
```

**2. Write the frontmatter trigger first.** Start from the situation, not the
subject matter.

```yaml
---
name: database-migrations
description: "Use when a migration fails to deploy or a schema changes. Ordering, backfills, rollback rules."
---
```

Count the first 57 characters: `Use when a migration fails to deploy or a schema changes.`
That prefix names a failure symptom and a task type, both of which an agent can
match against its own context.

**3. Write the body as rules, not narrative.** You remember an incident where a
backfill locked a large table for twenty minutes. Do not write the incident.
Write what it taught:

```markdown
## Rules

- Backfill in batches of 1000 rows with a commit between batches, because a
  single-statement backfill holds a lock for the length of the whole table scan.
- Add the column nullable first, backfill, then add the NOT NULL constraint in a
  separate migration.
- Never drop a column in the same release that stops writing to it.
```

**4. Add a workflow with real commands.**

```markdown
## Workflow

1. `npm run migrate:status` to confirm which migrations have already shipped.
2. Write the up migration and a matching down migration in the same file.
3. `npm run migrate:up && npm run migrate:down && npm run migrate:up` locally to
   prove the rollback path works.
```

**5. Push depth into a reference and link it.**

```
skills/software-development/database-migrations/
  SKILL.md
  references/rollback.md
```

In `SKILL.md`:

```markdown
See references/rollback.md when a migration has already shipped to production.
```

**6. Run the ship checks.**

- Read only the first 57 characters of `description`. Do they say when to load
  the skill?
- Grep for dates, ticket ids, and "we discovered". Should return nothing.
- Find every rule with no threshold, command, or named artifact. Make it concrete
  or cut it.

## Key concepts

**The 57-character trigger.** A model choosing which skill to load sees the
description prefix and nothing else. A description that opens by describing
itself ("This skill provides comprehensive guidance...") matches nothing and the
skill never loads, no matter how good the body is.

**Lesson vs log.** A lesson transfers to a situation the author never saw. A log
describes one situation that already ended. Logs fail twice over: they date the
skill, so the reader has to judge whether the story still applies, and they carry
no instruction, so different readers reverse-engineer different rules from the
same narrative.

**Progressive disclosure.** `SKILL.md` carries the rules needed to act. Depth
goes into `references/` files that cost nothing until an agent actually opens
them. Every reference needs a link in the body stating its trigger, because a
reference nothing links to will never be read.

**Extend before you fragment.** Add to an existing reference before creating a
new one. One 400-line reference gives an agent the whole topic; six 60-line files
force it to guess which ones matter, and it will miss at least one. Create a new
reference only when the material has a genuinely different trigger.

**Counter-examples teach.** Most skills fail by being too vague to act on, not by
being wrong. A reader cannot tell a vague rule from a precise one until they see
both side by side, so pair the two forms wherever a rule risks sounding like
generic advice.

**Directory layout.** Everything a skill needs lives inside its own folder:

```
skills/<category>/<name>/
  SKILL.md           required
  references/        optional, topic-named deep dives
  scripts/           optional, runnable helpers
  templates/         optional, files meant to be copied
```

A skill that reaches into a sibling skill's directory breaks when either one
moves.

## Common pitfalls

**Description that describes the skill instead of the trigger.**

Bad:

```yaml
description: "This skill provides comprehensive guidance and best practices for database migration workflows."
```

Good:

```yaml
description: "Use when a migration fails to deploy or a schema changes. Ordering, backfills, rollback rules."
```

**Narrating the incident instead of stating the rule.**

Bad:

> During the checkout outage we found that the retry wrapper was swallowing the
> 409 from the payments API, which took three hours to track down.

Good:

> Never swallow 4xx in a retry wrapper: retrying a 409 hides a conflict the
> caller must resolve, so re-raise every non-5xx status.

**Hedged rules that read as optional.**

Bad:

> The payload should generally be validated before dispatch, and it may be wise
> to consider adding a timeout.

Good:

> Validate the payload before dispatch.
> Wrap every external call in a timeout (default 10s).

**Advice with no threshold or named artifact.**

Bad:

> Handle errors appropriately and make sure the code is well tested.

Good:

> Assert on the error branch in tests, not just the success branch.

**Two rules crammed into one bullet.** The second one gets skipped.

Bad:

> - Run the linter and update the changelog before opening the PR.

Good:

> - Run `npm run lint` before opening the PR.
> - Update `CHANGELOG.md` in the same commit as the change.

**Appending a contradicting rule instead of replacing the wrong one.** An agent
reads both and follows the first.

Bad:

> - Use `pip install` for dependencies.
> - (later in the file) Note: we now use `uv` for all installs.

Good: delete the `pip install` line and write the `uv` rule in its place.

**Unlinked reference files.**

Bad: `references/notes-2.md` exists, nothing in the body mentions it.

Good: `references/rollback.md`, linked from the body as
`See references/rollback.md when a migration has already shipped.`

**Writing a skill for something that belongs in code.** A default value, a
validation rule, or a lint rule should be enforced by code. Code enforces; a
skill only advises, and advice loses.

## See also

Sibling skills in `skills/productivity/`, verified present on disk:

- [`technical-writing`](../technical-writing/SKILL.md): use when writing docs, a
  README, or a changelog for human readers rather than agents.
- [`readme-generator`](../readme-generator/SKILL.md): use when a repo has no
  README or needs a refresh.
- [`truth-first`](../truth-first/SKILL.md): use when making factual claims or
  citing sources, including claims inside a skill body.
- [`planning`](../planning/SKILL.md): use when turning a vague goal into
  dependency-ordered phases.
- [`spec-first-development`](../spec-first-development/SKILL.md): use when
  building a feature from scratch, interview first and code last.
- [`grill-me`](../grill-me/SKILL.md): use when stress-testing a plan or design,
  including a draft skill you suspect is too vague.

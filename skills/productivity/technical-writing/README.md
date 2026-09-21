# Technical Writing

A skill for writing docs, READMEs, and changelogs that a stranger who is stuck at 2am can act on in five minutes.

## What it does

This skill applies ten rules to any document you write or review. Each rule
targets a specific failure that makes docs unreadable to the person who actually
needs them.

| Rule | Prevents |
| --- | --- |
| Name the audience in the first two lines | Readers spending three screens finding out they are in the wrong doc |
| Lead with the action, not the background | The command being buried under history nobody reads |
| Write for the person arriving mid-problem | "As usual" and unexpanded acronyms blocking a newcomer |
| Every code sample runs as written | `Client(...)` shipping your unfinished work to the reader |
| Say what it is NOT for | Misuse from readers assuming the tool covers an adjacent case |
| Document failure modes | Docs that only help when nothing is wrong |
| Use a table for more than three options | Parallel structure hidden inside prose |
| Make version instructions degrade gracefully | Pinned versions rotting invisibly |
| A README owns the first five minutes | A README that grew into an unreadable manual |
| Changelogs describe user-visible impact | Entries about internal refactors the reader cannot act on |

The skill is prescriptive. It gives a bad/good pair for every rule so you can
pattern-match against your own draft rather than reason from principles.

## When to use this

Use it when you are:

- Writing or rewriting a README for a repo, service, or library.
- Writing a runbook, onboarding guide, or integration doc.
- Writing a changelog or release notes entry.
- Reviewing someone else's doc and needing concrete, non-subjective feedback.
- Writing an error message or a `--help` string (the same rules apply: symptom,
  cause, fix).

Do not use it for: API reference generated from source annotations (the
structure is fixed by the generator), marketing copy (different goal), or
design documents whose entire purpose is rationale and history. Those legitimately
lead with background.

## Quick start

You have been asked to document a new `ingest` CLI. Here is the draft someone
wrote, then the same content after applying the skill.

### Before

```markdown
# Ingest

Ingest is a tool for moving event data into the warehouse. It was built in 2023
to replace the older batch loader, which had problems with backpressure and
required a nightly cron. The current design uses a streaming model.

## Usage

Install the package and configure your credentials, then run the ingest
command as usual. See the docs directory for configuration details.
```

Three failures: no audience, background before action, and no runnable command.

### After

```markdown
# Ingest

Streams event data into the warehouse. For service owners adding a new event
source. Not for backfilling historical data (use `warehouse-backfill`) or for
sources over 10k events/sec (rejected at the gateway).

## Install

    pip install acme-ingest

## Run

    ingest register \
      --source checkout-events \
      --region us-east-1 \
      --schema ./schemas/checkout.json

## Verify

    ingest status --source checkout-events

Expect a JSON object with `state` set to `streaming` and a non-zero
`events_last_minute`. If `state` is `pending` for more than 60 seconds, the
schema failed validation: check `ingest logs --source checkout-events`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 invalid_token` on register | Credentials expired | `auth login --profile prod` |
| `state: pending` forever | Schema rejected | `ingest validate ./schemas/checkout.json` |
| Empty dashboard, no errors | Registered in the wrong region | Re-register with `--region us-east-1` |

## Next

- [Schema reference](./docs/schemas.md)
- [Why we replaced the batch loader](./docs/design-notes.md)
```

The history did not disappear. It moved to a linked design note, where the
reader who wants it can find it and the reader who does not is unblocked.

## Key concepts

**Task-first ordering.** The first screen contains a command or a decision.
Everything that explains, justifies, or contextualizes moves below it or into a
linked document. A reader scanning for something to do will not find it under
three paragraphs of prose.

**Scope boundaries beat feature lists.** "Not for durable storage (evicts under
memory pressure)" prevents more misuse than any number of bullet points about
what the tool does. The boundary belongs next to the summary, not in an FAQ.

**Failure-mode coverage.** The happy path is self-documenting: it works and the
tool says so. Docs earn their keep when something breaks. Every failure entry
needs three parts: the symptom in the exact words the system emits (so search
finds it), the cause, and the fix as a runnable command.

**Runnable snippets.** A snippet with `...` or `<YOUR_KEY>` transfers unfinished
work onto someone with less context than you. Include imports and setup. Use
well-formed fake values like `sk-test-123` so a copy-paste fails loudly at auth
rather than at a parse error.

**Graceful version degradation.** Point at the source of truth ("the version in
`.python-version`") instead of copying it. Describe the shape of expected output
instead of pasting bytes. Date-stamp the volatile section, not the whole
document, so one stale table does not discredit the rest.

**The five-minute README contract.** What it is and who it is for, install, run,
verify, next. Never skip verify: without it, a reader who half-installed the
tool proceeds for another hour before finding out.

## Common pitfalls

### Eliding the part you found obvious

Bad:

```python
client = Client(...)
client.send(payload)
```

Good:

```python
from acme import Client

client = Client(api_key="sk-test-123", timeout=5)
client.send({"event": "signup", "user_id": "u_42"})
```

### Pasting exact output that will rot

Bad:

> Run `terraform 1.5.7 apply`. You will see `Apply complete! Resources: 14
> added, 0 changed, 0 destroyed.`

Good:

> Run `terraform apply` (version pinned in `.terraform-version`). Success looks
> like an `Apply complete!` line with a non-zero added count.

### Hiding parallel options inside prose

Bad:

> The `--mode` flag accepts `fast`, which skips validation and is suited to
> local work; `safe`, which validates everything and is the default; `strict`,
> which additionally fails on warnings; and `audit`, which only reports.

Good:

| `--mode` | Validates | Fails on warnings | Writes changes |
| --- | --- | --- | --- |
| `fast` | no | no | yes |
| `safe` (default) | yes | no | yes |
| `strict` | yes | yes | yes |
| `audit` | yes | no | no |

### Writing a changelog about your code instead of their work

Bad:

> - Refactored the token manager to use the new retry helper
> - Bumped internal protobuf to v4

Good:

> - Expired tokens now refresh automatically; remove any manual `auth login`
>   loops from your scripts.
> - `--region` is now required for new sources. Existing sources keep their
>   region until re-registered.

### Deferring instead of verifying

Bad:

> ## Usage
> See the docs directory for details on configuration, deployment and tuning.

Good:

> ## Verify
>
> ```bash
> curl -s localhost:8080/healthz
> ```
>
> Expect `{"status":"ok"}`. If you get a connection refused, the server did not
> bind: check `PORT` in `.env`.

### Assuming tribal knowledge

Bad:

> Deploy as usual after the migration lands.

Good:

> Deploy after the migration is applied in staging:
>
> ```bash
> ./scripts/deploy.sh --env staging --wait
> ```
>
> Prerequisites: VPN connected, `kubectl` context set to `staging-1`.

## See also

Sibling skills in `skills/productivity/`:

- [readme-generator](../readme-generator/SKILL.md) for scaffolding a README from
  an existing repo before applying these rules to it.
- [git-commit-writer](../git-commit-writer/SKILL.md) for commit messages, which
  follow the same impact-first rule as changelog entries.
- [skill-authoring](../skill-authoring/SKILL.md) for writing SKILL.md files,
  where the audience is a model rather than a person.
- [spec-first-development](../spec-first-development/SKILL.md) for writing the
  spec that a doc later describes.
- [truth-first](../truth-first/SKILL.md) for not overstating what a tool does,
  which is the failure mode behind most missing "not for" sections.

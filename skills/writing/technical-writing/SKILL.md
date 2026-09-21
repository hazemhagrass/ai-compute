---
name: technical-writing
description: "Use when writing docs, a README, or a changelog. Write task-first, failure-aware docs that a stranger can act on in five minutes."
---

# Technical Writing

Docs are read by someone who is stuck, in a hurry, and skimming. Optimize for
action, not for completeness.

## Name the audience in the first two lines

State who the document is for and what they will be able to do, so a reader who
is in the wrong place can leave immediately instead of reading three screens to
find out.

Bad:

> This document provides an overview of the ingestion subsystem, its history,
> and the design considerations that shaped its current architecture.

Good:

> For service owners who need to add a new event source to ingestion.
> You will end with a source that appears in the dashboard within 10 minutes.
> Not for people debugging an existing source (see Troubleshooting Ingestion).

## Lead with the action, not the background

Put the command, the code, or the decision in the first screen. Readers scan for
something to do; background they can reach for later gets read, background that
blocks the action gets skipped along with everything after it.

Bad:

> Authentication in this system is based on short-lived tokens. Historically we
> used session cookies, but rotation was difficult (...three paragraphs...).
> To get a token, run `auth login`.

Good:

> Get a token: `auth login --profile prod`. Tokens last 15 minutes and refresh
> automatically. Background on why cookies were dropped: see Design Notes.

## Write for the person arriving mid-problem at 2am

Assume no prior context, no tribal knowledge, and low patience. The person who
already understands the system does not need the document; the one who does not
is the entire audience.

- Expand every acronym on first use, in every document (people arrive by search,
  not by reading in order).
- Give absolute commands, not "as usual" or "the standard way".
- State prerequisites up front as a checklist, not scattered through the prose.

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

## Every code sample runs as written

Never elide with `...` or "your config here" in a sample the reader is expected
to run. An unrunnable sample transfers your unfinished work onto a reader who
has less context than you do.

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

Rules:

- Include imports, setup, and teardown in the snippet.
- Use fake but well-formed placeholder values (`sk-test-123`), not `<YOUR_KEY>`
  inside otherwise valid syntax, so a copy-paste fails loudly at auth rather
  than at a parse error.
- Keep long samples whole in one block; splitting one across prose guarantees
  someone pastes half.

## Say what it is NOT for

A scope boundary prevents more misuse than any feature list prevents, because
misuse comes from readers assuming a tool covers their adjacent case. Put the
"not for" block next to the summary, not in an FAQ at the bottom.

Bad: "A fast key-value cache with TTL support, batching, and metrics."

Good: "A fast key-value cache with TTL support, batching, and metrics. Not for:
durable storage (evicts under memory pressure), cross-region reads (single
region only), or values over 1 MB (rejected)."

## Document failure modes, not just the happy path

The happy path is the part nobody needs docs for: it works, and the tool tells
them so. Docs earn their keep at the moment something breaks. For each failure
give the symptom the reader actually sees, the cause, and the fix, in the exact
words the system emits so search finds it.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 invalid_token` right after login | Clock skew over 60s | `sudo ntpdate -s time.nist.gov`, then retry |
| Deploy hangs at "waiting for rollout" | Old pods hold a PVC | `kubectl delete pod -l app=api --field-selector status.phase=Failed` |
| Empty dashboard, no errors | Source registered in the wrong region | Re-register with `--region us-east-1` |

## Use a table for more than three parallel options

Prose hides parallel structure and forces the reader to hold four things in
memory at once. A table makes the comparison scannable and makes a missing cell
visible to you while writing.

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

## Make version-specific instructions degrade gracefully

Pinned versions and exact output rot silently, and a reader cannot tell a stale
doc from a broken system. Write so that drift is visible and non-fatal.

- Point at the source of truth instead of copying it: "the version in
  `.python-version`" beats "Python 3.11.4".
- Describe the shape of expected output, not the exact bytes: "a JSON object
  with a `status` field set to `ready`" beats a pasted 40-line blob.
- Where an exact version matters, say why and give the check:
  `node --version  # must be >= 20, Corepack is required`.
- Date-stamp the volatile section, not the whole document, so one stale table
  does not discredit the rest.

Bad: "Run `terraform 1.5.7 apply`. You will see `Apply complete! Resources: 14
added, 0 changed, 0 destroyed.`"

Good: "Run `terraform apply` (version pinned in `.terraform-version`). Success
looks like an `Apply complete!` line with a non-zero added count."

## A README owns the first five minutes

A README is not a manual. Its job is to get a stranger from clone to a verified
working state, then hand off. Five sections, in this order:

1. What it is and who it is for (two lines), plus what it is not for.
2. Install: exact commands, one block.
3. Run: the smallest command that does something real.
4. Verify: what the reader should observe to know it worked.
5. Where to go next: links to the deeper docs.

Never skip verify. Without it, a reader who half-installed the tool proceeds for
another hour before discovering it. Push architecture, rationale, and tuning out
of the README and link them.

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

## Changelogs describe user-visible impact

A reader scans a changelog to answer one question: does this change what I do?
Internal refactors answer no, so they belong in commit history, not here.

Bad:

> - Refactored the token manager to use the new retry helper
> - Bumped internal protobuf to v4

Good:

> - Expired tokens now refresh automatically; remove any manual `auth login`
>   loops from your scripts.
> - `--region` is now required for new sources. Existing sources keep their
>   region until re-registered.

- Lead each entry with the effect, then the action the reader must take.
- Call out breaking changes with the migration command inline, not in a linked
  issue.
- Group by Added / Changed / Fixed / Removed so a reader can skip whole blocks.
- Write entries in the reader's vocabulary (the flag, the endpoint, the button),
  not the internal module name.

## Quick checklist

- Audience and non-audience stated in the first two lines.
- First screen contains a command or a decision, not history.
- Every snippet complete and runnable, no `...`, no exact-output paste.
- A "not for" scope boundary sits next to the summary.
- Failure modes documented with exact symptom text and fix.
- More than three parallel options rendered as a table.
- README ends with verify plus next steps; changelog states impact and action.

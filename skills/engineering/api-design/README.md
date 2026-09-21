# API Design

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

A rule set for HTTP APIs that survive growth: validate at the boundary, return status codes and error bodies clients can branch on, keep PATCH from destroying data, and ship changes additively.

## What it does

`SKILL.md` encodes eight areas of HTTP API design as enforceable rules, each paired with the failure it prevents:

| Area | Rule in one line |
| --- | --- |
| Boundary validation | Parse body, query, and params with a runtime schema; never use `as` casts. |
| Status codes | 400 vs 422, 401 vs 403, 404 vs 403, 409 vs 412, 502/504 for upstreams. |
| Error bodies | One shape everywhere: stable `code`, human `message`, field paths, `requestId`. |
| PATCH tri-state | absent = keep, `null` = clear, value = replace. Use `.nullable().optional()`. |
| Pagination | Cursor-based, clamped limit, stable tiebreaker sort, filtered `total`. |
| Idempotency | `Idempotency-Key` required and replayed on side-effecting POSTs. |
| Secrets | Write-once, masked on read, never echoed in errors. |
| Versioning | Additive by default; renames become two additive steps. |

It ends with a pre-merge checklist covering all eight.

## When to use this

Load the skill when you are about to:

- Add a new HTTP route or change an existing one.
- Write or review a request/response schema.
- Implement a `PATCH` endpoint (the tri-state section is the highest-value part).
- Return a list from an endpoint that can grow past a few dozen rows.
- Add an endpoint that charges a card, issues a refund, sends an email/SMS, or fires an outbound webhook.
- Create, rotate, or display an API key, token, or signing secret.
- Decide whether a change needs a version bump or can ship additively.
- Review a PR that touches any of the above.

Signals you already needed it: a 500 with a Postgres type error on bad input, a client polling in an infinite token-refresh loop, a support ticket saying "my bio disappeared when I changed my avatar", a double charge after a timeout, a secret in your log aggregator.

## Quick start

Say you are adding `POST /v1/invoices` and `GET /v1/invoices`. Work the checklist in order.

**1. Schema at the edge, no casts.**

```ts
import { z } from "zod";

const CreateInvoice = z.object({
  amountCents: z.number().int().positive(),
  customerId: z.string().uuid(),
  memo: z.string().max(500).optional(),
}).strict();

app.post("/v1/invoices", async (request) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return problem(400, "malformed_json", "Request body is not valid JSON.");
  }
  const parsed = CreateInvoice.safeParse(raw);
  if (!parsed.success) return validationProblem(parsed.error); // 422
  return createInvoice(parsed.data);
});
```

400 for unparseable JSON, 422 for a negative `amountCents`. Those are different bugs with different owners.

**2. One error shape, with field paths.**

```ts
type ApiError = {
  code: string;    // stable, snake_case, documented
  message: string; // human text, may change freely
  fields?: { path: string; code: string; message: string }[];
  requestId: string;
};
```

```bash
curl -s -X POST https://api.example.com/v1/invoices \
  -H 'content-type: application/json' \
  -d '{"amountCents":-5,"customerId":"nope"}' | jq
```

```json
{
  "code": "validation_failed",
  "message": "One or more fields are invalid.",
  "fields": [
    { "path": "amountCents", "code": "too_small", "message": "Number must be greater than 0" },
    { "path": "customerId", "code": "invalid_string", "message": "Invalid uuid" }
  ],
  "requestId": "req_01H..."
}
```

The client highlights two inputs. With `{"error":"expected string, received undefined"}` it can only show a toast.

**3. Paginate the collection on day one.**

```ts
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  status: z.enum(["open", "paid"]).optional(),
});
// ORDER BY created_at DESC, id DESC  <- stable tiebreaker
// response: { "data": [...], "nextCursor": "eyJpZCI6...", "hasMore": true }
```

`limit=10000` clamps to 100 rather than 422-ing in production.

**4. Idempotency, because this one spends money.**

```ts
const key = request.headers.get("Idempotency-Key");
if (!key) return problem(400, "idempotency_key_required", "Idempotency-Key header is required.");

const prior = await idempotency.get({ callerId, key });
if (prior) {
  if (prior.bodyHash !== hash(rawBody)) {
    return problem(422, "idempotency_key_reuse", "Key was used with a different request body.");
  }
  return json(prior.status, prior.body); // replay, do not re-charge
}
```

Verify the replay path rather than assuming it:

```bash
KEY=$(uuidgen)
for i in 1 2; do
  curl -s -X POST https://api.example.com/v1/invoices \
    -H "Idempotency-Key: $KEY" -H 'content-type: application/json' \
    -d '{"amountCents":1200,"customerId":"6f1c...","memo":"retry test"}' \
    | jq '{id, amountCents}'
done
# Both iterations must print the SAME id. Two ids means you double-charged.
```

**5. Classify the change before merge.** New optional `memo` field: additive, ship it. Renaming `memo` to `note`: write both, read either, send a `Deprecation` header, remove only when telemetry shows zero reads.

## Key concepts

**Boundary trust.** One parse at the handler edge buys the entire call stack the right to assume the shape is real. A cast buys nothing and moves the failure to the data layer, where it is a 500.

**Branchable errors.** `code` is an API contract and must not change. `message` is prose and may change freely. Clients branch on `code`, humans read `message`, support searches `requestId`.

**Tri-state PATCH.** Absent, `null`, and a value are three distinct intents. `.optional()` alone collapses absent and `null` into `undefined`, so an unrelated update wipes a field and returns 200. Use `.nullable().optional()`, branch with `in`, build the update object key by key, and add `.strict()` so `nickName` fails instead of silently no-opping.

**Cursor over offset.** Offset pagination skips and duplicates rows when an insert lands between page fetches. A cursor plus an immutable unique tiebreaker does not.

**Idempotency is replay, not rejection.** Returning 409 on a retry leaves the client not knowing whether the first call worked. Store the response, scoped to the caller, keyed by the key, hashed against the body, and replay it.

**Write-once secrets.** Full value at creation, masked preview plus fingerprint thereafter. Strip in the shared serializer, not per handler.

**Additive by default.** A major version is a migration cost for every client plus a second code path you maintain forever. Spend it only when additive is impossible.

## Common pitfalls

**Casting instead of parsing**

```ts
// BAD: the compiler believes a lie; malformed input 500s in Postgres
const body = (await request.json()) as CreateInvoiceBody;
```
```ts
// GOOD
const parsed = CreateInvoice.safeParse(await request.json());
if (!parsed.success) return validationProblem(parsed.error);
```

**401 for a permission failure**

```ts
// BAD: client refreshes its token, retries, gets 401, refreshes forever
if (!canRead(user, invoice)) return problem(401, "unauthorized", "Not allowed.");
```
```ts
// GOOD: 403 means "we know who you are and you still may not"
if (!canRead(user, invoice)) return problem(403, "forbidden", "Not allowed.");
// and 404 when the resource is outside the caller's tenant, so IDs stay non-enumerable
```

**Folding an upstream timeout into 500**

```ts
// BAD: destroys the signal that distinguishes their bug from ours
catch (err) { return problem(500, "internal_error", "Something went wrong."); }
```
```ts
// GOOD
catch (err) {
  if (err instanceof UpstreamTimeout) return problem(504, "payment_provider_timeout", "Payment provider did not respond.");
  if (err instanceof UpstreamRejected) return problem(502, "payment_provider_error", "Payment provider rejected the request.");
  throw err; // genuinely ours: 500
}
```

**Spreading a parsed PATCH body**

```ts
// BAD: undefined keys reappear and some ORMs write them as NULL
await db.user.update({ where: { id }, data: { ...parsed } });
```
```ts
// GOOD: presence checks, key by key
const patch: Record<string, unknown> = {};
if ("nickname" in parsed) patch.nickname = parsed.nickname; // null clears, string replaces
await db.user.update({ where: { id }, data: patch });
```

**Truthiness guards on patch values**

```ts
// BAD: an intentional empty string is silently dropped
if (data.nickname) patch.nickname = data.nickname;
```
```ts
// GOOD
if ("nickname" in data) patch.nickname = data.nickname;
```

**Unfiltered total**

```ts
// BAD: count ignores the filter, client renders empty trailing pages
const total = await db.invoice.count();
```
```ts
// GOOD: same filters, or omit total and return hasMore
const total = await db.invoice.count({ where });
```

**Echoing a rejected secret**

```ts
// BAD: writes the real credential into your logs and the client's
return problem(401, "invalid_key", `Invalid key ${suppliedKey}`);
```
```ts
// GOOD
log.warn({ keyFingerprint: fingerprint(suppliedKey) }, "auth rejected");
return problem(401, "invalid_key", "Invalid API key.");
```

**Tightening validation in place**

```ts
// BAD: memo max 500 -> max 100 is breaking; existing callers start 422-ing
memo: z.string().max(100)
```
```ts
// GOOD: keep the old bound, warn, and tighten only behind a new version or opt-in flag
memo: z.string().max(500)
```

## See also

- `SKILL.md` in this directory: the full rule set plus the pre-merge checklist.
- RFC 9457 (Problem Details for HTTP APIs) for an off-the-shelf error shape if you do not want to define your own.
- RFC 9110 for the authoritative semantics of the status codes referenced above.
- Stripe's idempotency and versioning docs as a worked example of key replay and dated version headers.

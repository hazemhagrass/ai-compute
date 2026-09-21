---
name: api-design
description: "Use when designing or changing an HTTP API. Enforce boundary validation, informative status codes, branchable errors, tri-state patch fields, pagination, idempotency, secret masking, and additive versioning."
---

# API Design

Rules for HTTP APIs that stay usable as they grow. Each rule says what to do and why the alternative breaks.

## Validate at the boundary, then trust inwards

- Parse every body, query string, and path param with a runtime schema at the handler edge, so everything past that line may assume the shape is real.
- Never substitute a TypeScript cast for validation: `as Body` is a lie the compiler believes, and the malformed payload then fails deep in the data layer as a 500 with a stack trace instead of a 400 naming the bad field.

```ts
// BAD: the cast validates nothing
app.post("/invoices", async (request) => {
  const body = (await request.json()) as { amountCents: number; customerId: string };
  // amountCents may be "12.00", null, or absent.
  // Failure surfaces as a Postgres type error: 500, no useful message.
  return createInvoice(body);
});
```

```ts
// GOOD: parse once, fail loudly, trust downstream
import { z } from "zod";

const CreateInvoice = z.object({
  amountCents: z.number().int().positive(),
  customerId: z.string().uuid(),
  memo: z.string().max(500).optional(),
});

app.post("/invoices", async (request) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return problem(400, "malformed_json", "Request body is not valid JSON.");
  }
  const parsed = CreateInvoice.safeParse(raw);
  if (!parsed.success) return validationProblem(parsed.error);
  return createInvoice(parsed.data); // typed, and actually true
});
```

- Schema-check responses in tests rather than in the production hot path, to catch the day someone returns a raw ORM row and leaks a column.

## Status codes that carry information

- Use `400` when the request itself is broken (unparseable JSON, missing required header, non-numeric numeric param), because the client cannot retry it unchanged.
- Use `422` when the request is well formed but semantically invalid (negative `amountCents`, `endsAt` before `startsAt`): splitting 400 and 422 lets a client tell "my serializer is broken" from "my user typed something wrong", which are different bugs with different owners.
- Use `401` only for "we do not know who you are" and `403` for "we know and you still may not", because clients react to 401 by refreshing tokens, so a 401 on a permission failure becomes an infinite refresh loop.
- Decide `404` versus `403` as an information-leak choice: 403 on an invisible resource confirms it exists, so return 404 for anything outside the caller's tenant (IDs stay non-enumerable) and reserve 403 for resources whose existence is already public.
- Use `409` for a state conflict (already refunded, duplicate unique key) and `412` for a failed `If-Match`, both of which tell the client to re-read rather than retry blindly.
- Always send `Retry-After` with `429`, otherwise every client invents its own backoff and the worst one becomes your load profile.
- Return `502` / `503` / `504` when an UPSTREAM failed rather than you, because retry policy and alerting for "our bug" and "their bug" differ, and folding a provider timeout into a generic 500 destroys both signals.

```ts
try {
  return await payments.charge(input);
} catch (err) {
  if (err instanceof UpstreamTimeout) {
    return problem(504, "payment_provider_timeout", "Payment provider did not respond.");
  }
  if (err instanceof UpstreamRejected) {
    return problem(502, "payment_provider_error", "Payment provider rejected the request.");
  }
  throw err; // genuinely ours: 500
}
```

## Error bodies a client can branch on

- Return a stable machine-readable `code`, because a client branching on prose breaks silently the moment someone improves the wording.
- Attach field-level detail with a JSON path per problem: "expected string, received undefined" never says WHICH field, so the client shows a toast instead of highlighting the input.
- Keep one error shape across the whole API, including framework defaults, so clients need exactly one parser.

```ts
type ApiError = {
  code: string;    // stable, snake_case, documented
  message: string; // human text, may change freely
  fields?: { path: string; code: string; message: string }[];
  requestId: string; // echoed from the log line, for support
};

function validationProblem(err: z.ZodError) {
  return json(422, {
    code: "validation_failed",
    message: "One or more fields are invalid.",
    fields: err.issues.map((i) => ({
      path: i.path.join("."), // "items.0.amountCents", not "undefined"
      code: i.code,           // "invalid_type", "too_small"
      message: i.message,
    })),
    requestId: currentRequestId(),
  });
}
```

```jsonc
// BAD
{ "error": "Invalid request: expected string, received undefined" }
// GOOD
{
  "code": "validation_failed",
  "message": "One or more fields are invalid.",
  "fields": [{ "path": "customer.email", "code": "invalid_type", "message": "Required" }],
  "requestId": "req_01H..."
}
```

## Tri-state fields in PATCH (this silently destroys data)

- Keep the three PATCH intents distinguishable per field: absent means keep the stored value, `null` (or empty string, pick one and document it) means clear it, and a value means replace it.
- Treat collapsing absent and cleared as data loss: most schema libraries collapse them by default, so an unrelated update silently wipes a field nobody touched and still returns 200.
- Avoid bare `.optional()`, because after parsing you cannot tell "omitted" from "sent null" (both land as `undefined` in a spread). Use `.nullable().optional()` and branch with `in`, never on truthiness.

```ts
// BAD: absent and cleared are indistinguishable, and falsy values vanish
const PatchUser = z.object({ nickname: z.string().optional() });
const data = PatchUser.parse(body);
await db.user.update({ where: { id }, data: { nickname: data.nickname } });
// Omitted -> undefined -> depending on the ORM, ignored or written as NULL.
// Empty string -> falsy -> dropped by any `if (data.nickname)` guard.
```

```ts
// GOOD: three states stay three states
const PatchUser = z
  .object({ nickname: z.string().max(50).nullable().optional() }) // value | null | absent
  .strict();

const parsed = PatchUser.parse(body);
const patch: Record<string, unknown> = {};

if ("nickname" in parsed) {
  patch.nickname = parsed.nickname; // null means clear, string means replace
}
// key absent: never written, stored value preserved

await db.user.update({ where: { id }, data: patch });
```

- Build the update object key by key from presence checks instead of spreading the parsed object, because a spread reintroduces `undefined` keys that some ORMs write as NULL.
- Reject unknown keys on PATCH with `.strict()`, so a typo like `nickName` fails loudly instead of being a no-op the client believes succeeded.
- If storage forbids NULL, use empty string as the clear signal and document it, but still keep absent distinct from it.

## Pagination from day one

- Paginate every collection endpoint at creation, because retrofitting it is a breaking change: clients that assumed a full array start silently truncating at your new default limit.
- Prefer cursor pagination for anything that grows, since offset pagination skips and duplicates rows whenever an insert lands between two page fetches.
- Clamp page size server-side rather than erroring, so a client asking for 10000 gets 100 instead of a fresh 422 in production.
- Compute any `total` with the SAME filters as the page, because an unfiltered count makes the client render empty trailing pages that look exactly like data loss. If the filtered count is expensive, omit `total` and return `hasMore`.
- Sort on a stable tiebreaker (an immutable unique column such as `id`), because sorting only by `createdAt` reorders ties between pages and drops rows.

```ts
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  status: z.enum(["open", "paid"]).optional(),
});

// response: { "data": [...], "nextCursor": "eyJpZCI6...", "hasMore": true }
```

## Idempotency keys for anything that spends money or sends a message

- Require an `Idempotency-Key` header on every POST with an externally visible side effect (charge, refund, email, SMS, outbound webhook), because networks time out after the server committed and the client's honest retry becomes a double charge.
- Store the key with the RESPONSE you returned, scoped to the caller, and replay it on a repeat: answering 409 on retry is not idempotency, since the client still does not know whether the first call worked.
- Store a hash of the request body alongside the key, so the same key with a different body gets a distinct 422 instead of silently receiving the old response.

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

## Never return a secret you accepted

- Treat API keys, tokens, signing secrets, and card numbers as write-only: show the full value once at creation, then only a masked preview plus a fingerprint or last four, because a readable-forever secret turns any read-scoped leak (log, cache, support tool) into a full compromise.
- Never echo a rejected secret in an error message, because that writes the real credential into your logs and the client's. Say "Invalid API key." and log only a fingerprint.
- Strip secret fields in the shared response serializer rather than per handler, since a per-handler `delete body.apiKey` is one forgotten endpoint away from a leak.

```ts
// BAD
return json(201, created); // serializes created.apiKey on every read
return problem(401, "invalid_key", `Invalid key ${suppliedKey}`); // credential in logs

// GOOD
return json(201, { ...publicFields(created), apiKey: created.apiKey }); // once, at creation
return json(200, { ...publicFields(found), apiKeyPreview: mask(found.apiKey) });
return problem(401, "invalid_key", "Invalid API key.");
```

## Versioning and additive change

- Pick one versioning scheme for the whole API (path `/v1/...` or a dated header), because mixed schemes mean nobody can tell which version a given request got.
- Default to additive change and spend a new major version only when additive is impossible, since a version bump is a migration cost for every client plus a second code path you maintain indefinitely.
- Treat as additive and safe: a new optional request field whose default preserves current behavior, a new response field, a new endpoint, a new enum value on a field clients only read (documented as "tolerate unknown values").
- Treat as breaking and version-worthy: removing or renaming a field, tightening validation, changing a type (string to number, scalar to array), changing a status code, adding a required request field, adding an enum value clients switch on exhaustively, changing default sort or page size.
- Turn a rename into two additive steps: write both fields, read either, mark the old one with a `Deprecation` header and sunset date, and remove it only once telemetry shows zero reads.
- Gate genuinely new behavior behind an explicit opt-in flag or dated version header, so existing callers keep their semantics without doing anything.

```ts
// Rename `name` to `displayName` without a new version
const Body = z
  .object({ displayName: z.string().optional(), name: z.string().optional() })
  .refine((b) => b.displayName ?? b.name, { message: "displayName is required" });

const displayName = parsed.displayName ?? parsed.name!;
// response emits BOTH fields until the old one is retired
```

## Checklist before shipping an endpoint

- Body, query, and params parsed by a schema, zero `as` casts.
- 400 vs 422 distinguished, upstream failures surfaced as 502/504.
- One error shape with a stable `code` and field paths.
- PATCH fields `.nullable().optional()`, update built by presence checks, `.strict()` on.
- Collection paginates, clamps limit, sorts stably, and any `total` matches the filters.
- Side-effecting POST requires and replays an idempotency key.
- Secrets write-once, masked on read, absent from error text.
- Change classified additive or breaking before merge.

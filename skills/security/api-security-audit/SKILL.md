---
name: api-security-audit
description: "Use when auditing a deployed HTTP API for security bugs. Probe live routes for BOLA, function-level authz gaps, mass assignment, over-exposure, CORS, webhook signatures, and stale versions."
---

# API Security Audit

This skill audits a **running** HTTP API by sending requests to it. Use
`security/security-audit` for source-level injection, secrets, SSRF, and
deserialization; use `engineering/api-design` for designing an endpoint that does
not exist yet; use this when the API is deployed, you hold at least two accounts,
and the question is what a caller can reach from outside.

The unit of work is a request, not a file. Every finding is a transcript: the
request you sent, the status you got, the bytes that came back.

## Build the route inventory before probing anything

- Enumerate routes from the framework router, the OpenAPI document, and the gateway
  config separately, then diff the three lists, because a route present in the router
  but missing from the spec is the route nobody reviewed.
- Hold two accounts in different tenants plus one unauthenticated client throughout,
  because every check below is "does caller A see caller B's data".

```bash
# routes the server actually serves, versus routes the spec advertises
curl -s https://api.example.com/openapi.json | jq -r '.paths | keys[]' | sort > spec.txt
rg -o --no-filename '"/api/v[0-9]+/[a-zA-Z0-9/_{}.-]+"' dist/ | tr -d '"' | sort -u > live.txt
comm -13 spec.txt live.txt   # served but undocumented: probe these first
```

## BOLA: object-level authorization, per request

This is the single most common defect in deployed APIs, and it survives review
because the endpoint looks finished: it authenticates, returns 200, and renders.
Nothing in the response says the row belonged to someone else.

- Replay every ID-bearing request with account B's token and account A's object ID,
  and treat any 200 as a confirmed finding, because that is the whole exploit.
- Scope the row in the same query that loads it rather than checking ownership after
  the fetch, since a later refactor deletes the second step and keeps the first.
- Take the tenant from the session only, never from a body field, query param, or
  `X-Org-Id` header, because a client-settable scope is an attacker-settable scope.
- Try the object ID in every position it appears: path, body, query, and batch arrays,
  since a handler that scopes the path param often trusts the same ID inside a bulk payload.
- Return 404 rather than 403 for objects outside the caller's scope, because 403 confirms
  the row exists and turns an authz bug into an enumeration oracle.

```ts
// BAD: authenticated, not authorized. Any token reads any order.
app.get("/v1/orders/:id", requireAuth, async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);
});

// GOOD: scope from the session, inside the same query, 404 on miss.
app.get("/v1/orders/:id", requireAuth, async (req, res) => {
  const order = await db.order.findFirst({
    where: { id: req.params.id, orgId: req.session.orgId },
  });
  if (!order) return res.status(404).end();
  res.json(toOrderView(order));
});
```

```bash
# A's object, B's token. A 200 here is the finding.
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN_B" \
  https://api.example.com/v1/orders/$ORDER_OWNED_BY_A
```

## Function-level authorization: admin routes guarded by the UI

- Call every privileged route with a plain user token, because the admin console
  hiding a button is a rendering decision and the route does not know about it.
- Re-derive roles from the database on each request instead of trusting a JWT claim
  the service never revalidates, because a demoted or revoked user keeps their old
  token until it expires.
- Apply the role gate in the route definition, not in a shared prefix middleware that
  a later route can register above, since ordering bugs silently unguard endpoints.

```ts
// BAD: role read straight off an unverified claim, gate only on read.
router.get("/v1/admin/users", requireAuth, (req, res) => {
  if (!req.jwt.isAdmin) return res.status(403).end();
  return res.json(listUsers());
});
router.delete("/v1/admin/users/:id", requireAuth, deleteUser); // no gate at all

// GOOD: one permission gate, re-checked against storage, on every verb.
const requirePerm = (p: Permission) => async (req, res, next) => {
  const perms = await permissions.forUser(req.session.userId); // not from the token
  return perms.has(p) ? next() : res.status(403).end();
};

router.get("/v1/admin/users", requireAuth, requirePerm("users.read"), listUsers);
router.delete("/v1/admin/users/:id", requireAuth, requirePerm("users.delete"), deleteUser);
```

## Mass assignment and overposting

- Bind request bodies to an explicit allowlist schema and reject unknown keys, because
  spreading a parsed body into an ORM update hands the caller your whole column set.
- Keep a separate input type per operation rather than reusing the entity type, since
  the entity type grows privileged fields (`role`, `orgId`, `balanceCents`, `verified`)
  that were never meant to be writable.
- Re-read the object after a write in testing and compare privileged fields, because a
  silently accepted extra key looks identical to a clean 200 in the response.

```ts
// BAD: every column the client names gets written.
app.patch("/v1/me", requireAuth, async (req, res) => {
  const user = await db.user.update({ where: { id: req.session.userId }, data: req.body });
  res.json(user); // {"role":"admin","orgId":"other-tenant"} just worked
});

// GOOD: strict allowlist, privileged columns unreachable by construction.
const PatchMe = z.object({
  displayName: z.string().max(80).optional(),
  locale: z.string().max(10).optional(),
}).strict();

app.patch("/v1/me", requireAuth, async (req, res) => {
  const parsed = PatchMe.safeParse(req.body);
  if (!parsed.success) return res.status(422).json(validationProblem(parsed.error));
  const user = await db.user.update({ where: { id: req.session.userId }, data: parsed.data });
  res.json(toMeView(user));
});
```

## Excessive data exposure

- Serialize responses through an explicit view function instead of returning the ORM
  row, because the client hiding a field is not the field being absent from the wire.
- Check embedded relations and error payloads as carefully as the primary object,
  because `include: { user: true }` ships password hashes and recovery tokens.
- Diff the JSON the client renders against the JSON the server sends, since every field
  present but unrendered is data you leaked without knowing it.

```ts
// BAD: whole row plus a joined user, filtered in the frontend.
res.json(await db.ticket.findMany({ where: { orgId }, include: { author: true } }));

// GOOD: one view function, additive by choice, shared by list and detail.
const toTicketView = (t: TicketWithAuthor) => ({
  id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt,
  author: { id: t.author.id, displayName: t.author.displayName },
});
res.json((await db.ticket.findMany({ where: { orgId }, include: { author: true } })).map(toTicketView));
```

## Rate limits, pagination, and query cost

- Rate limit per authenticated principal and per IP together, because a per-IP limit
  alone is defeated by one token behind many addresses and vice versa.
- Clamp page size server-side rather than rejecting, and cap the maximum offset,
  because deep offsets make the database scan the whole table per request.
- Cap nesting depth and query complexity on any GraphQL or filter-expression surface,
  because a recursive query is a denial of service that costs the attacker one request.

```ts
// BAD: unbounded page size, unbounded offset, no limiter.
const rows = await db.event.findMany({
  where: { orgId }, take: Number(req.query.limit), skip: Number(req.query.offset),
});

// GOOD: clamped, cursor based, rate limited per principal.
const ListEvents = z.object({
  limit: z.coerce.number().int().min(1).max(100).catch(25),
  cursor: z.string().optional(),
});
app.get("/v1/events", requireAuth, limitPerPrincipal({ perMinute: 60 }), async (req, res) => {
  const q = ListEvents.parse(req.query);
  const rows = await db.event.findMany({
    where: { orgId: req.session.orgId },
    take: q.limit + 1,
    cursor: q.cursor ? { id: q.cursor } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  res.json(pageOf(rows, q.limit));
});
```

## CORS

- Never reflect the `Origin` header into `Access-Control-Allow-Origin` while sending
  `Access-Control-Allow-Credentials: true`, because that grants every site on the
  internet authenticated read access through the victim's browser.
- Match origins against an exact allowlist rather than a prefix or suffix test, since
  `startsWith("https://app.example.com")` also accepts `https://app.example.com.evil.tld`.

```ts
// BAD: reflection with credentials. Any origin, fully authenticated.
res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
res.setHeader("Access-Control-Allow-Credentials", "true");

// GOOD: exact allowlist, and Vary so caches do not cross-serve.
const ALLOWED = new Set(["https://app.example.com", "https://admin.example.com"]);
const origin = req.headers.origin;
if (origin && ALLOWED.has(origin)) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
}
res.setHeader("Vary", "Origin");
```

## Internal, debug, and health routes

- Request `/metrics`, `/health`, `/debug`, `/actuator`, `/graphql`, `/swagger`, and
  `/.well-known` unauthenticated from outside the network, because these are bound to
  the same listener as the public API far more often than the deployment diagram shows.
- Treat a health endpoint that echoes versions, hostnames, queue depths, or database
  names as a finding, since it is free reconnaissance and costs nothing to trim.

## Verbose errors

- Return a stable error `code` plus a request id and nothing else, because stack traces,
  SQL fragments, and file paths hand an attacker your framework, ORM, and schema.
- Return a stable machine-readable error code plus an opaque request ID, and keep the
  stack trace, SQL text, and upstream body in logs only, because clients debug with the
  ID while attackers fingerprint with the detail.

```ts
// BAD
res.status(500).json({ error: err.message, stack: err.stack });
// GOOD
logger.error({ err, requestId }, "unhandled");
res.status(500).json({ code: "internal_error", requestId });
```

## Method and content-type confusion

- Send `HEAD`, `OPTIONS`, and an unexpected `PUT` to routes you believe are `GET` only,
  because framework catch-alls and proxy rewrites can route them to a different handler
  with different middleware.
- Enforce the expected `Content-Type` and refuse others, because a JSON handler that
  also accepts `application/x-www-form-urlencoded` or `text/plain` becomes CSRF reachable
  from a plain HTML form with no preflight.

## Webhook signature verification

- Verify the signature over the exact raw body bytes before parsing, because verifying
  a re-serialized object compares a payload the sender never signed.
- Compare digests with a constant-time function, since a byte-by-byte compare leaks the
  expected value through timing.
- Never fall back to "no signature header means trust it", which is the most common
  implementation and makes the endpoint anonymous write access.

```ts
// BAD: parsed body re-stringified, non-constant-time compare, silent skip.
if (req.headers["x-signature"] && req.headers["x-signature"] === hmac(JSON.stringify(req.body))) {
  return handle(req.body);
}
return handle(req.body);

// GOOD: raw bytes, constant time, timestamped, replay checked.
app.post("/v1/webhooks/provider", express.raw({ type: "*/*" }), async (req, res) => {
  const sig = req.header("X-Signature");
  const ts = Number(req.header("X-Timestamp"));
  if (!sig || !ts || Math.abs(Date.now() / 1000 - ts) > 300) return res.status(400).end();
  const expected = createHmac("sha256", SECRET).update(`${ts}.`).update(req.body).digest();
  if (!timingSafeEqual(Buffer.from(sig, "hex"), expected)) return res.status(401).end();
  const event = JSON.parse(req.body.toString("utf8"));
  if (await seen(event.id)) return res.status(200).end();
  return handle(event, res);
});
```

## Versioning leaves old routes live

- Probe every prior version path for every current route, because `/v1` is usually still
  served long after the fixes landed only in `/v2`.
- Require old versions to carry the same authz middleware, rate limits, and response
  views as current ones, or return 410, because a deprecated route with weaker checks
  is a supported bypass.

```bash
for v in v1 v2 v3 internal; do
  printf '%s %s\n' "$v" "$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_B" https://api.example.com/$v/orders/$ORDER_OWNED_BY_A)"
done
```

## Reporting

Every finding is one request and one response. Write it so the reader can paste it.

```markdown
### [P0] Cross-tenant read on GET /v1/orders/{id}
**Request:** GET /v1/orders/ord_A1 with a bearer token for user in org B
**Response:** 200, full order body including billing contact and line items
**Reach:** any authenticated user, any tenant. IDs leak via export filenames.
**Fix:** scope the query with `orgId: req.session.orgId`, use `findFirst`, 404 on miss.
```

- Rate each finding as reach times blast radius and state both, since a bug behind
  three auth layers filed as critical makes the reader discount the real critical one.
- Prove exploitability with a second account rather than asserting it, because
  "an attacker could" without a transcript gets argued away and stays unfixed.

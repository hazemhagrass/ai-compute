# API Security Audit

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="api-security-audit robot" width="200">
</div>

A skill for auditing a deployed HTTP API from the outside, probing live routes for broken object-level and function-level authorization, mass assignment, over-exposure, missing limits, CORS mistakes, unsigned webhooks, and stale versions.

## What it does

`SKILL.md` gives an agent a request-driven audit procedure for an API that is
already running. The unit of work is a request, not a file: every finding is a
transcript of what was sent, what status came back, and which bytes leaked.

The procedure covers, in order:

1. Building a route inventory by diffing the router, the OpenAPI spec, and the gateway
2. BOLA and IDOR, replaying every ID-bearing request across two tenants
3. Broken function-level authorization, including admin routes guarded only in the UI
4. Mass assignment and overposting through non-strict body binding
5. Excessive data exposure from returning raw ORM rows and filtering client-side
6. Missing rate limits, unbounded pagination, and uncapped query cost
7. CORS misconfiguration, especially reflected origins paired with credentials
8. Unauthenticated internal, debug, metrics, and health routes
9. Verbose error leakage on the unexpected-exception path
10. HTTP method and content-type confusion
11. Webhook signature verification over raw bytes
12. Old API versions left live with weaker checks

Each section carries imperative rules with the reason attached, a paired bad and
good TypeScript example, and where useful a `curl` probe you can run directly.
The reporting section fixes the finding format: request, response, reach, fix.

## When to use this

Concrete triggers:

- An API is about to be exposed to the public internet or to a new partner.
- You hold credentials for two accounts in different tenants and want to know
  whether one can read the other's data.
- A service was refactored into versioned routes and the old paths are still served.
- A webhook receiver was added and you need to know whether it is anonymous write access.
- A browser client started sending cookies cross-origin and CORS was loosened to fix it.
- A pentest report arrived with vague findings and you need reproducible transcripts.
- A new column landed on a shared model and you want to know which endpoints now ship it.

Do not use this skill when you have no deployed environment to send requests to,
or when the question is what an endpoint should look like before it exists.

## Quick start

Set up the minimum viable audit environment: two tokens in different tenants and
one object id belonging to the first.

```bash
export TOK_A="..."   # user in org A
export TOK_B="..."   # user in org B, unrelated
export ORDER_A="ord_..."  # an object owned by org A
export BASE="https://api.example.com"
```

Step 1, diff the served routes against the documented ones:

```bash
curl -s "$BASE/openapi.json" | jq -r '.paths | keys[]' | sort > spec.txt
rg -o --no-filename '"/v[0-9]+/[a-zA-Z0-9/_{}.-]+"' dist/ | tr -d '"' | sort -u > live.txt
comm -13 spec.txt live.txt
```

Step 2, the single highest yield check. Ask for A's object with B's token:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN_B" \
  "$BASE/v1/orders/$ORDER_A"
```

Anything other than 404 is a finding. A 403 is a weaker finding: it confirms the
object exists and turns the endpoint into an enumeration oracle.

Step 3, sweep prior versions and internal aliases for the same object:

```bash
for p in v1 v2 api internal; do
  printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_B" "$BASE/$p/orders/$ORDER_A")"
done
```

Step 4, check CORS with a forged origin:

```bash
curl -si -H "Origin: https://evil.tld" -H "Authorization: Bearer $TOKEN_A" \
  "$BASE/v1/me" | rg -i 'access-control-allow-(origin|credentials)'
```

A reflected origin alongside `Access-Control-Allow-Credentials: true` grants every
site on the internet authenticated read access through a victim's browser.

Step 5, try to write a privileged field you should not own:

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN_B" -H 'Content-Type: application/json' \
  -d '{"displayName":"probe","role":"admin"}' "$BASE/v1/me"
curl -s -H "Authorization: Bearer $TOKEN_B" "$BASE/v1/me" | jq .role
```

Then open `SKILL.md` and work the remaining sections against the route inventory.

## Key concepts

**Object-level authorization is per request, not per route.** A route can be fully
authenticated, fully role gated, and still hand every caller every row, because the
role check answers "may you call this" and never answers "may you touch this id".
Scope must live inside the query that loads the row.

**The scope comes from the session.** A tenant taken from a body field, a query
param, or an `X-Org-Id` header is a tenant the attacker chooses. This is the single
substitution that turns a correct-looking `where` clause into a full data breach.

**404 over 403 outside the caller's scope.** Returning 403 tells the caller the row
exists. That converts an authorization bug into a working enumeration primitive even
when the body is withheld.

**Allowlist in both directions.** Inbound, bind bodies to a strict schema so privileged
columns are unwritable by construction. Outbound, serialize through a view function so
new columns are unreadable until someone adds them deliberately.

**Reflection is the dangerous CORS variant.** Browsers reject a literal `*` with
credentials, so any credentialed cross-origin setup that appears to work is echoing
the request origin, which is equivalent to allowing all origins.

**Raw bytes for signatures.** A webhook signature covers the exact bytes the sender
transmitted. Verifying a parsed and re-serialized object compares a payload nobody
signed, and key ordering or whitespace differences make it fail open or fail shut
for the wrong reasons.

**Old versions are supported bypasses.** A fix applied in the `/v2` handler rather
than the shared service layer leaves `/v1` exploitable, and `/v1` is still routed.

## Common pitfalls

- Auditing with a single account. Cross-tenant bugs are invisible without a second
  tenant, and the entire highest-severity class depends on the comparison.
- Testing only `GET`. Authorization gates are commonly wired to read handlers and
  omitted on `PATCH` and `DELETE`, which are the destructive ones.
- Treating opaque UUIDs as authorization. They raise the cost of guessing and do
  nothing else, and ids leak through exports, share links, and webhook payloads.
- Checking the parent route and skipping its children. `/orders/{id}` is usually
  scoped; `/orders/{id}/items` and `/orders/{id}/pdf` frequently are not.
- Reading the CORS config file instead of the response headers. The gateway, the
  framework, and the CDN each add headers and routinely disagree.
- Reporting missing rate limits on a route already covered by the gateway or CDN,
  unless the audit scope explicitly excludes that layer.
- Assuming "internal" implies network isolation. Probe `/metrics`, `/debug`, and
  `/actuator` from outside before granting that assumption.
- Filing theoretical findings at top severity. One inflated rating makes the reader
  discount the real critical finding further down the page.
- Describing an exploit instead of sending it. A finding without a request and a
  status code is an opinion and gets argued away.

## See also

- [security/security-audit](../security-audit/SKILL.md) for auditing source code
  across injection, secret handling, SSRF, and deserialization. Use it when you have
  the repository; use this skill when you have the deployment.
- [engineering/api-design](../../engineering/api-design/SKILL.md) for designing the
  endpoint correctly in the first place: status codes, error shapes, pagination,
  idempotency, and additive versioning.
- [engineering/api-integration](../../engineering/api-integration/SKILL.md) for the
  client side of the same surface, including auth handling and retries.
- [engineering/code-review](../../engineering/code-review/SKILL.md) for catching these
  defects in a diff before they reach an environment you can probe.
- [engineering/database-design](../../engineering/database-design/SKILL.md) for the
  tenant scoping and constraint work that makes cross-tenant reads impossible.

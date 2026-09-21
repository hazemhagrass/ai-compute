# Security Audit

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for auditing application code for real-world vulnerabilities in frequency order (authorization first, cryptography last), backed by grep evidence and reproducible findings.

## What it does

`SKILL.md` gives an agent a fixed order of work, the grep patterns that surface
each vulnerability class, vulnerable/fixed code pairs, a severity rubric, a
finding template, and an explicit list of things that must not be reported.

The order of work is:

1. Authorization (object-level and tenant-level access control)
2. Injection (SQL, NoSQL, command, template, path)
3. Secret handling (storage, logging, error echo)
4. SSRF and outbound request control
5. Unsafe deserialization and dynamic evaluation
6. Dependency CVEs

Roughly half the audit budget goes to step 1, because authorization defects
outnumber every other class in application code and no scanner finds them
reliably. The order holds even under time pressure: an audit that stops after
step 2 still covers the classes behind most real breaches.

The skill also defines what the output looks like. Every finding carries a
location, the vulnerable line, a numbered exploit path, an impact statement,
and a fix written as code. Findings are grouped by severity so a reader can
stop when they run out of urgency.

## When to use this

Concrete triggers:

- A pull request touches a route handler that accepts an ID from the client.
- A new tenant, org, or workspace scope is introduced to a data model.
- Before shipping an endpoint that fetches a user-supplied URL (webhooks,
  avatar imports, link previews, "load my OpenAPI spec").
- A third-party API integration is added and its error bodies are surfaced to
  clients or logs.
- Someone asks "is this safe to make public" about an internal service.
- A dependency bump brings in advisories and you need a reachability call, not
  a raw CVSS dump.
- Pre-release review of a service that handles more than one customer's data.

Do not use it as a generic linter pass. It assumes you can read the code,
resolve where a value comes from, and write a reproduction.

## Quick start

Audit a TypeScript/Prisma API. Work step 1 first and do not move on early.

Step 1, find handlers that fetch by client-supplied ID with no scope:

```bash
cd services/api

rg -n --type ts 'findUnique\(|findByPk\(|getById\(' -A 6 \
  | rg -v 'orgId|tenantId|userId|accountId|workspaceId'
```

Sample hit:

```
src/api/invoices.ts:42:  const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
```

Confirm the route is authenticated but not authorized:

```bash
rg -n -B 3 'findUnique' src/api/invoices.ts
```

```typescript
app.get("/api/invoices/:id", requireAuth, async (req, res) => {
  const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
  res.json(invoice);
});
```

`requireAuth` answers "who are you". Nothing answers "may you touch this row".
Reproduce it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Cookie: session=<org B user session>" \
  https://api.example.com/api/invoices/<id owned by org A>
# 200
```

The fix scopes in the same query and returns 404 on miss:

```typescript
app.get("/api/invoices/:id", requireAuth, async (req, res) => {
  const invoice = await db.invoice.findFirst({
    where: { id: req.params.id, orgId: req.session.orgId }, // scope from session
  });
  if (!invoice) return res.status(404).end(); // 404, not 403
  res.json(invoice);
});
```

Then check the matching list endpoint, since a scoped detail route paired with
an unscoped list route leaks the whole table anyway:

```bash
rg -n 'findMany\(' src/api/invoices.ts -A 4 | rg -v 'orgId'
```

Step 2, injection escape hatches:

```bash
rg -n 'queryRawUnsafe|executeRawUnsafe|\.raw\(|\.extra\(|sequelize\.literal'
rg -n 'ORDER BY.*\$\{|ORDER BY.*\+ '
```

Step 3, secrets and upstream error echo:

```bash
rg -n 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|BEGIN [A-Z ]*PRIVATE KEY'
rg -n 'await (res|r|response)\.text\(\)' -B 2 -A 2
```

Step 6, dependencies, read entries and not the summary count:

```bash
npm audit --omit=dev --json \
  | jq '.vulnerabilities | to_entries[]
        | select(.value.severity=="critical" or .value.severity=="high") | .key'
```

Write the finding in the skill's format:

```markdown
### [P1] Cross-tenant read on invoice detail
**Location:** `src/api/invoices.ts:42`
**Vulnerable code:**
    const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });

**Exploit path:**
1. Authenticate as any user in org B.
2. GET /api/invoices/<id belonging to org A> with that session cookie.
3. Response: 200 with org A's line items and billing contact.

**Impact:** Any authenticated user reads any invoice in the system (all tenants).
**Fix:** Add `orgId: req.session.orgId` to the where clause, switch to `findFirst`,
and return 404 on miss so existence is not confirmed.
```

## Key concepts

**Authentication is not authorization.** Authentication bugs are loud: login
breaks, tests fail, tickets arrive within the hour. Authorization bugs are
silent: the page renders, the response is 200, and tenant B reads tenant A's
invoices for months.

**Scope in the query, not after it.** A two-step check (fetch, then compare
owner) invites a later refactor to drop the check while keeping the fetch.
One query with the scope in the `where` clause cannot drift apart.

**Scope comes from the session.** A tenant or org id read from the request
body or a client-settable header is an attacker-supplied scope.

**404 over 403.** Returning 403 for an object outside the caller's scope
confirms the record exists and turns an authorization bug into an enumeration
oracle.

**Identifiers need allowlists, values need parameters.** `ORDER BY` targets,
table names, and column names cannot be parameterized. Map them through a
dictionary of known-good identifiers and parameterize everything else.

**Upstream error bodies are the sleeper secret leak.** When a third-party API
rejects a key, its 401 body frequently echoes the submitted key back. Logging
or forwarding that body republishes the credential.

**SSRF is a DNS problem, not a string problem.** Resolve the hostname, validate
the resolved IP, then connect to that IP with the original Host header.
Validating a hostname and handing the URL to an HTTP client re-resolves DNS,
which lets an attacker answer the first lookup with a public IP and the second
with 127.0.0.1. Block 169.254.0.0/16 above all, since 169.254.169.254 is the
cloud metadata service and hands out instance credentials over plain HTTP.

**Severity is exploitability times blast radius, and both are written down.**
Exploitability is who can reach it (anonymous, any authenticated user,
same-tenant user, admin only). Blast radius is one record, one tenant, all
tenants, or the infrastructure itself. P0 is anonymous or any-authenticated
reach with cross-tenant or infrastructure impact. P3 is hardening with no
demonstrated path to impact.

**Noise costs more than a missed bug.** One inflated severity makes the reader
discount every other item, including the real P0 further down the page.

## Common pitfalls

**Starting with cryptography and headers.**

```
Bad:  Section 1: TLS configuration. Section 2: missing CSP header.
      Section 8: "reviewed access control, looked fine".
Good: Section 1: authorization, half the audit budget, every handler that
      accepts a client ID enumerated and checked.
```

**Checking ownership after the fetch.**

```typescript
// Bad: two steps drift apart on the next refactor.
const doc = await db.doc.findUnique({ where: { id } });
if (doc.orgId !== session.orgId) return res.status(403).end();

// Good: one query, scope inside it, 404 on miss.
const doc = await db.doc.findFirst({ where: { id, orgId: session.orgId } });
if (!doc) return res.status(404).end();
```

**Trusting a JWT admin claim the service never re-verifies.**

```
Bad:  if (jwt.isAdmin) return allRecords();
Good: const role = await db.membership.findFirst({ where: { userId, orgId } });
      if (role?.level !== "admin") return res.status(404).end();
```

Stale or forged claims outlive revocation.

**Auditing detail endpoints and skipping list endpoints.**

```
Bad:  GET /api/invoices/:id is scoped. Marked clean.
Good: GET /api/invoices (list) checked too, since an unscoped list leaks the
      same rows the scoped detail route protects.
```

**Blocklisting the string "localhost" for SSRF.**

```python
# Bad: misses 127.0.0.1, 0.0.0.0, [::1], 2130706433, 0x7f.1, localtest.me,
# and breaks legitimate sidecar and self-hosted calls.
if "localhost" in url or "127.0.0.1" in url:
    raise ValueError("blocked")

# Good: resolve, then check the resolved IP against blocked networks.
ips = {ipaddress.ip_address(i[4][0])
       for i in socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)}
if any(ip in net for ip in ips for net in BLOCKED):
    raise ValueError("destination not permitted")
```

**Validating only the first URL in a redirect chain.**

```
Bad:  check(url); requests.get(url)  # 302 to 169.254.169.254 wins
Good: allow_redirects=False, re-validate every hop, or route through an
      egress proxy that owns the IP policy in one place.
```

**Reporting a finding with no reproduction.**

```
Bad:  "An attacker could potentially access other users' data here."
Good: "GET /api/invoices/<org A id> with an org B session returns 200 with
      org A's line items. src/api/invoices.ts:42."
```

**Filing noise as findings.**

```
Bad:  [P2] Missing CSP header on a cookie-less JSON API.
      [P1] Hardcoded secret (test fixture pointing at localhost).
      [P2] Uses MD5 (as an ETag cache key).
Good: Those go in a labeled non-blocking hardening appendix, or nowhere.
```

**Shipping raw CVSS scores with no reachability analysis.**

```
Bad:  "14 critical advisories" from `npm audit` pasted verbatim.
Good: Two advisories reachable from an entry point, listed with the call path.
      Twelve dev-only or unreachable, named and downgraded explicitly.
```

**Never withdrawing a finding.** If a compensating control makes an item
unreachable, withdraw it and say that you withdrew it. A report that
self-corrects gets believed the next time it escalates.

## See also

- `SKILL.md` in this directory for the full grep patterns, code pairs, the
  severity table, the finding template, and the complete "what is NOT a
  finding" list.
- `../code-review/` for general correctness and maintainability review, which
  runs on a different pass than this one.
- OWASP API Security Top 10, whose BOLA and BOPLA entries match the
  authorization class prioritized here.

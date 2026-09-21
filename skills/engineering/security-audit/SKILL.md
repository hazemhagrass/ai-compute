---
name: security-audit
description: "Use when auditing code for vulnerabilities. Hunts authorization gaps, injection, secret leaks, and SSRF in frequency order with grep-driven evidence."
---

# Security Audit

Audit by real-world frequency, not textbook taxonomy. The bugs that actually leak customer data are boring: a missing tenant filter, a string-built query, a key echoed in an error body. Work the list in order and stop pretending every audit must begin with cryptography.

## Order of Work

1. Authorization (object-level and tenant-level access control)
2. Injection (SQL, NoSQL, command, template, path)
3. Secret handling (storage, logging, error echo)
4. SSRF and outbound request control
5. Unsafe deserialization and dynamic evaluation
6. Dependency CVEs

- Follow this order even under time pressure, because an audit cut short after step two still covers the classes that cause most real breaches.
- Budget roughly half the total time to step one, since authorization defects outnumber every other class in application code and no scanner finds them reliably.

## Authorization Comes First

Authentication answers "who are you". Authorization answers "may you touch this specific row". Authentication bugs are loud: the login breaks, tests fail, users file tickets within the hour. Authorization bugs are silent: the page renders, the response is 200, and tenant B quietly reads tenant A's invoices for months.

- Treat every handler that accepts an ID from the client as guilty until proven innocent, because an ID in the request is the attacker's only lever and they will iterate it.
- Verify ownership in the same query that fetches the row, not in a check afterward, because a two-step check invites a later refactor to drop the check while keeping the fetch.
- Require the tenant or org scope to come from the session, never from the request body or a client-settable header, since a client-supplied scope is an attacker-supplied scope.
- Check authorization on writes and deletes as rigorously as on reads, because destructive endpoints get skipped on the theory that nobody would guess the ID.
- Audit list endpoints too: a scoped detail endpoint paired with an unscoped list endpoint leaks the whole table anyway.
- Flag any admin check based on a JWT boolean the service never re-verifies against the database, because stale or forged claims outlive revocation.
- Return 404 rather than 403 for objects outside the caller's scope, because 403 confirms the record exists and turns an authorization bug into an enumeration oracle.

Vulnerable:

```typescript
// Authenticated, but not authorized: any logged-in user reads any invoice.
app.get("/api/invoices/:id", requireAuth, async (req, res) => {
  const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });
  res.json(invoice);
});
```

Fixed:

```typescript
app.get("/api/invoices/:id", requireAuth, async (req, res) => {
  const invoice = await db.invoice.findFirst({
    where: { id: req.params.id, orgId: req.session.orgId }, // scope from session
  });
  if (!invoice) return res.status(404).end(); // 404, not 403: do not confirm existence
  res.json(invoice);
});
```

Grep for handlers that read an ID and never mention a scope:

```bash
rg -n --type ts 'findUnique\(|findByPk\(|getById\(' -A 6 \
  | rg -v 'orgId|tenantId|userId|accountId|workspaceId'

rg -n --type py 'objects\.get\(|objects\.filter\(|session\.query\(' -A 4 \
  | rg -v 'tenant|org|owner|user_id'

# Routes with auth but no authz helper anywhere in the file:
rg -l 'requireAuth|@login_required' --type ts --type py \
  | xargs rg -L 'can\(|authorize|assertOwner|has_permission|check_access'
```

## Injection

- Reject any query assembled with concatenation or f-strings, even when the input "comes from an enum", since enums become free text after one refactor.
- Check ORM escape hatches (`raw`, `$queryRawUnsafe`, `extra`, `literal`) by name, because these are where parameterization is silently abandoned.
- Treat ORDER BY and table or column names specially: they cannot be parameterized, so they need an allowlist rather than escaping.
- Flag `shell=True` and any `exec` or `system` call built from request data, because argument-array APIs remove the shell entirely.

```bash
rg -n 'execute\(\s*f"|\+\s*req\.|\$\{.*\}.*(SELECT|INSERT|UPDATE|DELETE)'
rg -n 'queryRawUnsafe|executeRawUnsafe|\.raw\(|\.extra\(|sequelize\.literal'
rg -n 'shell=True|child_process\.exec\(|os\.system\(|subprocess\.call\(.*shell'
rg -n 'ORDER BY.*\$\{|ORDER BY.*\+ '
```

```python
# Vulnerable: sort field interpolated straight into SQL.
cur.execute(f"SELECT * FROM jobs WHERE org_id = %s ORDER BY {sort}", (org_id,))

# Fixed: allowlist the identifier, parameterize the value.
SORTS = {"created": "created_at", "name": "name"}
column = SORTS.get(sort, "created_at")
cur.execute(f"SELECT * FROM jobs WHERE org_id = %s ORDER BY {column}", (org_id,))
```

## Secret Handling

- Scan the working tree for high-entropy literals before reading any code, because a committed key is exploitable the moment the repo is cloned.
- Forbid logging whole request or response objects on the auth path, since those objects carry tokens in headers and bodies.
- Redact credentials before they reach an error handler, not inside it, because error handlers get bypassed by unexpected exception types.
- Confirm `.env`, `*.pem`, and credential fixtures are ignored, because a gitignore gap is a one-line fix and a total compromise.

Upstream error bodies are the sleeper leak. When a third-party API rejects a key, its 401 body frequently echoes the submitted key (or a long prefix of it) back to you. Forwarding that body to the client, or writing it to a log with a wider audience than the secret itself, republishes the credential.

```typescript
// Vulnerable: the upstream 401 body may contain the key that was just sent.
const r = await fetch(url, { headers: { Authorization: authHeader } });
if (!r.ok) throw new Error(`upstream failed: ${await r.text()}`);

// Fixed: record status and a correlation id, never the upstream body verbatim.
if (!r.ok) {
  logger.warn({ status: r.status, requestId, provider }, "upstream rejected");
  throw new UpstreamError(`provider returned ${r.status}`);
}
```

```bash
rg -n '(api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*["'"'"'][A-Za-z0-9/+_-]{16,}'
rg -n 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|BEGIN [A-Z ]*PRIVATE KEY'
rg -n 'console\.log\(.*(req|headers|token|auth)|logger\.(info|debug)\(.*headers'
rg -n 'await (res|r|response)\.text\(\)' -B 2 -A 2   # check each for forwarding to the client
rg -n 'JSON\.stringify\(err|str\(e\)|traceback\.format_exc' -A 2
```

## SSRF

Server-side request forgery is under-audited because the vulnerable code looks like a feature: webhooks, avatar imports, URL previews, "fetch my OpenAPI spec".

- Block the link-local range 169.254.0.0/16, above all 169.254.169.254, because that address is the cloud metadata service and hands instance credentials to anything that asks over plain HTTP.
- Resolve the hostname yourself, validate the resolved IP, then connect to that IP with the original Host header, because validating a hostname and then handing the URL to an HTTP client re-resolves DNS, letting an attacker answer the first lookup with a public IP and the second with 127.0.0.1 (DNS rebinding).
- Validate every hop of a redirect chain, not just the initial URL, since a public URL that 302s to metadata defeats a single up-front check.
- Do not implement this as a string blocklist of "localhost": that misses `127.0.0.1`, `0.0.0.0`, `[::1]`, `2130706433` (decimal), `0x7f.1`, and `localtest.me`, while breaking legitimate use. Real deployments reach local or private services on purpose (a sidecar, an internal registry, a self-hosted instance calling its own API), so a name blocklist punishes those users and still lets attackers through.
- Prefer an allowlist of permitted destinations for machine-to-machine fetches, and where user-supplied URLs are genuinely required, route them through an egress proxy with its own IP policy, because policy in one place beats policy duplicated at every call site.

```python
import ipaddress, socket

BLOCKED = [ipaddress.ip_network(n) for n in (
    "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
)]

def safe_target(hostname: str, port: int) -> str:
    infos = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
    ips = {ipaddress.ip_address(i[4][0]) for i in infos}
    for ip in ips:
        if any(ip in net for net in BLOCKED):
            raise ValueError("destination not permitted")
    return str(next(iter(ips)))  # connect to THIS ip, keep the Host header
```

```bash
rg -n 'fetch\(|axios\.(get|post)\(|requests\.(get|post)\(|urlopen\(|httpx\.' -A 2 \
  | rg -i 'req\.|request\.|body|params|query|url'
rg -n 'allow_redirects|maxRedirects|follow.?redirect'
rg -n '169\.254|metadata\.google|instance-data'
```

## Unsafe Deserialization and Dynamic Evaluation

- Treat `pickle`, `yaml.load` without `SafeLoader`, PHP `unserialize`, Java native deserialization, and `node-serialize` as remote code execution whenever the input crosses a trust boundary.
- Replace `eval`, `exec`, and `new Function` on request data outright rather than sanitizing, because sanitizing an interpreter input is a losing arms race.
- Check template engines for user-controlled template strings (server-side template injection), as distinct from user-controlled template variables, which are fine.

```bash
rg -nP 'pickle\.loads|yaml\.load\((?!.*SafeLoader)'
rg -n '\beval\(|\bexec\(|new Function\(|vm\.runInNewContext'
rg -n 'Template\(.*(req|request|user)|render_template_string\('
rg -n 'ObjectInputStream|readObject\(|node-serialize'
```

## Dependency CVEs

- Run the ecosystem auditor and read the entries rather than the summary count, because most advisories sit in dev-only or unreachable code paths.
- Downgrade an advisory that is not reachable from any entry point and say so explicitly, since an unreachable CVE listed as critical trains readers to ignore the section.
- Prioritize advisories in packages that parse untrusted input (serializers, image and archive handlers, XML and YAML parsers), because those sit on the attack surface.

```bash
npm audit --omit=dev --json \
  | jq '.vulnerabilities | to_entries[] | select(.value.severity=="critical" or .value.severity=="high") | .key'
pip-audit --strict || true
```

## Severity Triage

Score every finding as exploitability times blast radius, and write both factors down.

- Exploitability: who can reach it (anonymous internet, any authenticated user, same-tenant user, admin only) and what they must already know or hold.
- Blast radius: one record, one tenant, all tenants, or the infrastructure itself (credentials, RCE, egress into the private network).

| Severity | Shape |
| --- | --- |
| P0 | Anonymous or any-authenticated reach with cross-tenant or infrastructure impact (IDOR across orgs, SQLi, SSRF to metadata, RCE) |
| P1 | Authenticated reach with full tenant impact, or a credential exposed to a wider audience than intended |
| P2 | Requires an unusual precondition, or impact bounded to the caller's own data |
| P3 | Defense in depth, hardening, no demonstrated path to impact |

- Never file a theoretical bug sitting behind three independent auth layers as P0, because one inflated severity makes the reader discount every other item, including the real P0 further down the page.
- State the precondition in the severity line itself, so the reader can disagree with your rating without re-deriving your reasoning.

## Reporting Format

A finding without a reproduction is a guess. Every entry carries three things: the vulnerable line, the exploit path, the fix.

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

- Include the exact request that demonstrates the bug, because "an attacker could" without a request is an opinion and will be argued away.
- Name the file and line, since a class-level description forces the reader to redo the search you already did.
- Give the fix as code, not as advice, because "validate input" is not a patch.
- Group findings by severity, not by file, so the reader can stop at the point where they run out of urgency.

## What Is NOT a Finding

Noise destroys the credibility of a security report faster than a missed bug. Keep these out of the findings list, or park them in a clearly labeled non-blocking hardening appendix.

- Missing security headers on a pure JSON API with no cookie auth and no browser rendering surface.
- A hardcoded secret in a test fixture pointing at a local or disposable service, unless it actually authenticates to something real.
- "Uses MD5" where the hash is a cache key or an ETag rather than a password or a signature, because non-cryptographic use of a fast hash is correct.
- Verbose stack traces behind a flag that is off in production, absent evidence the flag is on.
- Missing rate limiting on an endpoint already protected by an API gateway or CDN, unless the audit scope explicitly excludes that layer.
- Dependency advisories that are dev-only or unreachable, reported at raw CVSS with no reachability analysis.
- `dangerouslySetInnerHTML` on a constant string or on already-sanitized content, since the scary name is not the vulnerability.
- Generic advice ("consider adding input validation") with no specific input, no specific sink, and no demonstrated path between the two.
- Withdraw a finding the moment a compensating control makes it unreachable, and say that you withdrew it, because a report that self-corrects gets believed the next time it escalates.

# API Integration

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A field guide for calling someone else's HTTP API without your service falling over when theirs does.

## What it does

`SKILL.md` in this directory is the working reference for consuming third-party APIs. It covers the parts that break in production rather than the parts that are easy in a tutorial:

- **Auth**: API keys in headers, OAuth 2.0 client-credentials exchange, and token caching that refreshes 60 seconds before expiry instead of after a 401.
- **Rate limits**: reading `X-RateLimit-Remaining` / `X-RateLimit-Reset`, honouring `Retry-After`, and exponential backoff on 429.
- **Retry policy**: an explicit allow list (429, 500, 502, 503, 504, `ECONNRESET`, `ETIMEDOUT`) and a deny list (400, 401, 403, 404) so you never burn retries on a request that can't succeed.
- **Error handling**: check `response.ok` before `.json()`, because an HTML error page turns a readable 500 into a cryptic parse error.
- **Response validation**: assert the shape, ideally with Zod, instead of trusting the docs.
- **Pagination**: cursor-based (async generator) and offset-based loops, with correct last-page detection.
- **Timeouts**: `AbortController` for `fetch`, the `timeout` option for axios.
- **Logging**: what to record (url, method, status, body) and what to redact (tokens, PII).
- **Testing**: `msw` handlers for happy path and for retry-on-500.

It closes with 10 rules and a list of anti-patterns usable as a review checklist.

## When to use this

Concrete triggers:

- You are adding a new vendor to the codebase: Stripe, Twilio, Slack, SendGrid, a partner's internal API.
- An integration is flaky. Logs show intermittent `502` or `ETIMEDOUT` and there is no retry wrapper.
- You started seeing `429 Too Many Requests` after a traffic increase or a backfill job.
- A nightly sync silently imports only 100 of 4,300 records (unhandled pagination).
- A request hangs and takes a worker with it, because no timeout was set.
- An OAuth integration breaks every hour on the dot (token cached forever, or not cached at all).
- You are reviewing a PR that adds an HTTP client and want a checklist to review it against.
- `.json()` throws `Unexpected token '<'` and you need to know why.

Skip it when you are designing your own API (see `../api-design/`), or the work is a throwaway script where retries and pagination are overkill.

## Quick start

Say you are pulling every customer out of a vendor API that uses OAuth client credentials, cursor pagination, and a 100 req/min limit.

**1. Put credentials in the environment, never in the repo.**

```bash
# .env (gitignored)
VENDOR_CLIENT_ID=ci_live_...
VENDOR_CLIENT_SECRET=cs_live_...

# verify it is ignored before you write any code
grep -n '^\.env$' .gitignore
```

**2. Probe the API by hand before writing a client.** You learn the auth shape, the error format, and the rate limit headers in about two minutes.

```bash
TOKEN=$(curl -s -X POST https://oauth.vendor.com/token \
  -d grant_type=client_credentials \
  -d client_id="$VENDOR_CLIENT_ID" \
  -d client_secret="$VENDOR_CLIENT_SECRET" | jq -r .access_token)

curl -si https://api.vendor.com/v1/customers?limit=2 \
  -H "Authorization: Bearer $TOKEN" | head -30
```

Read the response headers for the limit names, the reset format (Unix seconds vs delta seconds), and the cursor field name. They differ per vendor; do not guess.

**3. Write the client with a cached token, a retry wrapper, and a timeout.**

```javascript
// vendor-client.js
import { z } from 'zod';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiresAt) return token;

  const res = await fetch('https://oauth.vendor.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.VENDOR_CLIENT_ID,
      client_secret: process.env.VENDOR_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);

  const { access_token, expires_in } = await res.json();
  token = access_token;
  tokenExpiresAt = Date.now() + (expires_in - 60) * 1000; // refresh 60s early
  return token;
}

async function request(path, { maxRetries = 4, timeoutMs = 10_000 } = {}) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`https://api.vendor.com${path}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
        signal: controller.signal,
      });

      if (res.ok) return res.json();

      // Do not retry client errors; they will not fix themselves.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`vendor ${res.status} on ${path}: ${await res.text()}`);
      }

      const retryAfter = Number(res.headers.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2 ** attempt * 1000;

      console.warn('vendor retry', { path, status: res.status, attempt, waitMs });
      await sleep(waitMs);
    } catch (err) {
      if (err.name !== 'AbortError' || attempt === maxRetries - 1) throw err;
      console.warn('vendor timeout', { path, attempt, timeoutMs });
      await sleep(2 ** attempt * 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`vendor: ${path} failed after ${maxRetries} attempts`);
}
```

**4. Validate the payload, then paginate to exhaustion.**

```javascript
const Page = z.object({
  customers: z.array(z.object({
    id: z.string(),
    email: z.string().email(),
    created_at: z.string(),
  })),
  next_cursor: z.string().nullable().optional(),
});

export async function* allCustomers() {
  let cursor = null;
  do {
    const query = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : '?limit=100';
    const page = Page.parse(await request(`/v1/customers${query}`));
    yield* page.customers;
    cursor = page.next_cursor ?? null;
  } while (cursor);
}
```

```javascript
let count = 0;
for await (const customer of allCustomers()) count++;
console.log(`synced ${count} customers`);
```

**5. Test it against `msw`, not against the vendor.**

```javascript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

let hits = 0;
const server = setupServer(
  http.post('https://oauth.vendor.com/token', () =>
    HttpResponse.json({ access_token: 't', expires_in: 3600 })),
  http.get('https://api.vendor.com/v1/customers', () => {
    hits++;
    if (hits === 1) return new HttpResponse(null, { status: 503 });
    return HttpResponse.json({ customers: [{ id: 'c1', email: 'a@b.com', created_at: 'x' }], next_cursor: null });
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

test('recovers from a transient 503', async () => {
  const out = [];
  for await (const c of allCustomers()) out.push(c);
  expect(out).toHaveLength(1);
  expect(hits).toBe(2);
});
```

```bash
npx vitest run vendor-client.test.js
```

## Key concepts

- **Transient vs terminal errors.** A 503 means "try again". A 403 means "you are not allowed, ever". Retrying the second class wastes your quota and hides the real bug.
- **Backoff and jitter.** `2 ** attempt * 1000` spreads load. A vendor-supplied `Retry-After` always wins over your own math.
- **Refresh-before-expiry.** Caching a token until it expires guarantees a 401 on the boundary request. Subtract a safety margin (60s).
- **Status before parse.** `response.ok` is the gate. `.json()` on an HTML 500 page raises a parse error that tells you nothing about the actual failure.
- **Parse, do not trust.** A schema check at the boundary turns "undefined is not a function" three layers deep into "the vendor stopped sending `email`".
- **Last-page detection differs.** Cursor APIs end when the cursor is null; offset APIs end when a page returns fewer rows than the limit. Using the wrong test either truncates data or loops forever.
- **Idempotency.** Retrying a POST can double-charge. Send an idempotency key when the vendor supports one.
- **Redaction is part of logging.** Log url, method, status, and error body. Strip `Authorization` and `X-API-Key` before they reach the log sink.

## Common pitfalls

**Parsing before checking status**

```javascript
// Bad: throws "Unexpected token '<'" on an HTML 502 page
const data = await (await fetch(url)).json();

// Good: the real status and body reach your logs
const res = await fetch(url);
if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
const data = await res.json();
```

**Retrying everything**

```javascript
// Bad: 4 attempts at a request that can never succeed
for (let i = 0; i < 4; i++) {
  const res = await fetch(url);
  if (res.ok) return res.json();
  await sleep(1000);
}

// Good: retry transient classes only
if (res.status >= 400 && res.status < 500 && res.status !== 429) {
  throw new Error(`client error ${res.status}`);
}
```

**Immediate retry on 429**

```javascript
// Bad: hammering a rate-limited endpoint deepens the ban
while (!(res = await fetch(url)).ok) { /* spin */ }

// Good: honour the vendor's own instruction
const waitMs = Number(res.headers.get('Retry-After') || 0) * 1000 || 2 ** attempt * 1000;
await sleep(waitMs);
```

**Assuming page one is the dataset**

```javascript
// Bad: silently syncs 100 of 4,300 records
const { customers } = await request('/v1/customers');
await upsertAll(customers);

// Good: drain the cursor
for await (const customer of allCustomers()) await upsert(customer);
```

**No timeout**

```javascript
// Bad: a stalled TCP connection pins a worker indefinitely
const res = await fetch(url);

// Good: bound every call
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 10_000);
try {
  const res = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timer);
}
```

**Token cached until it expires**

```javascript
// Bad: the request landing on the expiry second gets a 401
tokenExpiresAt = Date.now() + expires_in * 1000;

// Good: refresh with a margin
tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;
```

**Logging the whole request**

```javascript
// Bad: bearer tokens and passwords end up in your log aggregator forever
console.error('failed', { url, headers: options.headers, body: options.body });

// Good: redact known secret headers first
console.error('failed', { url, status: res.status, headers: redactHeaders(options.headers) });
```

## See also

- [`SKILL.md`](./SKILL.md) - the full reference this README introduces.
- [`../api-design/`](../api-design/) - the other side of the wire: designing the API you expose.
- [`../test-strategy/`](../test-strategy/) - where mocked integration tests fit in the wider pyramid.
- [`../debugging/`](../debugging/) - tracing an intermittent failure back to its root cause.
- [`../security-audit/`](../security-audit/) - credential storage, secret scanning, and log hygiene.

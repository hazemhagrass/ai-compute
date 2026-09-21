---
name: api-integration
description: Use when integrating a third-party API. Handle auth, retries, rate limits, and errors robustly.
---

Integrate external APIs reliably by reading the docs for auth and rate limits, handling transient errors with retries, validating responses before trusting them, and logging enough detail to debug production failures.

## Integration checklist

Before writing code:

1. **Read the API docs** - auth method, rate limits, error codes, pagination
2. **Get test credentials** - sandbox/staging endpoint if available
3. **Check the client library** - official SDK often handles retries/auth
4. **Plan for failures** - what happens if the API is down for 10 minutes?

## Authentication patterns

### API key in header

```javascript
fetch('https://api.example.com/v1/users', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
```

**Store the key securely:**
- Environment variable (`process.env.API_KEY`)
- Secret management service (AWS Secrets Manager, HashiCorp Vault)
- Never commit to git, even in `.env.example`

### OAuth 2.0 flow

```javascript
// Step 1: Get access token
const tokenResponse = await fetch('https://oauth.example.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  })
});
const { access_token, expires_in } = await tokenResponse.json();

// Step 2: Use the token (cache it until expiry)
const apiResponse = await fetch('https://api.example.com/v1/data', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

**Cache the token:**
```javascript
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  // Fetch new token
  const res = await fetch(...);
  const { access_token, expires_in } = await res.json();
  cachedToken = access_token;
  tokenExpiry = Date.now() + (expires_in - 60) * 1000;  // Refresh 60s early
  return cachedToken;
}
```

## Rate limiting

APIs enforce rate limits (e.g., 100 requests/minute). Exceeding them returns 429 Too Many Requests.

### Respect rate limit headers

```javascript
const response = await fetch('https://api.example.com/v1/data');

const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');  // Unix timestamp

if (remaining === '0') {
  const waitMs = (reset * 1000) - Date.now();
  console.log(`Rate limit hit. Waiting ${waitMs}ms`);
  await sleep(waitMs);
}
```

### Retry with exponential backoff on 429

```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.ok) {
      return response;
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');  // Seconds
      const waitMs = retryAfter ? retryAfter * 1000 : Math.pow(2, i) * 1000;
      console.log(`429 Too Many Requests. Retrying in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    
    // Other 4xx errors: don't retry (client error)
    if (response.status >= 400 && response.status < 500) {
      throw new Error(`Client error: ${response.status} ${await response.text()}`);
    }
    
    // 5xx errors: retry (server error, transient)
    if (response.status >= 500) {
      console.log(`Server error ${response.status}. Retry ${i+1}/${maxRetries}`);
      await sleep(Math.pow(2, i) * 1000);
      continue;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} retries`);
}
```

**Which errors to retry:**
- ✅ 429 Too Many Requests (rate limit)
- ✅ 500 Internal Server Error (transient)
- ✅ 502 Bad Gateway (upstream down)
- ✅ 503 Service Unavailable (overloaded)
- ✅ 504 Gateway Timeout
- ✅ Network errors (ECONNRESET, ETIMEDOUT)
- ❌ 400 Bad Request (your request is invalid)
- ❌ 401 Unauthorized (bad credentials)
- ❌ 403 Forbidden (not allowed)
- ❌ 404 Not Found (resource doesn't exist)

## Error handling

### Always check HTTP status before parsing JSON

```javascript
const response = await fetch('https://api.example.com/v1/users/123');

if (!response.ok) {
  const errorBody = await response.text();
  throw new Error(`API error ${response.status}: ${errorBody}`);
}

const data = await response.json();
```

**Why:** Some APIs return HTML error pages with status 500. Calling `.json()` on HTML throws a cryptic parse error instead of the real error message.

### Validate the response shape

```javascript
const data = await response.json();

// Don't assume the API returns what the docs say
if (!data.users || !Array.isArray(data.users)) {
  throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
}
```

**Use a schema validator:**
```javascript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string()
});

const UsersResponse = z.object({
  users: z.array(UserSchema)
});

const data = await response.json();
const parsed = UsersResponse.parse(data);  // Throws if shape is wrong
```

## Pagination

APIs paginate large result sets. Don't assume the first page is the full dataset.

### Cursor-based pagination

```javascript
async function* fetchAllUsers(apiKey) {
  let cursor = null;
  
  while (true) {
    const url = cursor 
      ? `https://api.example.com/v1/users?cursor=${cursor}`
      : `https://api.example.com/v1/users`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    
    yield* data.users;  // Yield each user
    
    if (!data.next_cursor) break;  // Last page
    cursor = data.next_cursor;
  }
}

// Use:
for await (const user of fetchAllUsers(API_KEY)) {
  console.log(user.email);
}
```

### Offset-based pagination

```javascript
async function fetchAllUsers(apiKey) {
  const allUsers = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(`https://api.example.com/v1/users?offset=${offset}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    
    allUsers.push(...data.users);
    
    if (data.users.length < limit) break;  // Last page
    offset += limit;
  }
  
  return allUsers;
}
```

## Timeouts

Always set a timeout. The default is often "never."

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10s timeout

try {
  const response = await fetch('https://api.example.com/v1/slow', {
    signal: controller.signal
  });
  const data = await response.json();
} catch (err) {
  if (err.name === 'AbortError') {
    console.error('Request timed out after 10s');
  } else {
    throw err;
  }
} finally {
  clearTimeout(timeoutId);
}
```

**For Node.js with axios:**
```javascript
const axios = require('axios');

const response = await axios.get('https://api.example.com/v1/data', {
  timeout: 10000  // 10s
});
```

## Logging for debugging

When an API call fails in production, you need enough context to reproduce it.

**Good logging:**
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    console.error('API call failed', {
      url,
      method: options.method || 'GET',
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    });
  }
} catch (err) {
  console.error('API call threw', {
    url,
    method: options.method || 'GET',
    error: err.message,
    stack: err.stack
  });
  throw err;
}
```

**Never log:**
- API keys or tokens
- User passwords or sensitive PII
- Full request bodies if they contain secrets

**Redact secrets in logs:**
```javascript
function redactHeaders(headers) {
  const safe = { ...headers };
  if (safe.Authorization) safe.Authorization = '<redacted>';
  if (safe['X-API-Key']) safe['X-API-Key'] = '<redacted>';
  return safe;
}
```

## Testing API integration

### Use a sandbox endpoint

Most APIs provide a test environment (e.g., `sandbox.api.example.com`). Use it for development.

### Mock the API in tests

```javascript
// tests/api.test.js
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('https://api.example.com/v1/users', (req, res, ctx) => {
    return res(ctx.json({ users: [{ id: 1, email: 'test@example.com' }] }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetchUsers returns user list', async () => {
  const users = await fetchUsers(API_KEY);
  expect(users).toHaveLength(1);
  expect(users[0].email).toBe('test@example.com');
});
```

### Test retry logic

```javascript
test('retries on 500 error', async () => {
  server.use(
    rest.get('https://api.example.com/v1/users', (req, res, ctx) => {
      if (req.url.searchParams.get('attempt') === '1') {
        return res(ctx.status(500));  // First call fails
      }
      return res(ctx.json({ users: [] }));  // Second call succeeds
    })
  );
  
  const users = await fetchWithRetry('https://api.example.com/v1/users?attempt=1');
  expect(users).toEqual({ users: [] });
});
```

## Rules

1. **Read the API docs before writing code.** Auth, rate limits, error codes, and pagination vary wildly.

2. **Use the official SDK if available.** It handles auth refresh, retries, and API changes.

3. **Retry transient errors (5xx, 429, network).** Don't retry client errors (4xx).

4. **Set timeouts.** The default is often forever.

5. **Log enough to debug production failures.** URL, method, status, error body. Redact secrets.

6. **Validate response shapes.** Don't assume the API returns what the docs say.

7. **Handle pagination.** Never assume the first page is complete.

8. **Cache OAuth tokens.** Refresh before expiry, not after.

9. **Respect rate limits.** Read `X-RateLimit-*` headers and back off on 429.

10. **Test with mocks.** Don't hit the real API in unit tests.

## Anti-patterns

- ❌ Committing API keys to git (even in a `.env.example`)
- ❌ Ignoring rate limit headers and retrying immediately on 429
- ❌ Parsing JSON before checking HTTP status (HTML error pages break `.json()`)
- ❌ Retrying 404 or 400 errors (they won't fix themselves)
- ❌ Fetching page 1 and assuming it's the full dataset
- ❌ No timeout (request hangs forever)
- ❌ Logging full request bodies that contain passwords or tokens

## When to use this skill

Use this skill when:
- Integrating a third-party API (Stripe, Twilio, Slack, etc.)
- API calls fail intermittently in production
- You hit rate limits or need to paginate large datasets
- You need to handle OAuth token refresh

Skip this skill when:
- Building your own API (different skill)
- The API is fully mocked (no real HTTP calls)
- Simple one-time scripts (retries/pagination overkill)

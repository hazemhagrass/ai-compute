---
name: authentication-audit
description: "Use when auditing authentication. Checks logins, tokens. Verifies password storage, session rotation, JWT claim validation, OAuth state and PKCE, MFA recovery codes, and reset-token single use."
---

# Authentication Audit

Authentication answers one question: is this caller who they claim to be. Everything downstream of that answer (which rows they may read, which tenant they belong to) is authorization, and belongs to `security-audit` instead. Audit the two separately, because a perfect permission model built on a forgeable session is worth nothing, and a hardened login flow in front of an unscoped query is equally worthless.

Work the identity lifecycle in order: how a credential is stored, how it is checked, what artifact the check hands back, how that artifact is carried and rotated, and how it is destroyed.

## Order of Work

1. Password storage (the hash function and its parameters)
2. Credential comparison (timing, enumeration, lockout)
3. Session artifact (entropy, transport, storage location)
4. Session lifecycle (fixation, rotation, logout, remember-me)
5. Token formats (JWT claim validation, revocation)
6. Federated flows (OAuth and OIDC state, PKCE, nonce)
7. Second factors and recovery paths
8. Reset and enrollment tokens

- Audit storage before anything else, because a fast hash over a leaked user table is exploitable offline forever and no downstream control undoes it.
- Treat recovery paths as first-class login paths, since password reset and MFA recovery are alternate front doors and attackers pick the weakest of the three.

## Password Storage

A password hash is not there to be fast. It exists to make an offline attack on a stolen database economically pointless, and the only lever for that is deliberate cost per guess.

- Require argon2id, scrypt, or bcrypt for passwords, because each is memory-hard or cost-parameterized and forces an attacker to spend real hardware per candidate guess.
- Reject SHA-256, SHA-512, MD5, and SHA-1 as password hashes even when salted, because a GPU computes billions of these per second, so a salt only stops precomputed rainbow tables and does nothing against a targeted dictionary run.
- Store the cost parameters inside the hash string rather than in config, so raising cost later does not orphan every existing row.
- Re-hash on successful login when the stored parameters are below current policy, because that is the only moment the plaintext is available to upgrade with.
- Cap the accepted password length (bcrypt silently truncates past 72 bytes) rather than letting a long passphrase be quietly shortened, since a truncated passphrase is weaker than the user believes.
- Never log the password, its length, or its hash on the auth path, because a hash in a log is a hash in a wider blast radius than the database it came from.

Vulnerable:

```typescript
import { createHash } from "node:crypto";

// Fast hash: a stolen users table is cracked offline at GPU speed.
const digest = createHash("sha256").update(salt + password).digest("hex");
if (digest === user.passwordHash) return issueSession(user);
```

Fixed:

```typescript
import argon2 from "argon2";

const POLICY = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const ok = await argon2.verify(user.passwordHash, password); // params read from the hash
if (!ok) return failLogin();
if (argon2.needsRehash(user.passwordHash, POLICY)) {
  await users.update(user.id, { passwordHash: await argon2.hash(password, POLICY) });
}
return issueSession(user);
```

```bash
rg -n 'createHash\(.(md5|sha1|sha256|sha512)|hashlib\.(md5|sha1|sha256)' -A 3 \
  | rg -i 'password|passwd|credential'
rg -n 'bcrypt\.hash\(|scrypt|argon2' -A 2   # confirm cost params are not defaults from 2012
```

## Comparing Credentials Without Leaking

- Compare secrets with a constant-time function (`crypto.timingSafeEqual`, `hmac.compare_digest`), because `===` and `==` return on the first differing byte and that difference is measurable over enough samples.
- Compare lengths before the constant-time call only when the function requires equal-length buffers, and hash both sides to a fixed width first so the length itself leaks nothing.
- Run the password verification even when the username does not exist, using a dummy hash, because skipping the expensive hash on a miss turns response latency into a free user-existence oracle.
- Return the same response body, the same status, and the same wording for "no such user" and "wrong password", since any difference between them enumerates your entire user list from the login form.
- Apply the same rule to signup and password reset: "that email is already registered" is a membership disclosure, so send a neutral message and mail the difference to the address instead.

Vulnerable:

```typescript
const user = await users.findByEmail(email);
if (!user) return res.status(404).json({ error: "No account with that email" }); // enumeration
if (user.apiToken === suppliedToken) return ok();                                 // timing leak
return res.status(401).json({ error: "Wrong password" });                         // enumeration
```

Fixed:

```typescript
import { timingSafeEqual, createHash } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest();
const equal = (a: string, b: string) => timingSafeEqual(sha(a), sha(b)); // fixed width

const user = await users.findByEmail(email);
const hash = user?.passwordHash ?? DUMMY_ARGON2_HASH; // always pay the hashing cost
const ok = await argon2.verify(hash, password);
if (!ok || !user) {
  return res.status(401).json({ code: "invalid_credentials", message: "Invalid email or password." });
}
```

## Session Artifacts

- Generate session identifiers from a cryptographically secure source with at least 128 bits of entropy, because `Math.random`, timestamps, and incrementing counters are all predictable enough to forge a neighbour's session.
- Store only a hash of the session token server-side, so a leaked session table cannot be replayed directly.
- Put browser session tokens in a cookie marked `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`, because a token in `localStorage` is readable by any script that ever gets injected and survives the page that leaked it.
- Never place a token in a URL path or query string, since URLs land in server logs, proxy logs, browser history, and the `Referer` header of every outbound link.
- Set an absolute session lifetime in addition to an idle timeout, because idle-only expiry lets a stolen token be kept alive indefinitely by a script that pings once a minute.

```typescript
import { randomBytes, createHash } from "node:crypto";

const raw = randomBytes(32).toString("base64url");          // 256 bits
await sessions.insert({ tokenHash: createHash("sha256").update(raw).digest("hex"), userId, absoluteExpiry });
res.cookie("sid", raw, { httpOnly: true, secure: true, sameSite: "lax", maxAge: IDLE_MS });
```

```bash
rg -n 'Math\.random|uuid\(\)|Date\.now\(\)' -B 2 -A 2 | rg -i 'session|token|reset|invite'
rg -n 'localStorage\.setItem\(|sessionStorage\.setItem\(' | rg -i 'token|jwt|auth'
rg -n 'cookie\(|set_cookie|SetCookie' -A 3 | rg -v 'httpOnly|HttpOnly'
```

## Fixation, Rotation, and Logout

Session fixation is the bug where the identifier a user carries after authenticating is the same one they carried before. An attacker who can plant a known value (a link with a session parameter, a subdomain cookie write) then holds a valid authenticated session without ever knowing a password.

- Issue a brand new session identifier at every privilege change: login, step-up MFA, role elevation, and password change, because the pre-authentication value may already be known to someone else.
- Destroy the old server-side record when you rotate, rather than leaving it valid alongside the new one, since an orphaned record is a live session nobody is watching.
- Invalidate every other session belonging to the user when the password changes, because "change your password" is the advice given after a compromise and it must actually evict the intruder.
- Delete the server-side record on logout, not just the cookie, because clearing a cookie is a client-side suggestion and a captured token keeps working without it.
- Treat remember-me as a separate long-lived credential with its own rotating series identifier, and rotate its value on every use so a stolen copy is detectable when both copies present the same generation.
- Require re-authentication for sensitive changes (email address, password, MFA enrollment, payout details) instead of trusting a long-lived session, because a session that has been alive for weeks proves little about who is holding the laptop now.

Vulnerable:

```typescript
app.post("/login", async (req, res) => {
  const user = await verify(req.body);
  req.session.userId = user.id;   // same session id the visitor arrived with
  res.redirect("/app");
});

app.post("/logout", (req, res) => {
  res.clearCookie("sid");         // record still valid server-side
  res.redirect("/");
});
```

Fixed:

```typescript
app.post("/login", async (req, res) => {
  const user = await verify(req.body);
  await sessions.destroy(req.cookies.sid);        // kill the pre-auth session
  const raw = await sessions.create(user.id);     // fresh identifier
  res.cookie("sid", raw, COOKIE_OPTS);
  res.redirect("/app");
});

app.post("/logout", async (req, res) => {
  await sessions.destroy(req.cookies.sid);        // server-side revocation
  res.clearCookie("sid");
  res.redirect("/");
});
```

## JWT Pitfalls

- Pin the accepted algorithm list at verification time rather than reading `alg` from the token header, because an attacker controls that header and will offer `none` or downgrade RS256 to HS256 and sign with your public key as the HMAC secret.
- Verify `exp`, `nbf`, `iss`, and `aud` explicitly, since a library that only checks the signature happily accepts a valid token minted for a different service or expired last year.
- Keep access-token lifetimes short and pair them with a revocable refresh token, because a stateless JWT cannot be withdrawn and a thirty-day access token is a thirty-day skeleton key.
- Maintain a revocation list keyed by `jti` or a per-user `tokenVersion` claim checked against the database for anything that can ban a user or end a session, because otherwise logout and account suspension are cosmetic.
- Never put secrets or personally identifying data in the payload, since a JWT is base64, not encryption, and anyone holding it can read every claim.

Vulnerable:

```typescript
const claims = jwt.verify(token, PUBLIC_KEY); // algorithm taken from the token header
if (claims.userId) return loadUser(claims.userId);
```

Fixed:

```typescript
const claims = jwt.verify(token, PUBLIC_KEY, {
  algorithms: ["RS256"],            // pinned, so alg=none and HS confusion both fail
  issuer: "https://auth.example.com",
  audience: "api.example.com",
  clockTolerance: 5,
});
const user = await users.find(claims.sub);
if (!user || user.tokenVersion !== claims.tokenVersion) return unauthorized(); // revocable
```

```bash
rg -n 'jwt\.(verify|decode)\(' -A 4 | rg -v 'algorithms|audience|issuer'
rg -n 'decode\(.*verify\s*[:=]\s*(False|false)|verify_signature.*False'
rg -n '"alg"\s*:\s*"none"|algorithm\s*[:=]\s*None'
```

## OAuth and OIDC

- Send a `state` parameter bound to the user's session and reject any callback whose state does not match, because state is the CSRF defense for the redirect and without it an attacker can graft their own authorization code onto a victim's session.
- Use PKCE with `S256` on every authorization-code flow including confidential server-side clients, since a code intercepted in a redirect is useless without the verifier and the cost of adding it is one hash.
- Reject `plain` as a code challenge method, because it transmits the verifier in the clear and provides no protection over the bare code.
- Validate the `nonce` in an OIDC ID token against the value you sent, so a replayed token from another session is rejected.
- Match the redirect URI against an exact registered string, never a prefix or wildcard, because `https://app.example.com.attacker.tld` matches a sloppy prefix check and receives the code.
- Verify the ID token signature against the provider's published keys and confirm `aud` equals your client id, rather than trusting the token because it arrived over TLS from the right host.

```typescript
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
req.session.oauth = { state: randomBytes(16).toString("base64url"), nonce: randomBytes(16).toString("base64url"), verifier };
// on callback:
if (req.query.state !== req.session.oauth?.state) return res.status(400).end(); // constant, non-optional
```

## Second Factors and Recovery Codes

- Rate limit and lock out TOTP verification attempts, because six digits is a one-in-a-million guess per try and unlimited tries make it a matter of minutes.
- Record used TOTP counters and reject replays inside the same time step, since a code observed over the shoulder or captured by a proxy is otherwise valid for its whole window.
- Hash recovery codes with the same password hash function used for passwords, because a recovery code is a password that bypasses the second factor entirely.
- Invalidate a recovery code the instant it is consumed and show the remaining count, so a reused code cannot serve as a permanent backdoor.
- Require the existing second factor (or a fresh password) before disabling MFA or changing the enrolled device, because an unprotected disable endpoint reduces MFA to decoration.
- Treat SMS as a weaker factor and never allow it to silently reset a stronger one, since carrier account takeover is a routine attack.

## Reset, Invite, and Verification Tokens

- Generate reset tokens from the same CSRF-grade entropy source as session identifiers, because a guessable reset token is a password bypass for every account at once.
- Store only the hash of the reset token, so a database read does not hand over live account takeovers.
- Expire reset tokens in minutes rather than days and mark them consumed in the same transaction that changes the password, because a token that survives its use can be replayed from an email archive.
- Invalidate all outstanding reset tokens for a user when any one of them is used or when the password changes, otherwise an attacker-initiated reset stays live behind the victim's own reset.
- Return the same neutral response whether or not the email exists, because the reset form is the second most common enumeration oracle after login.
- Build the reset link from a server-side configured origin, never from the `Host` or `X-Forwarded-Host` header, since a host-header injection mails the victim a link that delivers the token to the attacker.

## Rate Limiting and Credential Stuffing

- Rate limit by account identifier and by source address together, because per-IP limits alone are defeated by a botnet and per-account limits alone let one address spray a million accounts with one guess each.
- Prefer exponential backoff or a soft lock over a hard permanent lock, since an attacker who can lock any account on demand has a denial-of-service primitive.
- Count failures on every credential-checking endpoint including token refresh, MFA verification, and reset submission, because attackers find the one that was left uncounted.
- Check new and changed passwords against a breached-password corpus, because credential stuffing succeeds on reuse and not on brute force.
- Alert on a spike in failed logins spread across many distinct accounts, as that shape is stuffing while repeated failures on one account is usually a confused user.

## Reporting

Report findings in the format defined by `security-audit`: location, vulnerable code, exploit path, impact, fix. Severity follows the same exploitability times blast radius rule, with two authentication-specific calibrations.

- Rate a fast password hash P0 whenever the user table is reachable through any other finding, because the two chain into full credential disclosure across every account.
- Rate an enumeration-only difference P3 on its own and P2 when it is paired with an unlimited-attempt login, since enumeration matters mainly as the input to a stuffing run.

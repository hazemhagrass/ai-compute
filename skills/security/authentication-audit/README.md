# Authentication Audit

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="authentication-audit robot" width="200">
</div>

A review procedure for the code that proves who a caller is: password storage, session artifacts, JWT validation, federated login, second factors, and every recovery path around them.

## What it does

This skill walks the identity lifecycle in a fixed order and tells you what to look for at each stage, with the reason each rule exists attached to the rule itself.

The order it enforces:

1. Password storage, meaning the hash function and its cost parameters.
2. Credential comparison, meaning timing safety, enumeration, and lockout behaviour.
3. The session artifact, meaning entropy, transport, and where the token lives.
4. The session lifecycle, meaning fixation, rotation, logout, and remember-me.
5. Token formats, meaning JWT claim validation and revocation.
6. Federated flows, meaning OAuth and OIDC state, PKCE, and nonce.
7. Second factors and their recovery codes.
8. Reset, invite, and verification tokens.

Each stage ships with imperative rules, paired vulnerable and fixed TypeScript examples, and ripgrep patterns that surface the usual offenders across a codebase.

It deliberately stops at the boundary of authorization. Whether a proven identity may read a particular row belongs to the `security-audit` skill, which covers object-level and tenant-level access control, injection, secret handling, SSRF, deserialization, and dependency advisories. Run both: this one checks that the session is real, that one checks what the session is allowed to touch.

## When to use this

Reach for it when:

- A login, signup, or password reset flow is being added or changed.
- You are reviewing a pull request that touches session creation, cookie options, or token verification.
- A service is adopting JWTs, or migrating from server-side sessions to stateless tokens.
- Single sign-on is being wired up through OAuth or OIDC and you need the state and PKCE checks to be right before it ships.
- Multi-factor authentication or recovery codes are being introduced.
- An incident, a penetration test finding, or a compliance question points at the auth path.
- You inherited a codebase and want to know what the credential handling actually does before trusting it.

Skip it when the question is "can this authenticated user see this record". That is authorization, and the wrong skill will send you hunting in the wrong files.

## Quick start

Load the skill and work the sections top to bottom. If you only have time for one section, do password storage, because it is the only defect that stays exploitable offline after every other control is fixed.

Find the hashing call and check what function it uses:

```bash
rg -n 'createHash\(.(md5|sha1|sha256|sha512)|hashlib\.(md5|sha1|sha256)' -A 3 \
  | rg -i 'password|passwd|credential'
rg -n 'bcrypt\.hash\(|scrypt|argon2' -A 2
```

Find tokens generated from a predictable source:

```bash
rg -n 'Math\.random|uuid\(\)|Date\.now\(\)' -B 2 -A 2 \
  | rg -i 'session|token|reset|invite'
```

Find cookies missing the flags that keep a token out of JavaScript:

```bash
rg -n 'cookie\(|set_cookie|SetCookie' -A 3 | rg -v 'httpOnly|HttpOnly'
```

Find JWT verification that trusts the token's own header:

```bash
rg -n 'jwt\.(verify|decode)\(' -A 4 | rg -v 'algorithms|audience|issuer'
rg -n 'decode\(.*verify\s*[:=]\s*(False|false)|verify_signature.*False'
```

Find session identifiers that are never rotated after login:

```bash
rg -n 'session\.(userId|user_id)\s*=|login_user\(|req\.session\.user' -B 4 -A 4 \
  | rg -v 'regenerate|destroy|rotate|cycleKey'
```

Find logout handlers that only touch the client:

```bash
rg -n '(logout|sign_?out)' -A 8 | rg -i 'clearCookie|delete_cookie' \
  | rg -v 'destroy|revoke|invalidate'
```

Find OAuth callbacks with no state comparison:

```bash
rg -n '(callback|oauth2?/redirect)' -A 12 | rg -v 'state'
rg -n 'code_challenge_method' -A 1 | rg -i 'plain'
```

Then read each hit in context. A grep hit is a place to look, not a finding. Write findings up in the format `security-audit` defines: location, vulnerable code, exploit path, impact, fix.

A short triage pass, in the order worth spending a limited hour on:

1. Identify the password hash function and its parameters. Anything fast is the headline finding.
2. Read the failed-login response and compare it byte for byte with the unknown-user response.
3. Read the session cookie options and the session creation path, checking for rotation at login.
4. Read every JWT verification call and confirm the algorithm list is pinned and the claims are checked.
5. Read the password reset flow end to end, from request through consumption.

If all five look right, the remaining sections are hardening rather than triage, and can be worked at normal pace.

## Key concepts

**A password hash should be slow on purpose.** SHA-256 is an excellent hash and a terrible password hash, because a GPU computes billions of them per second. Argon2id, scrypt, and bcrypt are built to cost real memory and real time per guess, which is what makes a stolen user table economically useless. A salt only defeats precomputed rainbow tables; it does nothing against a targeted dictionary run at GPU speed.

**Equality comparison leaks.** The `===` operator returns as soon as two bytes differ, so the time it takes reveals how much of a secret you guessed correctly. Constant-time comparison removes that signal. The same principle applies at the flow level: skipping the expensive hash when the username does not exist turns response latency into a free user-existence oracle.

**Enumeration is the input to credential stuffing.** Different error text, different status codes, or different response times between "no such user" and "wrong password" hand an attacker a verified list of your customers. That list is what gets fed into a stuffing run against reused passwords. Neutral responses on login, signup, and password reset close the oracle.

**Session fixation.** If the identifier a user carries after logging in is the same one they carried before, anyone who could plant a known value now holds an authenticated session without ever knowing a password. Rotating the identifier at every privilege change (login, step-up MFA, role elevation, password change) is the fix, and the old server-side record must be destroyed rather than left valid alongside the new one.

**A JWT cannot be un-issued.** Signature verification is stateless by design, which is exactly why logout and account suspension become cosmetic unless you add revocation: short access-token lifetimes backed by a revocable refresh token, plus a `jti` denylist or a per-user `tokenVersion` claim checked against the database. And because the `alg` header travels inside the token, the attacker chooses it unless you pin the accepted list at verification.

**State and PKCE do different jobs.** The `state` parameter is CSRF protection for the redirect: it binds the callback to the browser session that started the flow, so an attacker cannot graft their own authorization code onto a victim's session. PKCE protects the code itself: a code intercepted in transit is worthless without the verifier. Confidential server-side clients need both, not one.

**Recovery paths are login paths.** Password reset, MFA recovery codes, and account-verification links all mint authenticated access. They deserve the same entropy, the same hashing at rest, the same rate limiting, and stricter expiry than the primary flow, because attackers pick the weakest of the available front doors and it is rarely the one with the password field.

**Logout is a server-side operation.** Clearing a cookie is a suggestion to a client that may ignore it, and a token captured earlier keeps working regardless. Deleting or marking the server-side record is what actually ends a session.

**Entropy has a threshold, not a spectrum.** A session identifier needs at least 128 bits from a cryptographically secure generator. A UUIDv4 has 122 bits of randomness and is acceptable only when it actually comes from a secure source; a UUIDv1 encodes a timestamp and a MAC address and is guessable. `Math.random` is a statistical generator, not a cryptographic one, and its internal state can be recovered from a handful of outputs.

**Tokens at rest deserve the same care as passwords.** Session tokens, reset tokens, and API keys should be stored as hashes, so that a read-only database leak yields nothing replayable. Because these values are already high-entropy, a single fast hash is correct here: the expensive password hash exists to compensate for low-entropy human input, which does not apply to 256 random bits.

**Rate limiting needs two keys.** Per-address limits stop one machine hammering one account and nothing else; a botnet routes around them. Per-account limits stop a single account being brute forced and nothing else; one guess against a million accounts never trips them. Credential stuffing lives in the gap between the two, which is why both dimensions have to be counted.

**Re-authentication is separate from authentication.** A session that has been alive for three weeks proves someone logged in three weeks ago. It says nothing about who holds the device now. Sensitive changes (password, email, MFA enrollment, payout details) should demand a fresh proof rather than riding on an old one.

## Common pitfalls

- **Salting a fast hash and calling it done.** The salt stops rainbow tables. It does not slow anything down, and speed is the whole attack.
- **Leaving the cost parameters at a default from a decade ago.** Hardware moved; the parameters did not. Re-hash on successful login when stored parameters fall below current policy, since that is the only moment the plaintext exists to upgrade with.
- **Letting bcrypt silently truncate.** Past 72 bytes bcrypt ignores the rest, so a long passphrase can be far weaker than the user believes. Cap and validate the length explicitly.
- **Returning 404 on an unknown email at login.** It is a helpful message and a complete customer list.
- **Storing the session token in `localStorage`.** Any injected script reads it, and it outlives the page that leaked it. Use an `HttpOnly`, `Secure`, `SameSite` cookie.
- **Putting a token in a URL.** It ends up in server logs, proxy logs, browser history, and the `Referer` header of every outbound link on the page.
- **Idle timeout with no absolute lifetime.** A stolen token stays alive forever behind a script that pings once a minute.
- **Trusting the JWT `alg` header.** The attacker writes that header. Expect `none` and an RS256-to-HS256 downgrade signed with your public key.
- **Verifying the signature and nothing else.** Without explicit `exp`, `nbf`, `iss`, and `aud` checks you will accept tokens minted for a different service, or ones that expired last year.
- **Treating `state` as optional when the library makes it optional.** Missing state is a working session-graft attack, not a lint warning.
- **Prefix-matching the OAuth redirect URI.** `https://app.example.com.attacker.tld` matches a prefix check and receives the authorization code. Match the exact registered string.
- **Storing recovery codes in plaintext.** They are passwords that skip the second factor, and they belong in the same hash function as passwords.
- **Reusable recovery codes.** Mark consumed in the same transaction that grants access, otherwise one leaked code is a permanent backdoor.
- **Disabling MFA without re-authentication.** An unprotected disable endpoint reduces the whole second factor to decoration.
- **Unlimited TOTP attempts.** Six digits is a one-in-a-million guess, and unlimited guesses make that minutes of work.
- **Reset tokens that live for days.** Minutes is enough, and an email archive is not a secure store.
- **Reset links built from the `Host` header.** Host-header injection mails the victim a link that delivers their token to the attacker. Build the origin from server-side configuration.
- **Leaving old reset tokens valid after one is used.** An attacker-initiated reset then survives behind the victim's own reset.
- **Rate limiting by IP alone.** A botnet defeats it. Limit by account identifier too, and count failures on refresh, MFA, and reset endpoints as well as login.
- **Hard permanent account locks.** An attacker who can lock any account on demand has a denial-of-service primitive. Prefer exponential backoff or a soft lock.
- **Clearing the cookie and calling it logout.** The server-side record is still valid.
- **Not evicting other sessions on password change.** Changing the password is the standard advice after a compromise, and it must actually remove the intruder.

## See also

- [security-audit](../security-audit/README.md) for authorization, injection, secret handling, SSRF, deserialization, dependency advisories, severity triage, and the finding report format this skill reuses.
- [api-design](../../engineering/api-design/README.md) for the 401 versus 403 distinction, neutral error bodies with stable machine-readable codes, and the write-once treatment of secrets in responses.
- [api-integration](../../engineering/api-integration/README.md) for handling third-party credentials, token refresh, and retry behaviour on the client side of an authenticated call.
- [code-review](../../engineering/code-review/README.md) for folding these checks into a normal pull request review rather than a separate audit pass.

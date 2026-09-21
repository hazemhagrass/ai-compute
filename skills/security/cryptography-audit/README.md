# Cryptography Audit

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="cryptography-audit robot" width="200">
</div>

A skill for auditing how application code *uses* cryptographic libraries, since almost nobody should be implementing primitives and almost every real defect is a parameter, a mode, a nonce, or a comparison.

## What it does

`SKILL.md` gives an agent a triage order for crypto review, the grep patterns
that surface each defect class, vulnerable/fixed Python pairs using the
`cryptography` package, and calibration notes for reporting severity.

The triage order is:

1. Unauthenticated encryption (no MAC, no AEAD)
2. Nonce and IV handling
3. Mode selection (ECB above all)
4. Key material: source, derivation, storage, separation
5. Randomness source
6. Hash and signature primitive choice
7. Transport: certificate and hostname verification
8. Comparison and error-handling side channels
9. Algorithm agility and rotation

Authentication comes before confidentiality in that list because a forged
ciphertext is worse than a slightly weak hash, and because missing
authentication is the most common crypto finding in application code.

The skill also tells you what *not* to report. A primitive-name finding with no
path to impact ("uses MD5" against a cache key) burns the reader's attention and
makes them skim the real items further down.

## When to use this

Concrete triggers:

- A diff introduces a call to a cipher, hash, HMAC, or KDF API.
- Someone claims a field, column, or file "is encrypted" and you need to know
  whether it is also authenticated.
- A new token, invite code, reset link, or session id generator is added.
- An outbound HTTP, SMTP, database, or broker client gets a TLS option changed.
- A webhook signing or verification path is written or refactored.
- A key rotation is planned and you need to know whether stored ciphertext is
  self-describing enough to rotate at all.
- A secret is being moved out of source into a secrets manager.

Do not run this first on a general security review. `../security-audit/` orders
work by real-world frequency and puts cryptography last on purpose, because a
missing tenant filter leaks more data than a questionable cipher mode. Come here
once the code in scope actually touches a crypto API.

## Quick start

Find the crypto in a Python service, then judge each hit.

```bash
cd services/api

rg -n 'Cipher\(|AES\.new|AESGCM|Fernet\('
rg -n 'modes\.(ECB|CBC|CTR|GCM)|MODE_(ECB|CBC|CTR|GCM)'
rg -n 'random\.random|random\.randint|random\.choice'
rg -n 'verify=False|CERT_NONE|check_hostname'
rg -n '==\s*(signature|mac|token|digest)|compare_digest'
```

Sample hit:

```
src/crypto/fields.py:14:    enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
```

Read it in context:

```python
def encrypt_field(key: bytes, value: bytes) -> bytes:
    enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
    return enc.update(pad(value)) + enc.finalize()
```

Two findings in three lines: ECB leaks block equality, and there is no
authentication, so the stored blob is malleable. Demonstrate the first one
rather than asserting it:

```python
>>> encrypt_field(key, b"A"*16 + b"B"*16 + b"A"*16)[:16] == \
...     encrypt_field(key, b"A"*16 + b"B"*16 + b"A"*16)[32:48]
True   # identical plaintext blocks, identical ciphertext blocks
```

The fix is AEAD with a fresh nonce and context binding:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

HEADER = b"\x01"            # scheme version 1: AES-256-GCM

def encrypt_field(key_id: str, key: bytes, value: bytes, row_id: str) -> bytes:
    nonce = os.urandom(12)                       # fresh per message
    aad = HEADER + key_id.encode() + b"|" + row_id.encode()
    return aad + b"|" + nonce + AESGCM(key).encrypt(nonce, value, aad)
```

Next, check that the nonce is never a constant:

```bash
rg -n 'AESGCM|modes\.(CTR|GCM)' -B 4 | rg -v 'urandom|token_bytes|randbytes'
```

Then the verification path, which is where timing leaks live:

```python
# Bad: short-circuiting compare, plus a distinguishable length error.
if len(sig) != len(expected):
    raise BadRequest("signature length wrong")
return sig == expected

# Good: constant time, one uniform failure.
return hmac.compare_digest(sig, expected)
```

Then the transport switches across every client, not just the main one:

```bash
rg -n 'verify=False|InsecureSkipVerify|rejectUnauthorized\s*:\s*false|CERT_NONE'
```

Write findings in the format from `../security-audit/`, with the impact stated
concretely (plaintext recovery, tag forgery, endpoint impersonation) instead of
naming the rule that was broken.

## Key concepts

**Audit use, not primitives.** Assume AES and SHA-256 are correct. The bugs are
in the mode, the nonce, the key source, and the comparison.

**Encryption is not integrity.** CBC and CTR ciphertexts are malleable. Flipping
a ciphertext bit under CTR flips exactly the matching plaintext bit. Use an AEAD
mode, or encrypt-then-MAC with the MAC covering the IV and any version header.

**Nonce reuse under GCM is catastrophic, not merely leaky.** Repeating a nonce
under one key exposes both plaintexts via the shared keystream *and* the GHASH
authentication subkey, which lets an attacker forge valid tags for messages of
their own choosing under that key.

**ECB leaks structure.** Each block is encrypted independently under the same
key, so identical plaintext blocks produce identical ciphertext blocks and whole
blocks can be cut and pasted between messages.

**Judge the hash by its job.** MD5 and SHA-1 are disqualifying for signatures,
certificates, and artifact integrity, where practical collision attacks exist.
They are fine for ETags, cache keys, and shard selection. Reporting the latter
teaches readers to skim.

**A plain hash is not a MAC.** `hash(secret || message)` on a Merkle-Damgard
construction is length-extendable: an attacker with one valid tag can append
data and compute a valid tag without the secret. Use HMAC.

**Passwords are a KDF question, not a cipher question.** Fast hashes are fast
for the attacker too. Argon2id, scrypt, or bcrypt with tuned cost parameters,
per the authentication and password-storage guidance rather than this skill.

**Predictable is the same as public.** `random`, `Math.random`, and `rand()` are
deterministic generators whose state is recoverable from a modest run of output.
A time-seeded token has a search space of seconds. Use the CSPRNG.

**Keys need a source, a purpose, and an id.** Never a raw passphrase, never a
literal in source. Derive per-purpose subkeys with HKDF so one leak does not
compromise every subsystem, and store a key id with every ciphertext so
rotation is possible.

**Disabled verification makes TLS passive-only.** `verify=False` and friends
still encrypt against an eavesdropper, but hand an active attacker full
impersonation. For a private CA, point at the CA bundle rather than disabling
the check.

**Oracles are behavioural differences.** A padding oracle decrypts CBC one byte
at a time when padding failures look different from other failures. A
short-circuiting `==` on a MAC leaks the length of the correct prefix. Uniform
errors and constant-time comparison close both.

**Unversioned ciphertext cannot be rotated.** A version byte and a key id in the
envelope are what make a compromised key or a broken primitive survivable.

## Common pitfalls

**Calling CBC "encrypted" and stopping there.**

```python
# Bad: confidential but malleable, and the IV is unauthenticated.
return iv + Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor().update(pad(pt))

# Good: AEAD, tampering anywhere fails decryption.
return nonce + AESGCM(key).encrypt(nonce, pt, aad)
```

**A module-level nonce constant.**

```python
# Bad: every message shares a keystream; GCM's auth subkey falls out.
NONCE = b"000000000000"

# Good: fresh per message, stored with the ciphertext.
nonce = os.urandom(12)
```

**A counter nonce that can roll back.** A restored snapshot, a redeployed
replica, or a reset in-memory counter replays nonces already used under the same
key. Either give the counter a single durable writer, or use random nonces, or
use a nonce-misuse-resistant mode such as AES-SIV.

**Defending ECB with "the value is short".** A single-block value under ECB is a
deterministic lookup table over the plaintext space, which is worse, not better.

**Using a passphrase as a key.**

```python
# Bad: no salt, no KDF, entropy far below 256 bits.
key = hashlib.sha256(passphrase.encode()).digest()

# Good: memory-hard KDF with a per-target random salt.
key = Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(passphrase.encode())
```

**One key for everything.** Session tokens, field encryption, webhook signing,
and backups sharing a key means one leak compromises all four. Derive
per-purpose subkeys with HKDF from a single root.

**Building a token character by character.**

```python
# Bad: predictable generator, clock seed, tiny search space.
random.seed(int(time.time()))
token = "".join(random.choice(ALPHABET) for _ in range(12))

# Good: CSPRNG, 256 bits.
token = secrets.token_urlsafe(32)
```

**Disabling verification to make a self-signed cert work.**

```python
# Bad: TLS now stops only passive observers.
requests.post(url, json=body, verify=False)

# Good: verify against the internal CA.
requests.post(url, json=body, verify="/etc/ssl/internal-ca.pem")
```

**Distinguishing decryption failures in the response.** A padding error that
differs from an auth error, by status code, message text, or latency, is the
oracle. Return one identical error and log the cause server-side only.

**Comparing secrets with `==`.** This covers MACs, signatures, API keys, reset
tokens, and TOTP codes, and also the sneaky variants: a database lookup keyed by
a raw token, or an early `return` inside a per-character loop.

**Writing raw ciphertext with no envelope.** Without a version byte and a key
id, rotation becomes guesswork over every stored blob. Fail closed on an unknown
version rather than assuming a default, since guessing turns a rollout bug into
a silent downgrade.

**Reporting the primitive instead of the impact.** "Uses SHA-1" is a rule
citation. "The webhook signature is forgeable, so any caller can post a
synthetic payment event" is a finding.

## See also

- `SKILL.md` in this directory for the full triage order, grep patterns, code
  pairs, and reporting calibration.
- `../security-audit/` for the frequency-ordered application security pass, the
  severity rubric, and the finding template this skill reuses.
- `../../engineering/api-design/` for webhook signing and token handling at the
  interface boundary.
- `../../engineering/code-review/` for the general correctness pass, which runs
  separately from this one.

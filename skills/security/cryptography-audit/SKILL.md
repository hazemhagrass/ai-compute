---
name: cryptography-audit
description: "Use when code calls a crypto API. Audit use, not math. Finds nonce reuse, ECB, unauthenticated ciphertext, weak randomness, timing leaks."
---

# Cryptography Audit

Almost nobody should implement a cryptographic primitive. Assume the primitives in
the standard library are correct and audit how the application *uses* them. The
real defects are parameter choices, missing authentication, reused nonces, and
comparisons that leak through timing.

Run this after the frequency-ordered pass in `../security-audit/`. That skill puts
cryptography last on purpose: a missing tenant filter leaks more data than a
questionable cipher mode. Reach for this skill when the code actually touches a
crypto API, or when a review comment claims something "is encrypted".

Examples use Python and the `cryptography` package throughout, so the vulnerable
and fixed pairs stay comparable.

## Triage Order

1. Unauthenticated encryption (no MAC, no AEAD)
2. Nonce and IV handling
3. Mode selection (ECB above all)
4. Key material: source, derivation, storage, separation
5. Randomness source
6. Hash and signature primitive choice
7. Transport: certificate and hostname verification
8. Comparison and error-handling side channels
9. Algorithm agility and rotation

- Work this order because a forged ciphertext is worse than a slightly weak hash, and authentication gaps are the most common finding in application code.
- Stop and report at any step rather than finishing the list, since one confirmed nonce reuse justifies a release block on its own.

## Find The Crypto First

```bash
rg -n 'Cipher\(|AES\.new|createCipher|EVP_|algorithms\.AES|Fernet\('
rg -n 'modes\.(ECB|CBC|CTR|GCM)|MODE_(ECB|CBC|CTR|GCM)'
rg -n 'hashlib\.(md5|sha1)|MD5|SHA1|sha1\(|md5\('
rg -n 'random\.random|random\.randint|Math\.random|mt_rand|rand\(\)'
rg -n 'verify=False|check_hostname|CERT_NONE|InsecureSkipVerify|rejectUnauthorized'
rg -n 'hmac|compare_digest|==\s*(signature|mac|token|digest)'
rg -n 'PBKDF2|scrypt|argon2|HKDF|derive_key'
```

- Grep for the mode constants, not just the cipher name, because `AES` alone says nothing about whether the construction is safe.
- Search test fixtures and migration scripts too, since a hardcoded key in a "temporary" backfill script outlives the backfill.

## Unauthenticated Encryption

Encryption without authentication hides the plaintext but does not stop an
attacker from *changing* it. CBC and CTR ciphertexts are malleable: flipping a
ciphertext bit in CTR flips exactly the matching plaintext bit, and in CBC it
flips the matching bit of the next block while scrambling the current one.

- Require an AEAD mode (AES-GCM, ChaCha20-Poly1305, AES-SIV) or explicit encrypt-then-MAC for every ciphertext, because a decryption that cannot fail on tampering will happily decrypt attacker-chosen garbage.
- Reject MAC-then-encrypt and encrypt-and-MAC constructions, since only encrypt-then-MAC lets you reject a forged ciphertext without first processing attacker-controlled plaintext.
- Compute the MAC over the IV and any version header as well as the ciphertext, because an unauthenticated IV is attacker-controlled input to the first block.
- Bind context with AEAD associated data (record id, tenant id, purpose) so a valid ciphertext cannot be replayed into a different row or a different user's record.

```python
# Vulnerable: confidentiality only. Ciphertext is malleable and the IV is
# unauthenticated, so an attacker can flip plaintext bits at will.
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

def encrypt(key: bytes, plaintext: bytes) -> bytes:
    iv = os.urandom(16)
    enc = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return iv + enc.update(pad(plaintext)) + enc.finalize()
```

```python
# Fixed: AEAD. Tampering anywhere (nonce, ciphertext, aad) fails decryption.
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt(key: bytes, plaintext: bytes, record_id: str) -> bytes:
    nonce = os.urandom(12)                      # fresh per message
    aad = record_id.encode()                    # binds ciphertext to its row
    return nonce + AESGCM(key).encrypt(nonce, plaintext, aad)
```

## Nonce And IV Reuse

This is the highest-severity finding in the list because the failure is total and
silent. Nothing in the code breaks when a nonce repeats.

- Never reuse a nonce with a stream construction (CTR, GCM, ChaCha20) under the same key: both messages are encrypted with the identical keystream, so XORing the two ciphertexts yields the XOR of the two plaintexts and cancels the key entirely.
- Treat GCM nonce reuse as catastrophic rather than merely confidentiality-breaking, because repeating a nonce under one key exposes the GHASH authentication subkey, letting an attacker forge valid tags for messages they choose under that key.
- Generate GCM nonces as 12 random bytes per message, or as a strictly increasing counter owned by a single writer, since 96 bits is the size GCM uses natively without rehashing.
- Cap the number of messages under one random-nonce key and rotate, because random 96-bit nonces collide at birthday-bound probability and the bound is reachable at high message volume.
- Require CBC IVs to be unpredictable and fresh, not merely unique, since a predictable IV lets an attacker confirm guesses about the plaintext of a chosen block.
- Flag any nonce derived from a counter stored in application state that can roll back (a restored snapshot, a redeployed replica, a reset in-memory counter), because rollback reuses nonces.
- Use AES-SIV or another nonce-misuse-resistant mode when a unique nonce cannot be guaranteed by design, accepting that it leaks only plaintext equality.

```python
# Vulnerable: one nonce baked into the module. Every message under this key
# shares a keystream, and GCM's authentication key is recoverable.
NONCE = b"000000000000"

def seal(key: bytes, pt: bytes) -> bytes:
    return NONCE + AESGCM(key).encrypt(NONCE, pt, None)
```

```python
# Fixed: fresh CSPRNG nonce per message, stored alongside the ciphertext.
def seal(key: bytes, pt: bytes) -> bytes:
    nonce = os.urandom(12)
    return nonce + AESGCM(key).encrypt(nonce, pt, None)
```

```bash
rg -n 'nonce\s*=\s*b?["\x27]|IV\s*=\s*b?["\x27]|iv\s*=\s*bytes\(1[26]\)'
rg -n 'modes\.(CTR|GCM)|AESGCM|ChaCha20' -B 4 | rg -v 'urandom|token_bytes|randbytes'
```

## ECB Mode

ECB encrypts each block independently under the same key with no chaining, so
identical plaintext blocks always produce identical ciphertext blocks.

- Reject ECB for any data with structure, because block-level equality survives encryption: repeated fields, padding patterns, and image regions remain visible in the ciphertext, and an attacker can cut and paste whole blocks between messages.
- Do not accept "the data is short" as a defense, since a value that fits in one block is then a deterministic lookup table over the plaintext space.
- Watch for defaults: some libraries select ECB when no mode is passed, so a call with no mode argument deserves the same finding as an explicit `MODE_ECB`.

```python
# Vulnerable: repeated plaintext blocks map to repeated ciphertext blocks.
enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
blob = enc.update(pad(record)) + enc.finalize()
```

```python
# Fixed: AEAD, fresh nonce, no block-equality leak.
nonce = os.urandom(12)
blob = nonce + AESGCM(key).encrypt(nonce, record, None)
```

## Hash And Signature Choice

- Reject MD5 and SHA-1 anywhere a collision matters (signatures, certificates, commit or artifact integrity, deduplication used as a trust decision), because practical collision and chosen-prefix collision attacks exist for both.
- Leave MD5 and SHA-1 alone when the use is non-cryptographic: ETags, cache keys, shard selection, non-adversarial checksums. Reporting those wastes the reader's attention and trains them to skim real findings.
- Judge the use, not the name: an HMAC built on SHA-1 resists the published collision attacks, but still flag it as migration debt rather than an exploit.
- Prefer SHA-256 or SHA-512 for new integrity and signature work, since they carry no known practical collision attack and cost little more.
- Never use a plain hash as a message authentication code, because `hash(secret || message)` on a Merkle-Damgard construction is extendable: an attacker who sees one valid tag can append data and compute a valid tag for the longer message without knowing the secret. Use HMAC.

```python
# Vulnerable: secret-prefix hash as a MAC, length-extendable.
sig = hashlib.sha256(secret + payload).hexdigest()
```

```python
# Fixed: HMAC, and a constant-time check on the verify side.
sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
```

## Passwords Are Not A Hashing Question Here

- Flag any password stored under a fast hash (MD5, SHA-1, SHA-256, plain or salted) and hand it to the authentication and password-storage guidance rather than restating the argument here, because the fix is a memory-hard KDF choice with tuned parameters, not a cipher decision.
- The one-line rule for the audit report: fast hashes are designed to be fast, so an attacker with the dump gets the same speedup you do. Argon2id, scrypt, or bcrypt with tuned cost parameters is the answer.

## Randomness

- Replace `random`, `Math.random`, `rand()`, and `mt_rand()` in any security context, because they are deterministic generators whose internal state is recoverable from a modest run of outputs, which lets an attacker predict every subsequent value.
- Treat time-seeded generation as guessable outright, since a token seeded from the current second has a search space of seconds, not bits.
- Use the CSPRNG for keys, IVs, nonces, session ids, password reset tokens, invite codes, CSRF tokens, and anything an attacker profits from guessing.
- Require at least 128 bits of entropy for a token that stands alone as a credential, and generate it as bytes rather than by sampling characters in a loop.

```python
# Vulnerable: predictable generator, and the seed is the clock.
import random, time
random.seed(int(time.time()))
reset_token = "".join(random.choice(ALPHABET) for _ in range(12))
```

```python
# Fixed: CSPRNG, 256 bits, URL-safe.
import secrets
reset_token = secrets.token_urlsafe(32)
```

## Key Material

- Reject keys hardcoded in source, committed config, or container images, because the key's blast radius becomes every place the repository or image has ever been copied.
- Never use a password or passphrase directly as a key: pass it through a KDF (Argon2id, scrypt, or PBKDF2 with a high iteration count) with a per-target random salt, since a raw passphrase has far less entropy than the key length suggests and is trivially brute-forced.
- Separate keys by purpose (session tokens, field encryption, webhook signing, backup encryption) so one leaked key does not compromise every subsystem, and derive per-purpose subkeys with HKDF from one root when operationally simpler.
- Load keys from a secrets manager or injected environment at startup, and keep them out of logs, crash dumps, and error bodies.
- Store a key identifier with every ciphertext, because rotation is impossible if you cannot tell which key produced which blob.

```python
# Vulnerable: passphrase used directly as key material, no salt, no KDF.
key = hashlib.sha256(b"correct horse battery staple").digest()
```

```python
# Fixed: derive per-purpose subkeys from a root key held in the secrets manager.
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

def subkey(root: bytes, purpose: str) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32,
                salt=None, info=purpose.encode()).derive(root)

field_key = subkey(ROOT_KEY, "field-encryption.v1")
webhook_key = subkey(ROOT_KEY, "webhook-signing.v1")
```

## Certificate And Hostname Verification

- Flag every `verify=False`, `CERT_NONE`, `check_hostname=False`, `InsecureSkipVerify: true`, and `rejectUnauthorized: false`, because each one turns TLS into encryption against a passive observer only and leaves an active attacker free to impersonate the endpoint.
- Reject certificate validation with hostname checking disabled as equally broken, since any certificate from any trusted CA for any domain then passes.
- Replace a disabled check for a private or self-signed CA with an explicit trust store or pinned CA bundle, so the internal endpoint is verified rather than unverified.
- Check the whole outbound surface, not just the main HTTP client: webhook senders, SMTP, database drivers, message brokers, and scrapers each carry their own TLS switch.

```python
# Vulnerable: any active attacker can present any certificate.
r = requests.post(url, json=payload, verify=False)
```

```python
# Fixed: verify against the internal CA bundle instead of disabling the check.
r = requests.post(url, json=payload, verify="/etc/ssl/internal-ca.pem")
```

## Oracles: Padding And Timing

A padding oracle decrypts CBC ciphertext without the key, one byte at a time,
when the server behaves differently for a padding failure than for an
authentication or parse failure.

- Return one identical error for every decryption failure, and log the specific cause server-side only, because any observable difference (status code, message text, response latency) is the oracle.
- Verify the MAC before touching padding, or use AEAD, so a tampered ciphertext is rejected before any padding logic runs.
- Compare MACs, signatures, API keys, reset tokens, and TOTP codes with a constant-time function, since `==` short-circuits on the first mismatching byte and the response time reveals the length of the correct prefix, letting an attacker recover the value byte by byte.
- Look past the obvious comparison: a database lookup keyed by a raw token, an early `return` inside a per-character loop, and string slicing all reintroduce the same leak.

```python
# Vulnerable: distinguishable errors plus a short-circuiting comparison.
def verify(payload: bytes, sig: str) -> bool:
    expected = hmac.new(KEY, payload, hashlib.sha256).hexdigest()
    if len(sig) != len(expected):
        raise BadRequest("signature length wrong")   # oracle
    return sig == expected                            # timing leak
```

```python
# Fixed: constant-time compare, one uniform failure.
def verify(payload: bytes, sig: str) -> bool:
    expected = hmac.new(KEY, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)
```

## Algorithm Agility And Rotation

- Prefix every ciphertext with a version byte and a key id, because a scheme you cannot identify is a scheme you cannot rotate, and rotation is the only response to a compromised key or a broken primitive.
- Keep decryption able to read old versions while encryption only ever writes the current one, so migration is a background re-encrypt rather than a flag day.
- Fail closed on an unknown version rather than guessing a default, since guessing turns a rollout bug into a silent downgrade.
- Record key creation time and a rotation interval, because a key with no expiry is a key that lives until the incident.

```python
# Vulnerable: raw ciphertext, no version, no key id. Rotation requires
# guessing which scheme produced each stored blob.
blob = nonce + AESGCM(key).encrypt(nonce, pt, None)
```

```python
# Fixed: self-describing envelope, authenticated as associated data.
HEADER = b"\x01"            # scheme version 1: AES-256-GCM

def seal(key_id: str, key: bytes, pt: bytes) -> bytes:
    nonce = os.urandom(12)
    aad = HEADER + key_id.encode()
    return aad + b"|" + nonce + AESGCM(key).encrypt(nonce, pt, aad)
```

## Reporting

Use the finding format and the severity rubric from `../security-audit/`. Two
calibration notes specific to cryptography:

- Rate nonce reuse, ECB on structured data, and a disabled certificate check at the severity their real impact earns, and write the impact concretely (plaintext recovery, tag forgery, full impersonation of the endpoint) rather than citing the rule that was broken.
- Downgrade or drop primitive-name findings with no path to impact, because "uses MD5" against a cache key is the fastest way to make a reader stop reading the rest of the report.

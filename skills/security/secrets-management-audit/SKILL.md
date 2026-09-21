---
name: secrets-management-audit
description: "Use when auditing secrets. Cover the full leak lifecycle: history scanning, rotate-then-purge, CI and image leakage, secret managers, rotation cadence, and pre-commit prevention."
---

# Secrets Management Audit

`../security-audit/` covers secrets as one class inside a code review: storage in source, logging on the auth path, upstream 401 error echo, gitignore gaps. That is the code-reading slice. This skill is the lifecycle: how a credential got into the repo, how it is revoked and purged, where it leaks outside source control, how it is stored, and how it is rotated without an outage. Read that section for its grep patterns rather than re-deriving them here.

## Order of Work

1. Inventory: what secrets exist and which system each one opens.
2. Exposure: working tree, git history, CI logs, image layers, runtime.
3. Containment: rotate first, then purge, then verify revocation.
4. Storage: where secrets live at rest and who can read them.
5. Lifetime and scope: short-lived over long-lived, least privilege.
6. Prevention: pre-commit hooks, CI gates, log redaction.

- Finish steps 1 and 2 before any remediation, because purging a key you have not inventoried leaves its twin live in a config file you never read.
- Treat an exposed secret as compromised from the moment of exposure, not of discovery, since clones and forks carry it silently.

## Inventory Before Scanning

A scanner finds strings. An inventory finds systems. The question is never "is there a token in the repo", it is "what does that token open".

- Record for every secret the system it authenticates to, its scope, owner, expiry, and canonical location, because you cannot rotate a credential whose owning system you cannot name.
- Flag any secret with no named owner as top priority, since an unowned credential is one nobody will rotate after the audit ends.

## Scan History, Not Just the Working Tree

Deleting a secret from a file and committing the deletion changes nothing. Git stores content as immutable blob objects keyed by hash. The commit that added the key still contains it, the blob stays reachable from that commit, and `git show <sha>`, every existing clone, and every fork still serve it. Absence from `HEAD` is cosmetic.

- Scan full history rather than `HEAD`, because a "removed" secret is still a reachable object in every clone.
- Scan every ref including tags and remote branches, and scan forks and mirrors separately, since a deleted branch tip stays reachable through a stale ref and a purge on the origin rewrites nobody else's copy.

```bash
# Bad: proves only that HEAD is clean.
rg -n 'AKIA[0-9A-Z]{16}' .
# Good: walk every object on every ref, then confirm reachability.
gitleaks detect --source . --log-opts="--all --full-history" --report-format json
trufflehog git file://. --only-verified --json
git rev-list --all --objects | grep 'config/prod.env'
```

## Rotate First, Then Purge

The order is not a preference. Purging history is slow and incomplete: forks, mirrors, CI caches, backups, and developer clones keep the old objects. Rotation is fast and total, because once the issuer revokes the credential every copy everywhere becomes worthless at the same instant. Purging first spends hours rewriting history while the live key still authenticates.

1. Revoke or rotate at the issuing system.
2. Deploy the replacement and confirm the service works on the new value.
3. Confirm the issuer now rejects the old value.
4. Purge history, so the next scanner does not re-report it.
5. Force push, tell clone holders to re-clone, and ask the platform to expire stale refs and pull request snapshots.

- Never open a public issue or write a commit message naming the leaked path before rotation completes, because that is a map for anyone watching.
- Review access logs across the whole exposure window, not from today, since detection lags exposure by the age of the commit.
- Treat pull request views and platform caches as separate copies, because a force push leaves the old diff visible until support expires it.

```bash
# Bad: rewriting first, while the key still authenticates.
git filter-repo --path config/prod.env --invert-paths && git push --force

# Good: revoke, verify rejection, review access, then rewrite.
aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive
aws sts get-caller-identity          # old key: expect InvalidClientTokenId
aws cloudtrail lookup-events --lookup-attributes \
  AttributeKey=AccessKeyId,AttributeValue=AKIAIOSFODNN7EXAMPLE
git filter-repo --path config/prod.env --invert-paths
git push --force --all && git push --force --tags
```

## Entropy Versus Known Prefixes

- Match known token prefixes first, because they are near zero false positive and name the issuer, which is what you need in order to rotate.
- Run entropy detection second for everything without a prefix (database passwords, HMAC keys, private keys, internal tokens), since those carry no recognizable shape.
- Tune entropy per file type, not globally, because minified bundles, lockfile hashes, base64 fixtures, and UUIDs clear a naive threshold and bury real hits.
- Allowlist by explicit value or path with a stated reason, never by lowering the threshold, because a lowered threshold silently disables detection for every future secret in the repo.

```bash
rg -n 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}'
rg -n 'sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}'
rg -n -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
detect-secrets scan --exclude-files '(package-lock\.json|\.min\.js|/fixtures/)'
```

```yaml
# Bad: global suppression that disables future detection.
entropy_threshold: 8.0
# Good: pinned allowlist entry with a reason.
allowlist:
  - path: docs/aws-setup.md
    value: AKIAIOSFODNN7EXAMPLE   # documented vendor placeholder
```

## .env Files and Ignore Rules

- Commit `.env.example` listing every key name with an empty or obviously fake value, because a missing key list pushes developers to ask a colleague to paste the real one into chat.
- Ignore every variant your tooling reads, since `.gitignore` matches literal patterns and `.env.production.local` is not covered by `.env`.
- Verify the rule applies instead of assuming, because a file already tracked stays tracked no matter what you add to `.gitignore`.

```gitignore
# Bad: one name, misses every variant tooling loads.
.env
# Good: the family, with the template re-included.
.env
.env.*
!.env.example
*.pem
*.key
secrets/
```

```bash
git check-ignore -v .env.production.local
git ls-files | rg '\.env|\.pem$|credentials'   # expect only .env.example
```

## CI Logs and Build Arguments

CI is where secrets escape with no code change. Masking is a substring match on the exact registered value, so any transformation defeats it.

- Assume masking fails when the value is transformed: base64, URL encoded, JSON escaped, line split, or printed one character at a time.
- Ban `set -x`, `bash -x`, and `--verbose` in any step holding a secret, because trace mode prints the expanded command including the value.
- Never pass a secret as `docker build --build-arg`, since build args are recorded in image metadata and readable by anyone who can pull the image.
- Scope secrets to the one job that needs them, never the workflow or organization and never a fork pull request, because an organization secret reaches every workflow and a fork controls the code that reads it.

```yaml
# Bad: build arg lands in image metadata; curl -v prints the auth header.
- run: docker build --build-arg NPM_TOKEN=${{ secrets.NPM_TOKEN }} .
- run: curl -v -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" https://api.example.com

# Good: BuildKit mount leaves no layer; the header comes from a file.
- run: |
    echo "${{ secrets.NPM_TOKEN }}" > /tmp/npm_token
    DOCKER_BUILDKIT=1 docker build --secret id=npm,src=/tmp/npm_token .
- run: |
    printf 'Authorization: Bearer %s\n' "${{ secrets.API_TOKEN }}" > /tmp/h
    curl -sS -H @/tmp/h https://api.example.com
```

```dockerfile
# Bad: ARG shows in `docker history`, and the deleted file still exists in the layer that created it.
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci && rm .npmrc
# Good: mounted for one RUN, never written to any layer.
RUN --mount=type=secret,id=npm NPM_TOKEN="$(cat /run/secrets/npm)" npm ci
```

```bash
docker history --no-trunc <image> | rg -i 'token|secret|password|key'
docker save <image> -o /tmp/img.tar && tar -xf /tmp/img.tar -C /tmp/img
rg -n 'AKIA[0-9A-Z]{16}|BEGIN .*PRIVATE KEY' /tmp/img
```

## Runtime Exposure

- Pass secrets as files or over a socket rather than command line arguments, because argv is world readable through `/proc/<pid>/cmdline` and appears in `ps aux` for every user on the host.
- Treat environment variables as readable by any process sharing the user or namespace, since `/proc/<pid>/environ` exposes them and crash handlers, profilers, and error reporters upload the whole environment.
- Scrub the environment before it reaches an error reporter, because most reporting SDKs attach environment and locals to every event by default.
- Keep secret files mode 0400, owned by the service user, on `tmpfs`, so the value never reaches disk.

```bash
# Bad: the password sits in argv, visible to every user on the box.
myservice --db-password 'hunter2-EXAMPLE-NOT-REAL'   # ps aux prints it
# Good: read from a mode 0400 file on tmpfs.
myservice --db-password-file /run/secrets/db_password
```

```python
# Bad: the reporter ships os.environ, including every credential.
sentry_sdk.init(dsn=DSN)
# Good: strip anything credential-shaped before send.
DENY = ("SECRET", "TOKEN", "PASSWORD", "KEY", "CREDENTIAL", "DSN")

def scrub(event, hint):
    env = event.get("contexts", {}).get("runtime", {}).get("env", {})
    for k in list(env):
        if any(d in k.upper() for d in DENY):
            env[k] = "[redacted]"
    return event

sentry_sdk.init(dsn=DSN, before_send=scrub, send_default_pii=False)
```

## Secret Managers and Their Tradeoffs

| Option | Gets you | Costs you |
| --- | --- | --- |
| Platform env vars | No new infrastructure | No audit trail, no rotation, visible via `/proc` |
| Cloud secret manager | Managed rotation, IAM policy, read audit log | Lock-in, per secret cost, IAM misconfiguration is the new risk |
| Cloud KMS plus ciphertext in git | Safe to commit, history auditable | Anyone with decrypt permission reads every version ever committed |
| HashiCorp Vault | Dynamic short-lived credentials, leases, fine policy | You operate Vault: unseal, HA, its own root token |
| Sealed Secrets or SOPS | GitOps friendly, reviewable diffs | Key rotation re-encrypts every file; sealing key is one point of compromise |

- Choose the option whose failure mode you can operate, because an unsealed Vault at 3am is worse than a cloud secret you never rotated.
- Require a read audit log wherever blast radius exceeds one service, since without read logs you cannot scope an incident.
- Never store the secret manager's bootstrap credential in the application repo, because that collapses the whole chain to one leak.

## Prefer Short-Lived, Narrowly Scoped Credentials

- Replace long-lived static keys with workload identity federation (OIDC from CI, IRSA on Kubernetes, instance roles), because a credential expiring in an hour turns a permanent breach into a bounded one and removes rotation.
- Scope every token to the minimum action and resource set, since a leaked read-only token on one bucket is an incident report and a leaked admin key is a rebuild.
- Set an explicit expiry wherever the issuer supports one, because "no expiry" guarantees the credential outlives whoever created it.

```yaml
# Bad: long-lived static keys stored as CI secrets, rotated never.
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
# Good: OIDC exchange, nothing stored, credentials expire with the job.
permissions: { id-token: write, contents: read }
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/ci-deploy-EXAMPLE
```

## Rotation Cadence and Non-Breaking Rotation

Rotation that causes an outage gets skipped, and a skipped rotation is why keys reach five years old. Make it boring by overlapping old and new.

- Rotate on a fixed schedule for anything long-lived, and immediately on any exposure or the departure of anyone who held it.
- Build the dual-accept window on the verifying side first: accept both values, roll callers to the new one, confirm zero traffic on the old, then remove it.
- Carry a key ID so the verifier selects the right key per request, because a try-both loop hides the moment the old key goes unused.
- Gate removal on the old key's usage metric hitting zero and keep two keys provisioned always, since a calendar date is not evidence and rotation should promote a standby, not create one under pressure.

```python
# Bad: swap in place. Every in-flight token signed with the old key breaks.
SIGNING_KEY = os.environ["JWT_SIGNING_KEY"]

def verify(token):
    return jwt.decode(token, SIGNING_KEY, algorithms=["HS256"])

# Good: keyed set, dual accept, sign with the current key only.
KEYS = json.loads(os.environ["JWT_KEYS"])      # {"2": "...", "1": "..."}
CURRENT = os.environ["JWT_CURRENT_KID"]        # "2"

def sign(claims):
    return jwt.encode(claims, KEYS[CURRENT], algorithm="HS256", headers={"kid": CURRENT})

def verify(token):
    kid = jwt.get_unverified_header(token)["kid"]
    if kid != CURRENT:
        metrics.increment("jwt.legacy_kid", tags=[f"kid:{kid}"])  # gate removal on this
    return jwt.decode(token, KEYS[kid], algorithms=["HS256"])
```

## Secrets in Logs and Error Reports

- Redact in the log formatter, not at each call site, because one missed call site is the whole leak and there are hundreds of call sites.
- Wrap secret values in a type whose `__repr__`, `__str__`, and serializer return a placeholder, so an accidental interpolation cannot print the value.
- Treat URLs as secret carriers, since credentials in a connection string and tokens in a query parameter land in access logs, proxies, and referrers.
- Run the secret scanner against a sample of production logs, because that is the only way to find leaks no code review pattern predicted.

```python
# Bad: one f-string anywhere prints the value.
logger.info(f"connecting to {db_url}")   # postgres://user:PASSWORD@host/db
# Good: a type that cannot be printed by accident.
class Secret:
    __slots__ = ("_v",)
    def __init__(self, v): self._v = v
    def reveal(self): return self._v
    def __repr__(self): return "Secret(***)"
    __str__ = __repr__

logger.info("connecting", extra={"host": urlparse(db_url).hostname})
```

## Prevention at the Commit Boundary

- Install the scanner through the repo's pre-commit config so every clone gets it, because a hook living only in one developer's `.git/hooks` protects one developer.
- Run the same scanner in CI as a required check, since local hooks are skippable with `--no-verify` and absent on a fresh clone.
- Commit a baseline of reviewed findings so the check fails only on new hits, and block the push rather than warn, because a check that is red on arrival or buried in build output is the same as no check at all.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    hooks: [{ id: gitleaks }]
  - repo: https://github.com/Yelp/detect-secrets
    hooks:
      - id: detect-secrets
        args: ["--baseline", ".secrets.baseline"]
```

```bash
pre-commit install                             # per clone, and in onboarding
gitleaks protect --staged --redact --verbose   # same binary, required in CI
```

## Reporting

Use the finding format from `../security-audit/`, plus two required fields for anything already exposed.

- State the exposure window, from the first commit or log line containing it through revocation, because that window scopes the access log review.
- State rotation status as rotated, pending, or not required, since a findings list without it cannot decide whether the incident is closed.
- Rank by what the credential opens, not by how it was found, because a low-entropy internal token to the billing database outranks a verified but read-only status page key.

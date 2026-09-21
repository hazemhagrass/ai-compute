# Secrets Management Audit

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="secrets-management-audit robot" width="200">
</div>

A skill for auditing the entire life of a credential: how it got committed, how it is revoked and purged in that order, where it leaks outside source control, how it is stored, and how it is rotated without an outage.

## What it does

`SKILL.md` gives an agent a six step order of work and the commands for each
step:

1. Inventory: what secrets exist and which system each one opens.
2. Exposure: working tree, git history, CI logs, image layers, runtime.
3. Containment: rotate first, then purge, then verify revocation.
4. Storage: where secrets live at rest and who can read them.
5. Lifetime and scope: short-lived over long-lived, least privilege.
6. Prevention: pre-commit hooks, CI gates, log redaction.

It covers history scanning with `gitleaks` and `trufflehog`, known-prefix
versus entropy detection, `.gitignore` families for `.env` variants, CI log
masking failure modes, BuildKit secret mounts versus build args, `/proc` and
`ps` exposure of argv and environment, a tradeoff table for secret managers,
workload identity federation, dual-accept key rotation with key IDs, log
formatter redaction, and pre-commit plus CI gating.

It does not repeat `../security-audit/`. That skill covers secrets as one
class inside an application code review: storage in source, logging on the
auth path, upstream 401 error echo, gitignore gaps. This one covers everything
around that: history, CI, images, runtime, storage, rotation, prevention.

## When to use this

- A secret scanner fired on a repository and you need to decide what to do
  first.
- Someone deleted a credential from a file, committed the deletion, and
  believes the problem is solved.
- A key is being rotated and the team is worried about breaking live traffic.
- Someone with production credential access is offboarding.
- A CI pipeline is being given cloud access for the first time.
- A Dockerfile needs a private registry token at build time.
- You are choosing between platform env vars, a cloud secret manager, Vault,
  and SOPS or Sealed Secrets.
- A repository is about to be open sourced or handed to another team.
- An error reporting SDK is being added to a service that holds credentials.

## Quick start

Audit a repository and its pipeline. Do not remediate before step 2 finishes.

Step 1, inventory. Name the system behind every hit, not just the string:

```bash
rg -n 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{20,}' \
  --glob '!package-lock.json'
```

Step 2, scan all of history, because `HEAD` being clean proves nothing:

```bash
gitleaks detect --source . --log-opts="--all --full-history" \
  --report-format json --report-path /tmp/leaks.json
jq -r '.[] | "\(.File):\(.StartLine) \(.RuleID) commit=\(.Commit)"' /tmp/leaks.json
# config/prod.env:3 aws-access-token commit=4f2a91c
```

Confirm the blob is still reachable even though the file is gone from `HEAD`:

```bash
git rev-list --all --objects | grep 'config/prod.env'
git show 4f2a91c:config/prod.env
```

Step 3, containment. Revoke before you rewrite anything:

```bash
aws iam update-access-key --user-name ci-deploy \
  --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws sts get-caller-identity
# expect: InvalidClientTokenId
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAIOSFODNN7EXAMPLE
git filter-repo --path config/prod.env --invert-paths
git push --force --all && git push --force --tags
```

Step 4, check the pipeline and the image:

```bash
rg -n 'set -x|bash -x|--verbose|--build-arg' .github/workflows/ Dockerfile
docker history --no-trunc myapp:latest | rg -i 'token|secret|password'
```

Step 5, close the ignore gaps and prove they apply:

```bash
git check-ignore -v .env.production.local
git ls-files | rg '\.env|\.pem$|credentials'   # expect only .env.example
```

Step 6, install prevention so this audit does not repeat:

```bash
pre-commit install
detect-secrets scan --exclude-files '(package-lock\.json|/fixtures/)' \
  > .secrets.baseline
gitleaks protect --staged --redact --verbose   # add as a required CI check
```

## Key concepts

**Deleting the file does not delete the secret.** Git stores content as
immutable blob objects. The commit that added the key still contains it, the
blob is still reachable, and `git show`, every existing clone, and every fork
still serve it. Absence from `HEAD` is cosmetic.

**Rotate, then purge.** Rotation is fast and total: revoke at the issuer and
every copy everywhere becomes worthless at once. Purging is slow and
incomplete, because forks, mirrors, CI caches, backups, and developer clones
keep the old objects. Purging first burns hours while the key still works.

**Exposed means compromised from the exposure date.** Scope the access log
review to the window between the commit that introduced it and revocation, not
from the day you noticed.

**Prefixes name the issuer, entropy finds the shapeless ones.** Prefix
matching (`AKIA`, `ghp_`, `xox`) is near zero false positive and tells you
where to rotate. Entropy catches database passwords, HMAC keys, and private
keys that carry no recognizable shape, at the cost of noise from minified
bundles, lockfile hashes, and UUIDs.

**CI masking is a substring match.** Any transformation defeats it: base64,
URL encoding, JSON escaping, line splitting, or a verbose tool printing the
value one character at a time. `set -x` prints the expanded command.

**Build args persist in image metadata.** `docker history` shows every `ARG`
value, and a file created then deleted in a later layer still exists in the
layer that created it. BuildKit `--mount=type=secret` leaves nothing behind.

**Argv and environ are readable.** `/proc/<pid>/cmdline` and `ps aux` expose
command line arguments to other users on the host, `/proc/<pid>/environ`
exposes environment variables, and crash reporters upload the environment by
default.

**Short-lived beats rotated.** Workload identity federation (OIDC from CI,
IRSA on Kubernetes, instance roles) removes the stored credential entirely and
bounds a breach by the token lifetime.

**Dual-accept makes rotation non-breaking.** Teach the verifier to accept both
keys and select by key ID, roll callers to the new key, watch usage of the old
key fall to zero, then remove it. A calendar date is not evidence.

**Prevention is two seconds, detection is a rotation plus a rewrite.** A
pre-commit hook in the repo config plus the same scanner as a required CI
check, with a baseline so only new findings fail.

## Common pitfalls

**Committing the deletion and calling it fixed.**

```bash
# Bad: the blob is still reachable from the commit that added it.
git rm config/prod.env && git commit -m "remove secrets"
# Good: revoke at the issuer first, then rewrite history, then force push.
aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive
git filter-repo --path config/prod.env --invert-paths
```

**Scanning only the working tree.**

```bash
# Bad: proves HEAD is clean and nothing else.
rg -n 'AKIA[0-9A-Z]{16}' .
# Good: walk every object on every ref.
gitleaks detect --source . --log-opts="--all --full-history"
```

**Announcing the leak before rotating.** A public issue or a commit message
naming the leaked path is a map for anyone watching the repo.

**Silencing the scanner instead of allowlisting the value.**

```yaml
# Bad: disables detection for every future secret in the repo.
entropy_threshold: 8.0
# Good: pin the one known placeholder, with a reason.
allowlist:
  - path: docs/aws-setup.md
    value: AKIAIOSFODNN7EXAMPLE   # vendor documentation placeholder
```

**Ignoring `.env` but not its variants.**

```gitignore
# Bad: .env.production.local is not matched by this.
.env
# Good: the family, with the template re-included.
.env
.env.*
!.env.example
*.pem
```

Adding the rule does not untrack an already tracked file. Check `git ls-files`.

**Passing secrets as build args.**

```dockerfile
# Bad: visible in `docker history`, and the deleted file lives in its layer.
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc \
 && npm ci && rm .npmrc
# Good: mounted for one RUN, never written to a layer.
RUN --mount=type=secret,id=npm \
    NPM_TOKEN="$(cat /run/secrets/npm)" npm ci
```

**Putting a password in argv.**

```bash
# Bad: every user on the host reads it from ps.
myservice --db-password 'hunter2-EXAMPLE-NOT-REAL'
# Good: a mode 0400 file on tmpfs.
myservice --db-password-file /run/secrets/db_password
```

**Letting the error reporter ship the environment.**

```python
# Bad: default config attaches os.environ to every event.
sentry_sdk.init(dsn=DSN)
# Good: scrub before send, and turn off default PII.
sentry_sdk.init(dsn=DSN, before_send=scrub, send_default_pii=False)
```

**Swapping a signing key in place.** Setting `JWT_SIGNING_KEY` to the new
value and redeploying fails every in-flight token at once. Ship a keyed set
with a `kid` header, accept both, roll signers to the new `kid`, and gate
removal of the old key on its usage metric hitting zero.

**Redacting at the call site.** There are hundreds of call sites and one
missed interpolation is the entire leak. Redact in the log formatter, and wrap
secrets in a type whose `__repr__` returns a placeholder.

**Storing the secret manager's bootstrap credential in the application repo.**
That collapses the whole chain to a single leak.

**Choosing a secret manager you cannot operate.** Vault gives you dynamic
short-lived credentials and gives you unseal, HA, and its own root token. An
unsealed Vault at 3am is worse than a cloud secret you never rotated.

**A pre-commit hook that only exists locally.** Hooks in one developer's
`.git/hooks` protect one developer, and `--no-verify` skips them. Put the hook
in the repo config and run the same scanner as a required CI check.

## See also

- `../security-audit/` for the application code pass: authorization,
  injection, the secret handling grep patterns, upstream 401 error echo, and
  the finding and severity format this skill reuses.
- `../../devops/ci-cd-debugging/` for pipeline mechanics when a workflow step
  behaves differently than the local run.
- `../../devops/docker-troubleshooting/` for image and layer inspection beyond
  the secret-hunting subset here.
- `../../devtools/git-workflow/` for history rewriting, force push etiquette,
  and recovering clones after a rewrite.
- `../../devtools/env-doctor/` for reproducible environment setup, which is
  where `.env.example` and the onboarding script belong.
- `../../engineering/api-integration/` for token scoping, retries, and error
  handling on the client side of a third-party credential.

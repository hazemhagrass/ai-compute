# CI/CD Debugging

A systematic loop for diagnosing failed pipelines, flaky tests, and broken deployments instead of hitting "Re-run jobs" until the build goes green.

## What it does

This skill turns a red pipeline into a root cause. It gives you:

- A five-step debugging loop (read the full error, find what changed, reproduce locally, fix the cause, verify).
- Symptom-to-cause tables for the failure classes that account for most CI incidents: build/install failures, tests that pass locally but fail in CI, deployment failures, flaky tests, Docker build failures, and missing secrets.
- Copy-paste fixes in the format the pipeline actually consumes (GitHub Actions YAML, Jest/Testing Library, Kubernetes probes, `.dockerignore`).
- Pipeline optimization recipes: dependency caching, matrix parallelism, and job dependencies so lint gates the expensive test matrix.
- Interactive debugging techniques including `act`, matching Docker images, `tmate` SSH into a runner, and environment dump steps.
- Ten hard rules and a list of anti-patterns to reject in review.

## When to use this

Use it when:

- A CI pipeline fails and the error message is not self-explanatory.
- Tests pass on your machine and fail on the runner.
- A deploy step errors after the build succeeded.
- A test passes sometimes and fails other times.
- A build is slow, times out, or hangs.

Skip it when:

- You are authoring a pipeline from scratch (this skill assumes one exists).
- The error is obvious and you already know the one-line fix.
- The failure is application logic that happens to be caught by CI, not a CI-specific problem.

## Quick start

A worked example: the `test` job started failing on `main` this morning. Nothing in the diff touches tests.

**Step 1. Read the full log, not the summary line.**

GitHub Actions collapses steps and truncates. Open the failed step and click "View raw logs". The summary said `Process completed with exit code 1`. The raw log ends with:

```
FAIL src/billing/invoice.test.ts
  ● invoice totals › applies tax for the current period

    expect(received).toBe(expected)

    Expected: "2026-09-21"
    Received: "2026-09-22"

      at Object.<anonymous> (src/billing/invoice.test.ts:41:26)
```

**Step 2. Ask what changed.**

```bash
git log --oneline -5
git diff <last-green-sha> HEAD -- src/billing
```

The diff is empty for `src/billing`. Code did not change, so the environment did. The expected value is yesterday's date, which tells you the test is reading the system clock.

**Step 3. Reproduce locally under the same conditions.**

```bash
# Run the exact CI command, not your usual `npm test`
NODE_ENV=test npm run test:ci -- --testNamePattern="applies tax for the current period"

# Still green locally? Match the runner's timezone and image:
docker run --rm -it -e TZ=UTC -v "$(pwd)":/app -w /app node:18.17.1 bash
npm ci && NODE_ENV=test npm run test:ci
```

It now reproduces. The test hard-codes a date literal that was correct on the day it was written.

**Step 4. Fix the root cause.**

```javascript
// Bad: passes on the day it was authored, fails every day after
test('applies tax for the current period', () => {
  expect(getPeriodLabel()).toBe('2026-09-21');
});

// Good: inject a fixed clock so the assertion is deterministic
test('applies tax for the current period', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-21T12:00:00Z'));

  expect(getPeriodLabel()).toBe('2026-09-21');

  jest.useRealTimers();
});
```

**Step 5. Verify, and harden while you are here.**

```bash
# Prove it is no longer time-dependent: run it many times
for i in {1..50}; do
  npm test -- --testNamePattern="applies tax for the current period" || break
done

git add src/billing/invoice.test.ts
git commit -m "fix(test): freeze clock in invoice period test"
```

Then remove the class of problem from the pipeline, not just this instance:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15          # fail fast instead of hanging
    env:
      TZ: UTC                    # deterministic clock for every test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v3
        with:
          node-version: 18.17.1  # exact version, not a floating tag
      - uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-
      - run: npm ci               # deterministic install
      - run: npm run test:ci
```

## Key concepts

**The debugging loop.** Read the full error, identify what changed, reproduce locally, fix the cause, verify the fix. Every section of the skill maps back to one of these five steps.

**"What changed?" is the fastest filter.** A pipeline that was green yesterday and red today has a diff, a dependency update, a runner image bump, or a clock tick behind it. `git diff <last-green> HEAD` turns a blank page into a suspect list.

**Reproduction is the precondition for verification.** If you cannot make it fail locally, you cannot prove you fixed it. Use `act -j test` for GitHub Actions, or run the CI image directly with Docker and the same env vars.

**Local/CI divergence has a short list of causes.** Timing and race conditions, missing environment variables, filesystem case sensitivity (macOS is case-insensitive, Linux is not), runtime version drift, and tests depending on local state such as a seeded database.

**Flakiness is nondeterminism, not bad luck.** The four sources are race conditions, test order dependencies, shared state, and nondeterministic inputs (random values, `Date.now()`, live network calls). Each has a mechanical fix: wait on conditions, isolate setup per test, reset state in `beforeEach`, inject clocks and seeds.

**Determinism in the pipeline itself.** `npm ci` over `npm install`, pinned image tags such as `node:18.17.1` over `node:18`, explicit timeouts, and lockfiles committed and in sync.

**Fail fast beats fail eventually.** A missing `timeout-minutes` turns a hung network call into six hours of billed runner time and a delayed signal to the whole team.

**Secrets are write-only.** Reference them through `${{ secrets.NAME }}` and never echo them. Test presence, not value.

## Common pitfalls

**Re-running the job until it passes.**

```bash
# Bad: this is not a fix, it is a coin flip you eventually win
# (click "Re-run failed jobs" x5)
```

```bash
# Good: make the flake reproducible first, then fix it
for i in {1..100}; do
  npm test -- --testNamePattern="should load user data" || break
done
```

**Sleeping instead of waiting for a condition.**

```javascript
// Bad: passes at 999ms, fails at 1001ms, slow either way
await new Promise(r => setTimeout(r, 1000));
expect(screen.getByText('Success')).toBeInTheDocument();
```

```javascript
// Good: polls until the condition holds, with a ceiling
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
}, { timeout: 5000 });
```

**Tests that depend on the order they run in.**

```javascript
// Bad: 'loads user' only works if 'creates user' ran first
test('creates user', async () => {
  await db.users.create({ id: 1, email: 'test@example.com' });
});
test('loads user', async () => {
  const user = await db.users.findOne({ id: 1 });
  expect(user.email).toBe('test@example.com');
});
```

```javascript
// Good: clean slate plus its own setup, passes in isolation
beforeEach(async () => {
  await db.users.deleteMany({});
});
test('loads user', async () => {
  await db.users.create({ id: 1, email: 'test@example.com' });
  const user = await db.users.findOne({ id: 1 });
  expect(user.email).toBe('test@example.com');
});
```

**Nondeterministic installs in CI.**

```yaml
# Bad: resolves fresh versions on every run, lockfile ignored
- run: npm install
```

```yaml
# Good: installs exactly what the lockfile pins, and fails if it drifted
- run: npm ci
```

**Printing secrets to diagnose them.**

```bash
# Bad: the value is now in the build log forever
echo "API_KEY=$API_KEY"
```

```bash
# Good: assert presence without disclosing the value
echo "API_KEY is set: ${API_KEY:+yes}"
```

**No .dockerignore, so the build context is enormous.**

```bash
# Bad: ships node_modules, .git and logs to the daemon on every build
# (no .dockerignore file at all)
```

```bash
# Good: .dockerignore
node_modules
.git
*.log
dist
.env
```

**Health checks that start before the app does.**

```yaml
# Bad: probe fires instantly, pod is killed during startup, deploy "fails"
livenessProbe:
  httpGet: { path: /health, port: 8080 }
```

```yaml
# Good: give the process a startup window
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Skipping a flaky test instead of fixing it.** A `test.skip` hides a real race condition that will resurface in production, where there is no retry button. Fix the determinism or delete the test, but do not leave it disabled and forgotten.

## See also

- [docker-troubleshooting](../docker-troubleshooting/) for container build and runtime failures once you have narrowed the CI failure down to the `docker build` or image layer.
- [kubernetes-debugging](../kubernetes-debugging/) for the deployment half of the pipeline: failing pods, probes, and rollout diagnosis with `kubectl`.

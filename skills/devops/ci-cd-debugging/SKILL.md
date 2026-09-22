---
name: ci-cd-debugging
description: "Use when a pipeline fails or tests flake. Debug CI systematically: isolate flake vs red, repro, bisect the stage."
---

Debug CI/CD failures by reading the full log output, isolating what changed, reproducing locally when possible, and fixing the root cause instead of restarting blindly.

## The debugging loop

1. **Read the full error** - don't stop at the first line
2. **What changed?** - compare to the last successful run
3. **Reproduce locally** - can you run the same command on your machine?
4. **Fix the cause, not the symptom** - "restart" isn't a fix
5. **Verify the fix** - push and confirm the pipeline passes

## Common pipeline failures

### Build fails

**Symptom:** `npm install`, `pip install`, or `docker build` errors

```bash
# Common causes:
# - Dependency version conflict
# - Package registry down or rate-limited
# - Lockfile out of sync with package.json
# - Network timeout

# Read the error carefully:
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
# -> Version conflict. Check package.json for conflicting peer dependencies.

npm ERR! 404 Not Found - GET https://registry.npmjs.org/some-package
# -> Package doesn't exist or was unpublished. Check the name/version.

ERROR: Could not find a version that satisfies the requirement pandas==1.5.0
# -> Python package version doesn't exist. Check PyPI.
```

**Fix: lockfile out of sync**
```bash
# Local:
rm package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerate lockfile"
git push

# Python:
rm poetry.lock  # or Pipfile.lock
poetry install
git add poetry.lock
git commit -m "fix: regenerate poetry lockfile"
```

**Fix: network timeout during install**
```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: npm install
  timeout-minutes: 10  # Fail fast instead of hanging for 6 hours
  env:
    NPM_CONFIG_REGISTRY: https://registry.npmjs.org/  # Explicit registry
```

### Tests fail in CI but pass locally

**Symptom:** Tests green on your machine, red in CI

```bash
# Common causes:
# - Timing issue (race condition)
# - Missing environment variable
# - File path case sensitivity (Mac is case-insensitive, Linux is case-sensitive)
# - Different Node/Python version
# - Test depends on local state (DB, file that exists locally)
```

**Reproduce with the CI environment:**
```bash
# GitHub Actions: use act to run locally
act -j test

# Or use Docker to match the CI image
docker run --rm -it -v $(pwd):/app -w /app node:18 bash
npm install && npm test
```

**Fix: timing/flaky test**
```javascript
// Bad: hard-coded delay
test('user sees success message', async () => {
  await new Promise(r => setTimeout(r, 1000));  // Flaky if it takes 1001ms
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Good: wait for the condition
test('user sees success message', async () => {
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  }, { timeout: 5000 });
});
```

**Fix: missing environment variable**
```yaml
# .github/workflows/ci.yml
env:
  DATABASE_URL: postgres://user:pass@localhost/testdb
  NODE_ENV: test
```

### Deployment fails

**Symptom:** Build passes, deployment step fails

```bash
# Common causes:
# - Image tag doesn't exist in registry
# - Kubernetes manifest references wrong image
# - Secret missing in target environment
# - Health check fails immediately after deploy
```

**Read the deployment logs:**
```bash
# Kubernetes
kubectl logs -l app=myapp -n production --tail 100
kubectl describe pod <pod> -n production | grep -A10 Events

# Docker Compose
docker-compose logs myapp

# ECS/Fargate
aws logs tail /ecs/myapp --follow
```

**Fix: health check failing**
```yaml
# The app needs time to start, but health check runs immediately
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30  # Wait 30s before first check
  periodSeconds: 10
```

### Flaky tests

**Symptom:** Test passes sometimes, fails other times

**Common causes:**
1. Race condition (async code, timing)
2. Test order dependency (test A must run before test B)
3. Shared state (global variable, database row)
4. Non-deterministic code (random number, current time, network call)

**Find the flaky test:**
```bash
# Run tests 100 times
for i in {1..100}; do
  npm test -- --testNamePattern="should load user data" || break
done
# If it breaks before 100, it's flaky
```

**Fix: test order dependency**
```javascript
// Bad: test depends on previous test creating a user
test('creates user', async () => {
  await db.users.create({ id: 1, email: 'test@example.com' });
});

test('loads user', async () => {
  const user = await db.users.findOne({ id: 1 });  // Breaks if run alone
  expect(user.email).toBe('test@example.com');
});

// Good: each test is independent
beforeEach(async () => {
  await db.users.deleteMany({});  // Clean slate
});

test('loads user', async () => {
  await db.users.create({ id: 1, email: 'test@example.com' });  // Own setup
  const user = await db.users.findOne({ id: 1 });
  expect(user.email).toBe('test@example.com');
});
```

**Fix: time-dependent code**
```javascript
// Bad: test breaks after midnight
test('shows today date', () => {
  const result = getTodayDate();
  expect(result).toBe('2026-09-21');  // Fails tomorrow
});

// Good: inject the clock
test('shows today date', () => {
  const mockNow = new Date('2026-09-21T12:00:00Z');
  jest.useFakeTimers();
  jest.setSystemTime(mockNow);
  
  const result = getTodayDate();
  expect(result).toBe('2026-09-21');
  
  jest.useRealTimers();
});
```

### Docker build fails in CI

**Symptom:** `docker build` works locally, fails in CI

```bash
# Common causes:
# - Build context too large (sends 2GB to daemon)
# - Multi-platform build without emulation
# - Layer cache miss (every build starts from scratch)
```

**Fix: .dockerignore missing**
```bash
# .dockerignore
node_modules
.git
*.log
dist
.env
```

**Fix: enable Docker layer caching**
```yaml
# .github/workflows/ci.yml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build
  uses: docker/build-push-action@v4
  with:
    context: .
    cache-from: type=gha  # GitHub Actions cache
    cache-to: type=gha,mode=max
    push: false
```

### Secret not available in CI

**Symptom:** Build fails with "API_KEY is not set"

```yaml
# GitHub Actions: add secret via Settings -> Secrets
# Then reference it:
env:
  API_KEY: ${{ secrets.API_KEY }}

# Or in a step:
- name: Deploy
  env:
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh
```

**Never log secrets:**
```bash
# Bad
echo "API_KEY=$API_KEY"  # Appears in logs

# Good
echo "API_KEY is set: ${API_KEY:+yes}"  # Only prints "yes" if set
```

## Pipeline optimization

### Cache dependencies

```yaml
# GitHub Actions
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Install dependencies
  run: npm ci  # Faster than npm install
```

### Run tests in parallel

```yaml
# GitHub Actions: matrix builds
jobs:
  test:
    strategy:
      matrix:
        node: [16, 18, 20]
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
```

### Skip unnecessary steps

```yaml
# Only run lint on one job, not all matrix combinations
lint:
  runs-on: ubuntu-latest
  steps:
    - run: npm run lint

test:
  needs: lint  # Waits for lint to pass first
  strategy:
    matrix:
      node: [16, 18, 20]
  runs-on: ubuntu-latest
  steps:
    - run: npm test
```

## Debugging techniques

### 1. Read the FULL log

CI tools often truncate or hide errors. Expand every collapsed section.

```bash
# GitHub Actions: click the failed step, click "View raw logs"
# CircleCI: scroll to the bottom of each step
```

### 2. Compare with the last successful run

```bash
# What changed between the last green build and this red one?
git diff <last-green-commit> <current-commit>
```

### 3. SSH into the CI runner (if supported)

```yaml
# GitHub Actions: tmate (SSH to the runner)
- name: Setup tmate session
  if: failure()
  uses: mxschmitt/action-tmate@v3
# Gives you an SSH command to connect and debug interactively
```

### 4. Run the exact CI command locally

```bash
# Copy the command from the CI log and run it verbatim
NODE_ENV=test npm run test:ci
```

### 5. Add debug logging

```yaml
- name: Debug environment
  run: |
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "PATH: $PATH"
    echo "Working directory: $(pwd)"
    ls -la
    env | sort
```

## Rules

1. **Read the full error.** The first line is often not the root cause. Scroll to the bottom.

2. **What changed?** Compare with the last passing build. The diff is your suspect list.

3. **Reproduce locally.** If you can't reproduce it, you can't verify the fix.

4. **Fix the root cause.** Restarting the pipeline 10 times until it passes is not a fix.

5. **Make tests deterministic.** No random data, no `sleep(1000)`, no reliance on system time.

6. **Each test is independent.** It must pass when run alone, in any order.

7. **Cache dependencies.** Don't re-download npm/pip packages on every run.

8. **Fail fast.** Set timeouts. A hung build wastes 6 hours of runner time.

9. **Never log secrets.** Secrets in logs = compromised.

10. **Pin versions.** `node:18` is fine locally, but CI should use `node:18.17.1` (exact version).

## Anti-patterns

- ❌ Restarting the pipeline 5 times hoping it passes (diagnose the flake)
- ❌ Skipping flaky tests instead of fixing them
- ❌ Using `sleep(2000)` instead of `waitFor(...)`
- ❌ Tests that depend on running in a specific order
- ❌ No .dockerignore (sends node_modules and .git to Docker daemon)
- ❌ Logging environment variables that contain secrets
- ❌ Using `npm install` instead of `npm ci` in CI (non-deterministic)

## When to use this skill

Use this skill when:
- A CI pipeline fails and you don't know why
- Tests pass locally but fail in CI
- A deployment step errors
- Tests are flaky (sometimes pass, sometimes fail)
- Build is slow or times out

Skip this skill when:
- Setting up a pipeline from scratch (different skill)
- The error message is clear and you know the fix
- The issue is application logic, not CI-specific

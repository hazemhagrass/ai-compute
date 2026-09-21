# ai-model-router: operations and deployment

Everything a person running this app in production needs: first run, backups,
restore, key rotation, log retention, upgrades, and the failures that actually
happen. Read the section you need; every command is copy-pasteable and every
claim was verified against the code in this repo.

Deployment today is either `pnpm build && pnpm start` on a machine with Node 22+
(the CI matrix) or the Dockerfile at the repo root. The app is a single Next.js
16 server process talking to one SQLite file: there is no separate database
server, no worker, no queue.

## 0. What lives where

| Thing | Location | Set by |
| --- | --- | --- |
| SQLite database | `<AMR_DATA_DIR>/router.db` (default `<app>/data/router.db`) | `src/lib/paths.ts` |
| Master encryption key | `AMR_SECRET` env var, else `<AMR_DATA_DIR>/.secret` (auto-generated, chmod 600) | `src/lib/crypto.ts` |
| Data directory | `process.cwd()/data` unless `AMR_DATA_DIR` is set | `src/lib/paths.ts` |
| Database path | `<AMR_DATA_DIR>/router.db` unless `AMR_DB_PATH` is set | `src/lib/paths.ts` |

Environment variables, complete list, real names:

- `AMR_DATA_DIR`: where the database and the auto-generated `.secret` live.
  Point it at a mounted volume in any real deployment. Default: `./data`
  relative to the process working directory.
- `AMR_DB_PATH`: overrides the database file path alone. Rarely needed; set it
  only to place the db somewhere other than the data dir.
- `AMR_SECRET`: the master key as an environment variable. If set, it wins over
  `<AMR_DATA_DIR>/.secret` and no key file is used. Must be at least 16
  characters; a shorter value is silently ignored and the file path is used
  instead, so a typo'd short secret does not strand the stored keys. Prefer 32+
  random characters, e.g. `openssl rand -base64 36`.
- `PORT` (Next.js): listen port. Default 3000.
- `HOSTNAME`: must be `0.0.0.0` inside a container, or the server binds to the
  container loopback and the published port answers with connection reset.

There is no `.env` loader in the app itself; `apps/ai-model-router/.gitignore`
excludes `.env*`, and docker-compose reads a local `.env` at the repo root for
`AMR_SECRET`. If you run with `pnpm start`, export the variables yourself.

The database runs in WAL mode (`src/lib/db.ts` sets `journal_mode = WAL`), so a
live instance has `router.db`, `router.db-wal`, and `router.db-shm` side by
side. That is normal; it is also why naive file copies are wrong (see Backup).

## 1. First run

On first boot the app creates the data directory, the database, the schema, and
seeds the built-in providers, models, and tasks (`src/lib/db.ts`, `seed.ts`).
Nothing needs to be initialized by hand.

Do this, in order:

1. Start the app:

   ```bash
   cd apps/ai-model-router
   pnpm install
   pnpm build
   AMR_DATA_DIR=/var/lib/ai-model-router pnpm start
   ```

   or with Docker (repo root):

   ```bash
   # Put AMR_SECRET in .env first (see below); do not rely on the generated file
   # inside a named volume.
   docker compose up -d --build
   ```

2. Set the password. Until a password exists the app is OPEN: every route
   treats an unconfigured instance as authenticated (`src/lib/auth.ts`,
   `isAuthenticated` returns true when no password is set). Open the app in a
   browser; the login screen shows a setup form. Or set it over the API:

   ```bash
   curl -X PUT http://localhost:3000/api/auth \
     -H 'content-type: application/json' \
     -d '{"password":"at-least-12-chars-here"}'
   ```

   The API refuses shorter passwords (12 is the floor, enforced by the schema)
   and refuses the call with 409 once a password exists. After it succeeds you
   are logged in: the response sets the `amr_session` cookie, valid 12 hours.

3. Provide the master key deliberately. If `AMR_SECRET` is unset, the first
   process that needs to encrypt or decrypt writes a random `<data>/.secret`
   and uses it from then on. That works, but the key then lives only in that
   directory. For anything you back up or migrate, set it explicitly:

   ```bash
   openssl rand -base64 36   # run once, store the output in your secret manager
   ```

Set `AMR_SECRET` in the environment (or `.env` for compose) on every start. The
key is cached in memory per process, so changing it requires a restart, and
changing it without rotating the database (section 4) makes stored keys
unreadable.

## 2. Backup

**Back up the database and the master key together, always.** The provider API
keys are encrypted with AES-256-GCM under a key derived (scrypt, salt
`ai-model-router.v1`) from the master key. A backup of the database without the
key is an archive of ciphertext nobody can read; a backup of the key without
the database guards nothing. One without the other is not a backup. The
plaintext of the stored keys exists nowhere else: `GET /api/export` returns
providers with keys stripped, by design, so an export alone cannot restore
them.

What to back up:

- `<AMR_DATA_DIR>/router.db` (see below for the safe way)
- The master key: `AMR_SECRET`'s value from your secret manager, or a copy of
  `<AMR_DATA_DIR>/.secret`. The file is one line, mode 600.

A plain `cp` of a live SQLite database is not safe. The database is in WAL
mode, and recent commits may sit in `router.db-wal` while `cp` reads only
`router.db`. The copy can be silently missing recent data (verified: a naive
`cp` of a live db produced a file whose `settings` table was empty) or torn
mid-page. Use SQLite's own backup path instead, which takes the necessary locks
and produces a consistent single file:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=~/amr-backups/$STAMP
mkdir -p "$DEST"
sqlite3 "$AMR_DATA_DIR/router.db" ".backup '$DEST/router.db'"
cp -p "$AMR_DATA_DIR/.secret" "$DEST/.secret"   # or export AMR_SECRET's value
chmod 600 "$DEST/.secret"
```

`sqlite3 ... ".backup '...'"` works while the app is running and writes a
checkpointed, self-contained copy (no `-wal`/`-shm` needed). The `.recover`
command used later is from the same CLI. If the `sqlite3` binary is missing
(debian-slim containers do not ship it), `better-sqlite3` provides the same
thing in Node, runnable from `apps/ai-model-router`:

```bash
mkdir -p ~/amr-backups/$(date +%Y%m%d-%H%M%S)
cat > backup-db.mjs <<'EOF'
import { DATA_DIR } from "./src/lib/paths";
import { getDb } from "./src/lib/db";
const dest = process.argv[2];
await getDb().backup(dest);
console.log(`backed up to ${dest}`);
EOF
pnpm exec jiti backup-db.mjs ~/amr-backups/$(date +%Y%m%d-%H%M%S)/router.db
rm backup-db.mjs   # scratch file; do not commit it
```

Never back the key up into the git repository. `apps/*/data/` and `*.db` are
gitignored precisely because of this; keep the pair outside the repo, with
access limited like any other credential.

## 3. Restore

Restoring is only meaningful as a pair. Steps:

1. Stop the app. Two processes must not write the same file, and the running
   process caches the master key and the database handle in memory.

   ```bash
   docker compose stop app          # or stop your process manager unit
   ```

2. Put the pair back in place. For the file-key layout:

   ```bash
   cp "$RESTORE_DIR/router.db"  "$AMR_DATA_DIR/router.db"
   cp "$RESTORE_DIR/.secret"    "$AMR_DATA_DIR/.secret"
   chmod 600 "$AMR_DATA_DIR/.secret"
   rm -f "$AMR_DATA_DIR"/router.db-wal "$AMR_DATA_DIR"/router.db-shm
   # stale WAL/SHM from the previous life of this data dir would confuse SQLite
   ```

   If the deployment uses `AMR_SECRET` from the environment instead of the
   `.secret` file, restore by setting `AMR_SECRET` to the backed-up value; do
   not also drop in a `.secret` file, since a set `AMR_SECRET` silently wins
   and the file is never read.

3. Verify the restore before declaring success. A file that is present is not
   a file that works. The script below checks database integrity AND that
   every stored provider key decrypts under the master key in force, and
   exits 0 only when both pass. Write it INSIDE `apps/ai-model-router`
   (Node resolves `better-sqlite3` from the script's own directory, so a copy
   under `/tmp` cannot find the installed module):

   ```bash
   cd apps/ai-model-router
   cat > verify-restore.mjs <<'EOF'
   import crypto from "node:crypto";
   import fs from "node:fs";
   import Database from "better-sqlite3";

   const DATA_DIR = process.env.AMR_DATA_DIR ?? "./data";
   const secret = process.env.AMR_SECRET?.length >= 16
     ? process.env.AMR_SECRET
     : fs.readFileSync(`${DATA_DIR}/.secret`, "utf8").trim();
   const key = crypto.scryptSync(secret, "ai-model-router.v1", 32);
   const db = new Database(`${DATA_DIR}/router.db`, { readonly: true });

   const integrity = db.prepare("PRAGMA integrity_check").pluck().get();
   if (String(integrity).trim() !== "ok") {
     console.error(`integrity check failed: ${JSON.stringify(integrity)}`);
     process.exit(1);
   }

   const rows = db
     .prepare("SELECT slug, api_key_enc FROM providers WHERE api_key_enc != ''")
     .all();
   let bad = 0;
   for (const r of rows) {
     const p = r.api_key_enc.split(".");
     try {
       const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(p[1], "base64url"));
       d.setAuthTag(Buffer.from(p[2], "base64url"));
       Buffer.concat([d.update(Buffer.from(p[3], "base64url")), d.final()]);
     } catch {
       bad++;
       console.error(`cannot decrypt key for provider '${r.slug}'`);
     }
   }
   console.log(`integrity ok; ${rows.length} stored key(s), ${bad} unreadable`);
   process.exit(bad ? 1 : 0);
   EOF
   AMR_DATA_DIR=/var/lib/ai-model-router pnpm exec jiti verify-restore.mjs \
     && echo RESTORE VERIFIED || echo RESTORE FAILED
   rm verify-restore.mjs   # scratch file; do not commit it
   ```

   The double failure mode this catches: a database restored with the wrong
   master key passes the integrity check (the file is a perfect SQLite file)
   and fails only at decryption, and a torn copy fails integrity while its
   keys look fine. Both were reproduced while writing this guide. `jiti` is
   already in the dependency tree (Next and ESLint pull it in), so
   `pnpm exec jiti` resolves without installing anything.

4. Start the app and log in with the password that was in the restored
   database. Password hashes and session secrets live in the `settings` table
   inside `router.db`, so they restore with it.

## 4. Key rotation

Rotation re-encrypts every stored secret under a new master key. It exists as a
library function, `rotateMasterKey` in `src/lib/rotate.ts`; the repo ships no
CLI wrapper for it, so run it through `jiti` (already in the dependency tree)
from `apps/ai-model-router`.

The guarantees, from the code, before you trust them:

- The whole rotation runs inside one SQLite transaction. Any failure rolls
  everything back: a rotation cannot stop halfway and leave some rows on the
  old key and some on the new. A `RotationAbortedError` means nothing changed.
- Each re-encrypted row is read back out of the database and decrypted with the
  new key, and must round-trip byte for byte, before the transaction commits.
- `dryRun: true` performs the full work including verification and then rolls
  back deliberately, so it proves the real run can succeed without changing
  anything.

Procedure:

1. Back up first (section 2). Rotation rewrites every ciphertext row.

2. Dry run. Same environment the app runs with (same `AMR_DATA_DIR`, same
   `AMR_SECRET` if set). The runner script must live inside
   `apps/ai-model-router`: it imports `./src/lib/rotate`, and Node resolves
   relative imports from the script's own location:

   ```bash
   cd apps/ai-model-router
   cat > rotate-key.mjs <<'EOF'
   import fs from "node:fs";
   import { rotateMasterKey } from "./src/lib/rotate";
   import { DATA_DIR } from "./src/lib/paths";

   const dry = process.argv.includes("--dry-run");
   const r = rotateMasterKey({ dryRun: dry });

   if (dry) {
     console.log(`would rotate ${r.rotated} secret(s); ${r.skipped} row(s) store no key`);
   } else if (process.env.AMR_SECRET) {
     console.error("set AMR_SECRET to this value in your environment, then restart:");
     console.log(r.newSecret);
   } else {
     const file = `${DATA_DIR}/.secret`;
     fs.writeFileSync(file, r.newSecret + "\n", { mode: 0o600 });
     console.error(`new master key written to ${file}`);
   }
   EOF
   AMR_DATA_DIR=/var/lib/ai-model-router pnpm exec jiti rotate-key.mjs -- --dry-run
   ```

   Output on a healthy instance: `would rotate N secret(s); M row(s) store no
   key`. On a fresh install with no provider keys configured it says
   `would rotate 0 secret(s)`.

3. Real run. With `AMR_SECRET` set it prints the new master key; that output
   is the key, treat it accordingly (pipe to a file with mode 600, or set it
   in your secret manager immediately). The rotation itself only writes the
   database; persisting the new key is the operator's step:

   ```bash
   AMR_DATA_DIR=/var/lib/ai-model-router pnpm exec jiti rotate-key.mjs
   rm rotate-key.mjs   # scratch file; do not commit it
   ```

   Notes, verified against the code and by running it:

   - With `AMR_SECRET` set, rotation does NOT update the environment; you must
     update your secret manager and restart. Until you do, the app is still
     decrypting with the old key and every stored key is unreadable. Update the
     environment and restart immediately after step 3.
   - Without `AMR_SECRET`, the script writes the new key into
     `<AMR_DATA_DIR>/.secret` itself (it imports `DATA_DIR` from `paths.ts`,
     so it follows the same override the app follows), and the running app
     picks it up on next process start (the key is cached per process;
     restart to be sure).
   - The rotation refuses to run onto the same key it read from, and refuses
     keys shorter than 16 characters.
   - Sessions survive a rotation: session tokens are signed with a
     `session_secret` stored in the `settings` table, and rotation does not
     touch it (verified). Logins only break if you change `AMR_SECRET` and
     forget its new value, or delete the `session_secret` row.

4. Verify with the section 3 script: `integrity ok; N stored key(s), 0
   unreadable`.

If the rotation aborts partway (`RotationAbortedError`): the transaction has
already rolled back, the database is still entirely on the old key, and the old
master key is still valid. The error's `failures` array names the exact
`table#id.column` and reason. The most common cause is running it with a
different `AMR_SECRET` than the app uses, or a `.secret` file that does not
belong to this database. Re-run the dry run with the correct key; do not
"finish" a failed rotation by hand-decrypting rows, and do not restore the
pre-rotation backup over a rotation that actually succeeded (the message says
`rotated N`, not `aborted`). If the process is killed mid-run, the SQLite
transaction guarantee holds: whatever committed is consistent, so check the dry
run before deciding whether to re-run.

## 5. Log retention

Default policy, from `RETENTION_DEFAULTS` in `src/lib/retention.ts`: keep
`usage_events` rows for 30 days (`maxAgeDays`), and keep at most 10,000 rows
(`maxRows`). Rows past either limit are deleted. Prompts and responses are
stored redacted and truncated (emails, bearer tokens, card numbers and similar
are masked at write time, text is capped at 2000 chars), but the archive is
still a log of everything ever asked, which is why it expires.

There is no background timer: `applyRetention` runs only when something calls
it, and the only caller is `POST /api/retention`. It is an endpoint on purpose
("driven by whatever scheduler the deployment already has"). If you never call
it, the table grows forever.

Run a prune. It needs a session; log in first with curl and keep the cookie
file (`-c` saves it, `-b` sends it):

```bash
# log in once (12h cookie)
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth \
  -H 'content-type: application/json' \
  -d '{"password":"YOUR-PASSWORD"}'

# prune with the default policy (30 days, 10000 rows)
curl -X POST http://localhost:3000/api/retention \
  -H 'content-type: application/json' -d '{}' -b cookies.txt

# or custom bounds: 14 days, 5000 rows
curl -X POST http://localhost:3000/api/retention \
  -H 'content-type: application/json' \
  -d '{"maxAgeDays":14,"maxRows":5000}' -b cookies.txt
```

Response: `{"deletedByAge":N,"deletedByCount":M,"deleted":N+M}`. To fetch the
current policy: `curl http://localhost:3000/api/retention -b cookies.txt`.
Either bound can be skipped by passing a negative value; `0` for `maxRows`
deletes all rows.

Schedule it, e.g. a nightly cron on the host. The cookie expires every 12
hours, so the cron must log in first, then prune:

```cron
17 3 * * *  cd /opt/ai-computer/apps/ai-model-router && curl -s -c /tmp/amr-cookies.txt -X POST http://localhost:3000/api/auth -H 'content-type: application/json' -d '{"password":"YOUR-PASSWORD"}' && curl -s -X POST http://localhost:3000/api/retention -H 'content-type: application/json' -d '{}' -b /tmp/amr-cookies.txt
```

(If putting the password in crontab is not acceptable there, a two-line
`jiti` script run under the app's env vars calling
`applyRetention(getDb())` is equivalent and needs no auth; both functions are
exported from `src/lib/retention.ts` and `src/lib/db.ts`.)

## 6. Upgrades

The app migrates its own schema on startup: `getDb()` in `src/lib/db.ts` runs
`CREATE TABLE IF NOT EXISTS ...` statements and seeds once, guarded by the
`seeded_v1` settings key. There is no separate migration step to run; the only
schema operation the code performs is additive (`IF NOT EXISTS`), so upgrading
means restarting on the new code, and the risk to plan around is a rollback
(see the end of this section).

Upgrade procedure:

1. Back up (section 2). The schema guard means an old binary can always open a
   new database, but a NEW binary opening an OLD database is the risky
   direction, and you want the pair to roll back to.
2. Fetch and build the new code:

   ```bash
   cd apps/ai-model-router
   git pull
   pnpm install --frozen-lockfile
   pnpm build
   ```

   `better-sqlite3` is a native module tied to the Node ABI: if the Node
   version changed since the last install, `pnpm install` rebuilds it, and a
   mismatch shows up as `Could not locate the bindings file` at boot.
3. Restart and verify:

   ```bash
   AMR_DATA_DIR=/var/lib/ai-model-router pnpm start &
   curl -s http://localhost:3000/api/auth   # {"configured":true,...} means up
   ```

   With Docker: `docker compose up -d --build`. The named volume `amr-data`
   survives the container replacement, so the database and `.secret` carry
   over; `AMR_SECRET` from `.env` must stay the same value or the stored keys
   become unreadable.
4. Run the section 3 verification after any upgrade that touched `crypto.ts`,
   `rotate.ts`, or `db.ts`.

Rollback: stop, restore the backup pair (section 3), start the previous image
or commit. The schema guard makes a downgrade safe only if the new version did
not add columns; when in doubt, restore the database backup too.

## 7. Security checklist before exposing the app to the internet

The app holds live provider API keys and an archive of prompts. Before it is
reachable beyond localhost, go through this in order:

1. Password set (section 1). Until then every route is open, including the
   ones that read provider keys. Verify: `curl -s
   http://your-host:3000/api/auth` returns `"configured":true`, and `curl -i
   http://your-host:3000/api/providers` without a cookie returns 401.
2. `AMR_SECRET` set from your secret manager, not the auto-generated file,
   and backed up (section 2).
3. TLS in front. The session cookie is marked `secure` only when
   `NODE_ENV=production`, and it is `httpOnly` + `sameSite=lax`. Plain HTTP in
   production sends that cookie in the clear; terminate TLS at a reverse proxy
   or the platform.
4. Retention scheduled (section 5). Otherwise the prompt archive grows
   forever.
5. Backups on a schedule, not just once, and one restore rehearsal done
   (section 3). An untested backup is a hypothesis.
6. The lockout policy is on by default (exponential backoff after repeated
   login failures: no delay for the first two, then 2s doubling to a 5 minute
   cap, persisted in the database so a restart does not clear it), but it is
   rate limiting, not a substitute for TLS or for picking a long password.
7. Provider base URLs are user input the server fetches; `src/lib/url-guard.ts`
   blocks private addresses and cloud metadata endpoints, and its own header
   documents that DNS rebinding is not fully closed. Keep the instance behind
   auth and do not expose it wider than needed.

## 8. Troubleshooting

Symptoms are what you actually see; causes are what the code does.

### Container dies on first write (permissions)

Symptom: the container never becomes healthy, and the logs show `unable to
open database file` (reproduced by pointing `AMR_DATA_DIR` at a read-only
directory; the error is better-sqlite3's, raised by `getDb()`). It can look
like a boot crash: the home page and even `/api/auth` open the database (the
auth check reads the `settings` table), so an unwritable data dir fails the
healthcheck itself, not just some later write.

Cause: `getDb()` creates the data dir and opens the database as the process
user. In the Docker image that user is `node` (uid 1000); a bind-mounted host
directory owned by root, or a read-only mount, makes that open fatal.

Fix, pick one:

- Use the compose named volume (`amr-data:/data`), which the image chowns to
  `node` at build time. This is the default and the usual answer.
- For a bind mount: `chown -R 1000:1000 /srv/amr-data` on the host, and make
  sure it is mounted rw.
- Do not run the container as root to work around it.

The same error on a bare-metal install means the user running `pnpm start`
cannot write `AMR_DATA_DIR` (or `./data` by default).

### Forgotten password

The password is a scrypt hash in the `settings` table (key `auth_password`);
there is no reset endpoint, and that is deliberate. Recovery is: delete the
hash row, and set a new one on next visit.

```bash
sqlite3 "$AMR_DATA_DIR/router.db" "DELETE FROM settings WHERE key='auth_password';"
```

Verified on a running instance: after the delete, `/api/auth` reports
`"configured":false`, the login screen flips back to setup mode, and `PUT
/api/auth` accepts a new password. The stored provider keys and history are
untouched. Anyone with write access to the database file can do this, which is
another reason the data dir must not be world-writable.

Two related rows in `settings`: `auth_failures` (the lockout counter; delete
it to clear a lockout instantly instead of waiting out the backoff) and
`session_secret` (do NOT delete; deleting it invalidates all sessions, which
is harmless, but it is auto-recreated so there is nothing to gain).

### Corrupted database

Symptom: `PRAGMA integrity_check` reports anything other than `ok`, or queries
fail with `database disk image is malformed` (reproduced by flipping bytes in
a copy; the app raises the same error on boot).

1. Stop the app.
2. Assess: `sqlite3 "$AMR_DATA_DIR/router.db" "PRAGMA integrity_check;"`.
3. If you have backups, do not repair: restore the most recent pair
   (section 3). Repair is strictly worse than a known-good copy.
4. If you have no backup, salvage what is readable:

   ```bash
   sqlite3 "$AMR_DATA_DIR/router.db" ".recover" > /tmp/recovered.sql
   sqlite3 /tmp/rebuilt.db < /tmp/recovered.sql
   sqlite3 /tmp/rebuilt.db "PRAGMA integrity_check;"
   ```

   `.recover` reads every page it can and emits SQL; what it cannot read is
   gone. Move `rebuilt.db` into place as `router.db` (keep the same `.secret`),
   start the app, and expect missing rows rather than a silent failure. In the
   degraded-but-readable case `.recover` may emit only a handful of rows for a
   table; verify row counts per table against your expectations before
   trusting the rebuild.
5. Re-verify stored keys with the section 3 script; a rebuild that drops
   `providers` rows drops their keys with them, and those must be re-entered
   by hand.

### Other quick checks

- 401 from the API with a cookie present: the cookie is expired (12h TTL) or
  the `session_secret` row changed. Log in again. Middleware only checks that
  a cookie exists; the route re-verifies the signature, so a forged cookie
  gets 401 at the route, not at the redirect.
- Stored provider keys suddenly unreadable (blank key preview, provider tests
  failing auth): the master key in force does not match the one the rows were
  encrypted with. Check `AMR_SECRET` vs `.secret` (env wins when set and at
  least 16 chars). Fix by restoring the matching key; if the old key is lost,
  the keys are unrecoverable and must be re-entered.
- `Could not locate the bindings file` at boot: `better-sqlite3` native build
  mismatch, almost always a Node version change. `pnpm install` (or rebuild
  the image) fixes it.
- Login returns 429 with "Too many attempts": the lockout backoff. Wait, or
  delete the `auth_failures` settings row above.

## Reference: what the app actually checks (source of truth)

- Paths and env: `src/lib/paths.ts` (real names: `AMR_DATA_DIR`, `AMR_DB_PATH`)
- Master key, encrypt/decrypt format: `src/lib/crypto.ts` (`v1.<iv>.<tag>.<ct>`,
  AES-256-GCM, scrypt salt `ai-model-router.v1`)
- Rotation and its atomicity: `src/lib/rotate.ts`
- Password, lockout, sessions: `src/lib/auth.ts`, `src/app/api/auth/route.ts`
- Retention: `src/lib/retention.ts`, `src/app/api/retention/route.ts`
- Middleware (coarse filter only): `src/middleware.ts`
- Schema and WAL: `src/lib/db.ts`

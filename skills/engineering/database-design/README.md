# Database Design

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Rules for designing schemas and writing migrations so that correctness lives in the database rather than in whichever application code path happens to run.

## What it does

This skill covers the decisions that are expensive to reverse once production data exists:

- Declaring real constraints (`NOT NULL`, `UNIQUE`, `CHECK`, foreign keys with explicit `ON DELETE`) instead of trusting application validation
- Writing migrations that can actually be rolled back, and using expand/contract when they cannot
- Indexing what queries filter, sort, and join on, and finding indexes nothing uses
- Picking correct types for money (integer minor units or `numeric`, never float) and time (`timestamptz` in UTC, `date` for calendar dates)
- Deciding soft delete vs hard delete per table, with the partial unique index that soft delete requires
- Treating NULL as "unknown", not as "empty", and denormalising only with a written owner and a reconciliation job
- SQLite connection pragmas (`WAL`, `foreign_keys`, `busy_timeout`) and `STRICT` tables

The guiding principle: application-level validation is bypassed by the next backfill script someone writes at 3am, so anything you depend on must be a constraint.

## When to use this

Load this skill when you are about to:

- Create a new table or add columns to an existing one
- Write any migration file, especially one containing `DROP`, a type change, or `NOT NULL`
- Store an amount of money, a price, a rate, or a currency
- Store a timestamp, a due date, or a birthday
- Add a `deleted_at` column or implement "archive" behaviour
- Add an index because a query is slow, or remove indexes to speed up writes
- Duplicate a value into a second table for performance (a count, a cached name, a total)
- Set up a SQLite database for an embedded or single-node app

Symptoms that mean you needed this skill and did not use it:

- Two rows exist where business logic says only one may be active
- Totals do not reconcile by a few cents
- A report shifts by a day for users in another timezone
- A deleted user cannot re-register because the old row still occupies the email
- A migration succeeded in staging and locked the table for minutes in production
- Foreign keys "do nothing" in SQLite

## Quick start

A worked example: adding subscriptions to an existing Postgres app, then migrating an existing `invoice.total` float column to integer cents without data loss.

### Step 1: Create the table with the constraints included

Constraints go in the `CREATE TABLE`, not in a follow-up ticket.

```sql
-- migrations/0042_create_subscription.up.sql
CREATE TABLE subscription (
    id              bigserial   PRIMARY KEY,
    account_id      bigint      NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
    plan            text        NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    seats           integer     NOT NULL CHECK (seats > 0),
    price_cents     bigint      NOT NULL CHECK (price_cents >= 0),
    currency        char(3)     NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz,
    CONSTRAINT subscription_period_valid
        CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- "only one active subscription per account" cannot be enforced in app code
CREATE UNIQUE INDEX subscription_one_active_per_account
    ON subscription (account_id) WHERE ended_at IS NULL;

-- foreign key columns need their own index for the parent-side DELETE and joins
CREATE INDEX subscription_account_started
    ON subscription (account_id, started_at DESC);
```

The matching down migration is trivial here, which is the signal that this migration is safe:

```sql
-- migrations/0042_create_subscription.down.sql
DROP TABLE subscription;
```

### Step 2: Verify the constraints actually bite

Do not assume. Try to violate each one.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 <<'SQL'
INSERT INTO subscription (account_id, plan, seats, price_cents, currency)
VALUES (1, 'gold', 5, 1000, 'USD');            -- expect: CHECK violation on plan
INSERT INTO subscription (account_id, plan, seats, price_cents, currency)
VALUES (1, 'pro', 5, 1000, 'USD');             -- ok, first active row
INSERT INTO subscription (account_id, plan, seats, price_cents, currency)
VALUES (1, 'pro', 5, 1000, 'USD');             -- expect: unique index violation
SQL
```

### Step 3: Migrate the float money column using expand/contract

`invoice.total` is a `double precision`. You cannot fix that in one migration, because narrowing and overwriting are irreversible. Split it across four deploys.

```sql
-- deploy 1, expand: nullable, no behaviour change, trivially reversible
ALTER TABLE invoice ADD COLUMN total_cents bigint;
-- down: ALTER TABLE invoice DROP COLUMN total_cents;
```

Deploy 2 ships application code that writes both `total` and `total_cents` on every insert and update, then backfills history in batches:

```bash
# batched backfill, one bounded transaction per chunk
LO=0
MAX=$(psql -At "$DATABASE_URL" -c 'SELECT max(id) FROM invoice')
while [ "$LO" -le "$MAX" ]; do
  HI=$((LO + 10000))
  psql "$DATABASE_URL" -c "
    UPDATE invoice SET total_cents = round(total * 100)
     WHERE total_cents IS NULL AND id >= $LO AND id < $HI;"
  LO=$HI
done
```

Reconcile before trusting it:

```sql
SELECT count(*) AS mismatched
  FROM invoice
 WHERE total_cents IS DISTINCT FROM round(total * 100)::bigint;
-- must be 0 before moving on
```

Deploy 3 switches every read to `total_cents` and adds the constraint now that the column is fully populated:

```sql
ALTER TABLE invoice ALTER COLUMN total_cents SET NOT NULL;
ALTER TABLE invoice ADD CONSTRAINT invoice_total_nonneg CHECK (total_cents >= 0);
```

Deploy 4, after a full release cycle with no reads of the old column:

```sql
ALTER TABLE invoice DROP COLUMN total;
```

### Step 4: Add indexes only for queries that exist, and build them concurrently

```sql
-- the actual hot query: equality on account_id, sort on created_at
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, account_id, total_cents, created_at
  FROM event WHERE account_id = 42 ORDER BY created_at DESC LIMIT 50;

CREATE INDEX CONCURRENTLY idx_event_account_created
    ON event (account_id, created_at DESC);

-- re-run the EXPLAIN and confirm the plan changed before keeping the index
```

Then find indexes nobody uses, once statistics have accumulated:

```sql
SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan AS scans,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
 WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
 ORDER BY pg_relation_size(s.indexrelid) DESC;
```

Check every replica before dropping: an index unused on the primary may be serving a read replica's reports.

### Step 5 (SQLite only): set pragmas on every connection

```python
import sqlite3

def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, isolation_level=None)
    conn.execute("PRAGMA journal_mode = WAL")     # persists in the file
    conn.execute("PRAGMA synchronous  = NORMAL")  # safe with WAL
    conn.execute("PRAGMA foreign_keys = ON")      # OFF by default, per connection
    conn.execute("PRAGMA busy_timeout = 5000")    # wait instead of SQLITE_BUSY
    return conn
```

## Key concepts

**Constraint over convention.** If a rule matters, it is a `CHECK`, a `UNIQUE`, or a foreign key. A comment, a code review note, and a model validator all get bypassed eventually.

**Reversibility as a design test.** Write the down migration first. If you cannot write one, the operation is irreversible (`DROP COLUMN`, `DROP TABLE`, narrowing a type, in-place `UPDATE`, adding `NOT NULL` with a defaulting backfill) and belongs in expand/contract instead.

**Expand/contract.** Four separate deploys: add nullable, dual-write plus backfill, switch reads, drop the old. Each step is individually reversible even though the whole change is not.

**Partial unique indexes.** The tool for "only one active X" and for soft delete. A plain `UNIQUE` counts deleted rows; `WHERE deleted_at IS NULL` does not.

**Indexes are a write tax.** Every index is paid for on every `INSERT`, `UPDATE`, and `DELETE`. An unused index is pure throughput loss. Composite column order is equality, then range, then sort.

**NULL means unknown, not empty.** NULL propagates through comparisons and aggregates: `count(col)` skips it and `col <> 'x'` excludes it silently. Use `IS DISTINCT FROM` for nullable comparisons, and `NOT NULL DEFAULT ''` when the field is genuinely empty.

**Soft delete does not satisfy erasure.** The personal data is still stored. Pair it with a hard-delete or anonymisation job that keeps the accounting figures and nulls the identifying fields.

## Common pitfalls

**Money in a float**

```sql
-- bad: 0.10 is not representable in binary floating point, errors compound
total  double precision NOT NULL

-- good: integer minor units, plus the currency code beside it
amount_cents  bigint  NOT NULL CHECK (amount_cents >= 0),
currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$')
```

**Naive timestamps**

```sql
-- bad: discards the offset, reinterpreted by whatever the session timezone is
created_at timestamp NOT NULL

-- good: timezone-aware instant, converted to local time only for display
created_at timestamptz NOT NULL DEFAULT now(),
-- and a calendar date with no instant meaning stays a date
due_date   date        NOT NULL
```

**Uniqueness checked in application code**

```python
# bad: loses every race, two concurrent requests both see "available"
if not db.query(Account).filter_by(email=email).first():
    db.add(Account(email=email))
```

```sql
-- good: the database decides, the app handles the conflict
CREATE UNIQUE INDEX account_email_live
    ON account (lower(email)) WHERE deleted_at IS NULL;
```

**Foreign keys with no explicit delete action**

```sql
-- bad: the default silently becomes an orphan-row bug
account_id bigint NOT NULL REFERENCES account(id)

-- good: state the intent
account_id bigint NOT NULL REFERENCES account(id) ON DELETE RESTRICT
```

**One giant backfill**

```sql
-- bad: holds locks and bloats the transaction log until the table is unusable
UPDATE invoice SET total_cents = round(total * 100);

-- good: bounded batches, one short transaction each
UPDATE invoice SET total_cents = round(total * 100)
 WHERE total_cents IS NULL AND id >= :lo AND id < :hi;
```

**`CREATE INDEX` in production**

```sql
-- bad: takes a write lock for the duration of the build
CREATE INDEX idx_event_account ON event (account_id);

-- good: no write lock (cannot run inside a transaction block)
CREATE INDEX CONCURRENTLY idx_event_account ON event (account_id);
```

**`SELECT *` in application queries**

```sql
-- bad: what your code receives changes the moment a column is added or reordered,
-- and a new blob column quietly joins every hot query's payload
SELECT * FROM account WHERE id = $1;

-- good
SELECT id, email, display_name, created_at FROM account WHERE id = $1;
```

**Denormalised column with no owner**

```sql
ALTER TABLE thread ADD COLUMN reply_count integer NOT NULL DEFAULT 0;

-- bad: updated from four call sites, drifts, nobody knows which value is true
-- good: one maintainer, documented, reconciled
COMMENT ON COLUMN thread.reply_count IS
  'Denormalised count of message rows. Maintained by trigger trg_message_count. '
  'Reconciled nightly by jobs/reconcile_reply_count.';
```

**Multiple SQLite writer threads**

```python
# bad: one write lock exists for the whole database, extra writers only get SQLITE_BUSY
ThreadPoolExecutor(max_workers=8).map(write_row, rows)

# good: serialise writes through one connection, and wait out contention
conn.execute("PRAGMA busy_timeout = 5000")
for row in rows:
    write_row(conn, row)
```

## See also

- `SKILL.md` in this directory: the full rule set with the reasoning behind each rule
- `../sql-optimization/SKILL.md`: making existing queries faster, reading `EXPLAIN` output in depth
- `../api-design/SKILL.md`: exposing these entities over HTTP without leaking schema details
- `../../security/security-audit/SKILL.md`: tenancy isolation, access control, and erasure requests
- `../test-strategy/SKILL.md`: testing migrations and constraints against realistic data

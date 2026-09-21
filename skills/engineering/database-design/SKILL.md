---
name: database-design
description: "Use when designing a schema or writing a migration. Enforce constraints in the database, reversible migrations, correct types for money and time, and deliberate indexing."
---

# Database Design

## Put the real constraints in the schema

Declare every rule you actually depend on as a database constraint, because application-level
validation is bypassed by the next backfill script someone writes at 3am.

```sql
CREATE TABLE subscription (
    id              bigserial PRIMARY KEY,
    account_id      bigint      NOT NULL REFERENCES account(id) ON DELETE RESTRICT,
    plan            text        NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    seats           integer     NOT NULL CHECK (seats > 0),
    price_cents     bigint      NOT NULL CHECK (price_cents >= 0),
    started_at      timestamptz NOT NULL,
    ended_at        timestamptz,
    CONSTRAINT subscription_period_valid CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE UNIQUE INDEX subscription_one_active_per_account
    ON subscription (account_id) WHERE ended_at IS NULL;
```

Rules:

- Mark a column `NOT NULL` unless you can state what NULL means there, because a nullable
  column silently invites half-written rows.
- Add `UNIQUE` for every identity you assume is unique (email, slug, external id), because
  "we check before insert" loses every race.
- Add `CHECK` for enums, ranges, and sign constraints, because an out-of-range value found in
  production is unreparable without guessing intent.
- Declare foreign keys with an explicit `ON DELETE` action (`RESTRICT`, `CASCADE`, `SET NULL`),
  because the default silently becomes an orphan-row bug.
- Use a partial unique index for "only one active X" rules, because that rule cannot be
  enforced in application code without locking the whole table.

## Every migration needs a tested rollback

Write the down migration at the same time as the up migration and run it once locally against
a copy with real data, because an untested rollback is a rollback you do not have.

Irreversible operations (no down migration can restore them):

- `DROP COLUMN`, `DROP TABLE`: the data is gone.
- Narrowing a type (`text` to `varchar(50)`, `bigint` to `integer`): truncated or overflowed
  values cannot be recovered.
- `UPDATE` that overwrites a column in place without keeping the prior value.
- Adding `NOT NULL` with a defaulting backfill: the original NULL/unknown state is lost.

For anything irreversible, use expand/contract across separate deploys instead of one migration:

1. **Expand**: add the new column nullable, no behaviour change.
2. **Backfill**: write both old and new from application code, batch-backfill history.
3. **Switch reads**: point queries at the new column, keep writing both.
4. **Contract**: after a full release cycle with no reads of the old column, drop it.

```sql
-- step 1, safe and reversible
ALTER TABLE invoice ADD COLUMN total_cents bigint;

-- step 2, batched so it does not hold one long transaction
UPDATE invoice SET total_cents = round(total * 100)
 WHERE total_cents IS NULL AND id BETWEEN :lo AND :hi;

-- step 4, only after nothing reads the old column
ALTER TABLE invoice DROP COLUMN total;
```

- Backfill in batches with an explicit id range, because a single `UPDATE` over millions of
  rows holds locks and bloats the transaction log until the table is unusable.
- Never combine a schema change and a data change in one migration, because a partial failure
  leaves the schema in a state the down migration was not written for.

## Index what you filter, sort, and join on

Add an index only when a real query needs it, because every index is paid for on every
`INSERT`, `UPDATE`, and `DELETE`: an unused index is pure write-throughput loss with no gain.

- Index foreign key columns, because the parent-side `DELETE` and every join scan the child
  table without one.
- Order composite index columns as equality first, then range, then sort, because the index
  can only be scanned in that order.
- Verify with `EXPLAIN (ANALYZE, BUFFERS)` before and after, because index choice is decided
  by the planner's statistics, not by intuition.

Find unused indexes (Postgres), reading it only after stats have accumulated since the last
`pg_stat_reset()` and checking every replica, because an index unused on the primary may serve
a read replica's reports:

```sql
SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan AS scans,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
 WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
 ORDER BY pg_relation_size(s.indexrelid) DESC;
```

Build concurrently in production, because a plain `CREATE INDEX` takes a write lock:

```sql
CREATE INDEX CONCURRENTLY idx_event_account_created
    ON event (account_id, created_at DESC);
```

## Never SELECT *

List columns explicitly in application queries, because `SELECT *` changes what your code
receives the moment someone adds or reorders a column, and the failure shows up as wrong data
rather than an error. Explicit columns also stop a newly added large column (a blob, a JSON
payload) from quietly joining every hot query's payload.

```sql
SELECT * FROM account WHERE id = $1;                              -- no
SELECT id, email, display_name, created_at FROM account WHERE id = $1;  -- yes
```

## Money is never a float

Store currency as integer minor units (`bigint` cents) or as `numeric(19, 4)`, never
`float`/`double`, because binary floating point cannot represent 0.10 exactly and the rounding
error compounds into totals that do not reconcile.

```sql
amount_cents  bigint        NOT NULL CHECK (amount_cents >= 0),
currency      char(3)       NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
unit_price    numeric(19,4) NOT NULL   -- when fractional rates matter
```

- Always store the currency code beside the amount, because a bare number is unusable the day
  a second currency appears.
- Pick minor units when you only add and subtract, `numeric` when you multiply by rates and
  need defined rounding.

## Timestamps in UTC, timezone-aware, converted at the edges

Store every instant as `timestamptz` (Postgres) or UTC ISO-8601 text (SQLite) and convert to
local time only in the presentation layer, because a naive timestamp is ambiguous twice a year
during DST transitions and unrecoverable afterwards: `created_at timestamptz NOT NULL DEFAULT now()`.

- Use `timestamptz`, not `timestamp`, because `timestamp` discards the offset and silently
  reinterprets the value using whatever the session timezone happens to be.
- Store a calendar date with no instant meaning (a birthday, an invoice due date) as `date`,
  because forcing it through a timezone shifts it by a day.

## Soft delete vs hard delete

Choose deliberately per table and write the choice down, because each option breaks something
different.

Soft delete (`deleted_at timestamptz`):

- Keeps history and lets you undo, but every single query must filter `deleted_at IS NULL`,
  and the one that forgets leaks deleted rows.
- Breaks plain `UNIQUE`: a deleted row still occupies the email. Use a partial unique index so
  the constraint applies to live rows only.

```sql
CREATE UNIQUE INDEX account_email_live
    ON account (lower(email)) WHERE deleted_at IS NULL;
```

- Does **not** satisfy a deletion/erasure request, because the personal data is still stored.
  Pair it with a hard-delete or anonymisation job.

Hard delete:

- Satisfies privacy erasure and keeps constraints simple, but destroys audit trail and breaks
  foreign keys pointing at the row (choose `ON DELETE CASCADE` or `SET NULL` explicitly).
- Preserve what you need for accounting by writing an anonymised record first (keep the order
  totals, null the name and email), because financial history usually must survive erasure.

## Nullable means unknown, not empty

Never use NULL to represent an empty value, because NULL propagates through comparisons and
aggregates in a way an empty string does not, and the resulting wrong answers look plausible.

```sql
SELECT count(*) FROM account;              -- counts every row
SELECT count(middle_name) FROM account;    -- skips NULLs, easy to misread
SELECT * FROM account WHERE nickname <> 'x';  -- NULL nicknames silently excluded
```

- Define per column whether NULL is legal and what it means ("not yet measured", "does not
  apply"), because the meaning must be unambiguous.
- Prefer `NOT NULL DEFAULT ''` for an optional text field that is genuinely "empty", so
  ordinary comparisons behave.
- Use `IS DISTINCT FROM` when comparing nullable columns, because `<>` returns NULL rather
  than true when either side is NULL.

## Denormalise only with a written reason and a sync plan

Keep the schema normalised by default and record, in a comment on the column, why a duplicate
exists and what keeps it correct, because a redundant copy with no owner drifts and nobody can
tell which value is true.

```sql
ALTER TABLE thread ADD COLUMN reply_count integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN thread.reply_count IS
  'Denormalised count of message rows. Maintained by trigger trg_message_count. '
  'Reconciled nightly by jobs/reconcile_reply_count.';
```

- Maintain the copy in a trigger or in one single code path, never in several call sites,
  because multi-site updates are where drift starts.
- Ship a reconciliation job that recomputes from source and reports differences, because
  without one you will never learn the copy went wrong.

## SQLite specifics

For an embedded or single-node app, set these at every connection open, because SQLite's
defaults are tuned for maximum compatibility rather than for a concurrent application.

```sql
PRAGMA journal_mode = WAL;        -- readers do not block the writer, persists in the file
PRAGMA synchronous  = NORMAL;     -- safe with WAL, much faster than FULL
PRAGMA foreign_keys = ON;         -- OFF by default, per connection, every time
PRAGMA busy_timeout = 5000;       -- wait instead of failing instantly on SQLITE_BUSY
```

- Enable WAL once per database (it is stored in the file), because it lets concurrent readers
  proceed during a write instead of blocking.
- Treat SQLite as single-writer: serialise writes through one connection or one queue, because
  there is exactly one write lock for the whole database and extra writer threads only produce
  `SQLITE_BUSY`.
- Set `PRAGMA foreign_keys = ON` on every connection, because it defaults to OFF and your
  foreign keys are otherwise decorative.
- Set `busy_timeout` above zero, because the default fails immediately on contention rather
  than waiting for the short-lived write lock to clear.
- Remember WAL needs the database directory to be writable (it creates `-wal` and `-shm`
  files) and does not work on a network filesystem.
- Add `STRICT` to new tables (`CREATE TABLE job (id integer PRIMARY KEY, payload text NOT NULL,
  created_at text NOT NULL) STRICT;`) so declared types are enforced, because SQLite otherwise
  stores any value in any column.

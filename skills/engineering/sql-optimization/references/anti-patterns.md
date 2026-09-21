# SQL Anti-Patterns Reference

Common SQL mistakes that kill performance, with fixes.

## 1. SELECT * in production code

**Anti-pattern:**
```sql
SELECT * FROM users WHERE email = 'test@example.com';
```

**Why it's bad:**
- Fetches columns you don't need (wasted I/O)
- Breaks when table schema changes
- Prevents covering indexes

**Fix:**
```sql
SELECT id, email, created_at FROM users WHERE email = 'test@example.com';
```

## 2. N+1 queries

**Anti-pattern:**
```python
users = db.query("SELECT id, name FROM users")
for user in users:
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user.id}")
```

1 query + N queries = N+1 total queries.

**Fix with JOIN:**
```sql
SELECT u.id, u.name, o.id AS order_id, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
```

**Fix with IN clause:**
```python
user_ids = [u.id for u in users]
orders = db.query(f"SELECT * FROM orders WHERE user_id IN ({','.join(map(str, user_ids))})")
```

## 3. OR in WHERE clause preventing index use

**Anti-pattern:**
```sql
SELECT * FROM products 
WHERE category_id = 5 OR featured = true;
```

The OR prevents the index on `category_id` from being fully used.

**Fix (when possible):**
```sql
SELECT * FROM products WHERE category_id = 5
UNION
SELECT * FROM products WHERE featured = true;
```

Or add a composite index on `(category_id, featured)`.

## 4. Leading wildcards in LIKE

**Anti-pattern:**
```sql
SELECT * FROM users WHERE email LIKE '%@gmail.com';
```

Leading wildcard forces a full table scan (index can't be used).

**Fix:**
- Full-text search index (Postgres: GIN, MySQL: FULLTEXT)
- Trigram index (Postgres pg_trgm)
- Or rethink the query: can you filter by domain in a separate indexed column?

## 5. Functions on indexed columns

**Anti-pattern:**
```sql
SELECT * FROM orders WHERE YEAR(created_at) = 2024;
```

The `YEAR()` function prevents the index on `created_at` from being used.

**Fix:**
```sql
SELECT * FROM orders 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2025-01-01';
```

Now the index works.

## 6. NOT IN with NULLs

**Anti-pattern:**
```sql
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned_users);
```

If `banned_users.user_id` contains NULL, the NOT IN returns zero rows (SQL tri-value logic).

**Fix:**
```sql
SELECT * FROM users WHERE id NOT IN (
  SELECT user_id FROM banned_users WHERE user_id IS NOT NULL
);
```

Or use LEFT JOIN:
```sql
SELECT u.* FROM users u
LEFT JOIN banned_users b ON u.id = b.user_id
WHERE b.user_id IS NULL;
```

## 7. Implicit type conversion

**Anti-pattern:**
```sql
-- user_id is VARCHAR
SELECT * FROM users WHERE user_id = 12345;
```

The database converts every `user_id` to INT for comparison (full table scan).

**Fix:**
```sql
SELECT * FROM users WHERE user_id = '12345';
```

Match the column type exactly.

## 8. OFFSET pagination on large datasets

**Anti-pattern:**
```sql
SELECT * FROM products ORDER BY id LIMIT 50 OFFSET 10000;
```

The database still scans 10,050 rows and throws away the first 10,000.

**Fix (keyset pagination):**
```sql
SELECT * FROM products WHERE id > 10000 ORDER BY id LIMIT 50;
```

Use the last seen ID from the previous page.

## 9. COUNT(*) on huge tables

**Anti-pattern:**
```sql
SELECT COUNT(*) FROM logs;  -- 500M rows
```

Takes forever. Do you really need the exact count?

**Fixes:**
- **Approximate:** `EXPLAIN SELECT * FROM logs` (Postgres shows estimate)
- **Cached:** Store count in a summary table, update via trigger
- **Windowed:** `SELECT COUNT(*) FROM logs WHERE created_at > NOW() - INTERVAL '1 day'`

## 10. Missing composite index for multi-column WHERE

**Anti-pattern:**
```sql
SELECT * FROM orders WHERE user_id = 123 AND status = 'shipped';
-- Index only on user_id
```

The index on `user_id` narrows it down, but then full scan on status.

**Fix:**
```sql
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

Order matters: most selective column first (usually the equality filter).

## 11. Using DISTINCT to hide duplicates from bad JOINs

**Anti-pattern:**
```sql
SELECT DISTINCT u.email FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total > 100;
```

If a user has 10 orders over $100, the JOIN produces 10 rows, then DISTINCT throws away 9.

**Fix:**
```sql
SELECT u.email FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 100);
```

Or use `LIMIT 1` in a subquery if you just need to know existence.

## 12. Storing JSON when you need to query it

**Anti-pattern:**
```sql
-- metadata column is JSON: {"tags": ["urgent", "customer"]}
SELECT * FROM tickets WHERE metadata LIKE '%urgent%';
```

Full table scan, and false positives ("non-urgent" matches).

**Fix:**
- PostgreSQL: JSON operators + GIN index
  ```sql
  CREATE INDEX idx_metadata_tags ON tickets USING GIN ((metadata->'tags'));
  SELECT * FROM tickets WHERE metadata->'tags' ? 'urgent';
  ```
- Or normalize: `tags` table with `ticket_id, tag_name`.

## 13. Subquery in SELECT list (runs once per row)

**Anti-pattern:**
```sql
SELECT 
  u.name,
  (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count
FROM users u;
```

The subquery runs N times (once per user).

**Fix (LEFT JOIN + GROUP BY):**
```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

## 14. UPDATE without WHERE (accidental mass update)

**Anti-pattern:**
```sql
UPDATE users SET status = 'active';  -- forgot WHERE clause
```

Every row updated. Oops.

**Fix:**
- Always test with SELECT first:
  ```sql
  SELECT * FROM users WHERE id = 123;
  UPDATE users SET status = 'active' WHERE id = 123;
  ```
- Use transactions: `BEGIN; UPDATE ...; SELECT * FROM ...; ROLLBACK;` (test), then `COMMIT;`

## 15. No indexes on foreign keys

**Anti-pattern:**
```sql
CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id)
);
-- No index on user_id
```

Deleting a user requires a full scan of `orders` to check for references.

**Fix:**
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

PostgreSQL doesn't auto-index foreign keys (MySQL InnoDB does).

## Quick wins

1. Run `EXPLAIN ANALYZE` before and after every optimization
2. Add indexes to foreign keys
3. Use covering indexes (index contains all SELECT columns)
4. Avoid SELECT *, functions on indexed columns, leading wildcards
5. Keyset pagination over OFFSET
6. Cache expensive aggregates
7. Normalize JSON when you need to query inside it
8. Test destructive queries in transactions first

## Tools

- **Postgres:** `pg_stat_statements`, `auto_explain`, `pg_stat_user_tables` (shows seq scans)
- **MySQL:** Slow query log, `SHOW PROFILE`, `pt-query-digest` (Percona Toolkit)
- **SQLite:** `EXPLAIN QUERY PLAN`, `.eqp on` (auto-explain in sqlite3 CLI)

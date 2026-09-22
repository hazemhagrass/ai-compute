# Postgres MCP server

Direct Postgres access for an agent: schema inspection, `EXPLAIN` plans, health
checks, and — only when you have deliberately opted in — query execution.

## Which server

The original `@modelcontextprotocol/server-postgres` is **archived**. It now
lives under `modelcontextprotocol/servers-archived` and receives no fixes. Do
not install it.

Maintained options:

| Server | Use it when |
|---|---|
| [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp) (Postgres MCP Pro) | Any self-hosted or managed Postgres. Adds index tuning, `EXPLAIN` with hypothetical indexes, `pg_stat_statements` top-queries, and database health checks. This is the default choice. |
| [`supabase-community/supabase-mcp`](https://github.com/supabase-community/supabase-mcp) | The database is a Supabase project and you also want its management API. |
| [`neondatabase-labs/mcp-server-neon`](https://github.com/neondatabase-labs/mcp-server-neon) | Neon, where branch/project management matters as much as SQL. |

The rest of this doc covers `crystaldba/postgres-mcp`.

## Read-only by default

Run in `--access-mode=restricted` unless you have a concrete reason not to. An
agent with write access is one hallucinated `DELETE` away from an outage, and a
model cannot distinguish "a migration I was asked for" from "a `DROP TABLE` that
looked like the next token". Restricted mode wraps every statement in a
read-only transaction and caps execution time, so the worst case is a failed
tool call instead of a restore from backup.

Use `--access-mode=unrestricted` only against a local or throwaway development
database, never against staging or production. Treat the access mode as part of
the connection's identity: one config entry per database, each with its own
mode, so switching databases cannot silently switch you into write mode.

## A dedicated read-only role

Do not hand the agent the application's credentials. The app role owns the
schema, so read-only mode at the MCP layer would be the only thing between the
model and `DROP`. Defence belongs in the database as well. Create a role whose
privileges make writes impossible regardless of what the server is told to do:

```sql
CREATE ROLE mcp_reader LOGIN PASSWORD 'set-me-from-a-password-manager';

-- Scope to ONE database and revoke the public default.
REVOKE ALL ON DATABASE app_production FROM PUBLIC;
GRANT CONNECT ON DATABASE app_production TO mcp_reader;

\connect app_production
GRANT USAGE ON SCHEMA public TO mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO mcp_reader;

-- Belt and braces: the role cannot write even if something else goes wrong.
ALTER ROLE mcp_reader SET default_transaction_read_only = on;

-- Bound resource use so a runaway agent query cannot pin a backend.
ALTER ROLE mcp_reader SET statement_timeout = '15s';
ALTER ROLE mcp_reader SET idle_in_transaction_session_timeout = '30s';
```

Extra hardening worth doing:

- Withhold `SELECT` on columns holding secrets or PII, or point the role at
  redacting views instead of base tables. `GRANT SELECT (id, created_at) ON …`
  works at column granularity.
- Enable row-level security on multi-tenant tables and give `mcp_reader` a
  policy, rather than relying on the agent to add a `WHERE tenant_id = …`.
- Cap concurrency with `ALTER ROLE mcp_reader CONNECTION LIMIT 3;` so agent
  traffic cannot starve the application's pool.
- Row limits are the agent's job too: ask for `LIMIT` on every exploratory
  query. A `SELECT *` on a 200M-row table will return before the timeout only
  by luck.

## Connection string via environment variable

The server reads `DATABASE_URI`. Never commit it, never inline the password in a
config file that is in git, and never paste it into a chat transcript. Keep it
in the shell environment or a secrets manager and reference it:

```bash
export DATABASE_URI='postgresql://mcp_reader:***@db.internal:5432/app_production?sslmode=require'
```

Scope the URI to a single database. The path component (`/app_production`) is
what limits the blast radius; a server pointed at one database cannot wander
into another. If you need two databases, register two MCP entries with distinct
names (`postgres-app`, `postgres-analytics`) so every tool call names its target
explicitly.

Require TLS with `sslmode=require` (or `verify-full` when you have the CA) for
anything that is not on localhost.

## Install and configure

Docker is the most reliable path; it bundles the dependencies.

```bash
docker pull crystaldba/postgres-mcp
```

Python alternatives: `pipx install postgres-mcp` or `uv pip install postgres-mcp`
(Python 3.12+).

MCP client config, Docker, read-only:

```json
{
  "mcpServers": {
    "postgres-app": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "DATABASE_URI",
        "crystaldba/postgres-mcp",
        "--access-mode=restricted"
      ],
      "env": {
        "DATABASE_URI": "${DATABASE_URI}"
      }
    }
  }
}
```

With `uvx` instead of Docker:

```json
{
  "mcpServers": {
    "postgres-app": {
      "command": "uvx",
      "args": ["postgres-mcp", "--access-mode=restricted"],
      "env": { "DATABASE_URI": "${DATABASE_URI}" }
    }
  }
}
```

The Docker image remaps `localhost` in the URI to the host automatically
(`host.docker.internal` on macOS/Windows, the bridge address on Linux), so a
local database works without editing the host name.

For several clients sharing one server, start it with `--transport=sse` and
`-p 8000:8000`, then point clients at `http://localhost:8000/sse`. Do not expose
that port beyond the host: it is an unauthenticated database proxy.

## Optional extensions for performance work

Index tuning and top-query analysis need two extensions on the target database:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS hypopg;
```

- `pg_stat_statements` supplies the execution statistics behind
  `get_top_queries`. On self-managed Postgres it must also appear in
  `shared_preload_libraries`, which requires a restart.
- `hypopg` lets `explain_query` simulate an index without creating it — the
  whole point being that you learn the plan change without a write.

On RDS, Cloud SQL, and Azure Database these are already available; the
`CREATE EXTENSION` calls just need a privileged role. Run them yourself, not
through the agent's read-only connection.

## Probe with EXPLAIN before recommending anything

Never let a schema change or index be proposed on the strength of reading the
DDL. The planner's cost model is the source of truth, and it depends on table
statistics and data distribution that are invisible in the schema.

Working order:

1. `explain_query` on the real query to get the current plan and cost.
2. `explain_query` again with hypothetical indexes to see whether the plan
   actually changes. If the planner ignores the index, the index is worthless.
3. `analyze_workload_indexes` (or `analyze_query_indexes` for a specific set) to
   let the tuner search the index space rather than guessing.
4. `analyze_db_health` for cache hit rates, bloat, unused and duplicate indexes,
   vacuum status, and sequence exhaustion before blaming query shape.

Use `EXPLAIN` without `ANALYZE` on production unless you are certain the query
is cheap and side-effect free — `EXPLAIN ANALYZE` executes the statement.

## Tools exposed

`list_schemas`, `list_objects`, `get_object_details`, `execute_sql`,
`explain_query`, `get_top_queries`, `analyze_workload_indexes`,
`analyze_query_indexes`, `analyze_db_health`.

In restricted mode `execute_sql` is limited to read-only transactions with a
time cap; the others are read-only by nature.

## Verify the setup

```bash
# 1. Credentials work and the role is genuinely read-only.
psql "$DATABASE_URI" -c 'SELECT current_database(), current_user;'
psql "$DATABASE_URI" -c 'CREATE TABLE should_fail (id int);'   # must ERROR

# 2. The server starts and speaks MCP.
docker run -i --rm -e DATABASE_URI crystaldba/postgres-mcp --access-mode=restricted
```

Then, from the client, ask for `list_schemas` and confirm only the intended
database's schemas come back. If the agent can see a database you did not
intend to expose, fix the grants before using the server for anything.

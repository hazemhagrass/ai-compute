# MCP server setups

Model Context Protocol servers connect an agent to external tools. Most of them
need no documentation from this repo: the vendor README is the source of truth,
it is maintained, and a copy here only goes stale the moment a flag changes.

So this directory is deliberately small. A server gets a file here **only** when
there is setup work the vendor README does not do for you, and that work is
non-obvious enough to get wrong.

| Server | File | Why this file exists |
| --- | --- | --- |
| Postgres | [postgres.md](postgres.md) | The vendor README tells you to set a connection string. It does not hand you the SQL for a genuinely read-only role: privileges, forced read-only transactions, statement and idle timeouts, connection caps. |
| Memory | [memory.md](memory.md) | Retrieval is substring matching, with no ranking and no embeddings. That one fact dictates how observations must be written, and the consequences are not spelled out upstream. |

## For every other server, read the vendor docs

Well documented upstream, and nothing here would improve on them:

- GitHub: <https://github.com/github/github-mcp-server>
- Playwright: <https://github.com/microsoft/playwright-mcp>
- Filesystem: <https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem>
- Context7: <https://github.com/upstash/context7>
- Sequential Thinking: <https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking>
- Fetch: <https://github.com/modelcontextprotocol/servers/tree/main/src/fetch>

## One thing worth knowing before you follow any tutorial

Anthropic archived thirteen of its original reference servers, including the
GitHub, Slack, Postgres, Puppeteer and Sentry ones, and the replacements are
maintained by the vendors themselves. Older posts and videos still point at the
archived packages. If a tutorial tells you to install
`@modelcontextprotocol/server-github` or `@modelcontextprotocol/server-postgres`,
it is out of date; use the vendor server listed above.

Still maintained as reference servers: Filesystem, Memory, Sequential Thinking,
and Fetch.

## Rules that apply to any server you add

- Credentials come from environment variables, never literals in a config file
  that gets committed. A token in `.mcp.json` is a token in git history.
- Start read-only. Add write tools only when a task needs them, and remember a
  write tool acts with your identity and your permissions.
- Anything a server fetches is untrusted input. Issue text, page content and
  database rows can all carry instructions aimed at your agent.
- Every server costs context on every request, because its tool definitions
  load whether or not they are used. Two servers with overlapping tools teach
  the model to pick the wrong one.

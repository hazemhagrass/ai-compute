# MCP server setups

Model Context Protocol servers connect an agent to external tools. This
directory is one setup document per server that earns its slot, with the
config, the least-privilege setup, and the risks stated plainly.

These servers are built and maintained by their vendors. Nothing here
reimplements them: each file is the setup and safety guidance for using the
upstream server, pointing at the maintained source.

| Server | File | What it gives the agent |
| --- | --- | --- |
| Context7 | [context7.md](context7.md) | Version-pinned library documentation, fetched live |
| GitHub | [github.md](github.md) | Repos, issues, pull requests, code search |
| Filesystem | [filesystem.md](filesystem.md) | Scoped read and write inside an allow-list of roots |
| Playwright | [playwright.md](playwright.md) | Browser automation over the accessibility tree |
| Postgres | [postgres.md](postgres.md) | Schema inspection, EXPLAIN, read-only queries |
| Memory | [memory.md](memory.md) | A persistent knowledge graph across sessions |
| Sequential Thinking | [sequential-thinking.md](sequential-thinking.md) | An explicit, revisable chain of thoughts |
| Fetch | [fetch.md](fetch.md) | Web pages converted to markdown |

## Install order

Start with Context7 and GitHub: they pay for themselves on the first task.
Add Filesystem and Playwright when the agent needs to touch files outside the
host's sandbox or drive a real browser. The rest are situational.

Every server you add costs context on every request, because its tool
definitions load whether or not they are used. Two servers that do the same
job teach the model to pick wrong. Install the one you need and remove what
you stopped using.

## A note on the archived reference servers

Anthropic archived most of the original reference servers, including
`@modelcontextprotocol/server-github` and `@modelcontextprotocol/server-postgres`.
Tutorials still point at them. Each file here names the archived package it
replaces so a reader arriving from an old post finds the maintained server
instead of a dead repo.

Still maintained as reference servers: Filesystem, Memory, Sequential
Thinking, and Fetch.

## Secrets

No file here contains a literal token. Every credential is referenced as an
environment variable (`${GITHUB_MCP_PAT}`, `${DATABASE_URI}`,
`${CONTEXT7_API_KEY}`) so a config can be committed without leaking. A
`.mcp.json` checked into a repo is readable by everyone who can clone it.

## Risk, stated once

An MCP server is a capability you hand to a model that reads untrusted text.
Issue bodies, web pages, and database rows can all carry instructions. Three
rules follow:

- Prefer read-only modes and turn off the toolsets you do not use.
- Scope credentials to the smallest surface that works: one repo, one
  database, one directory.
- Content fetched by an agent is data, never instructions. Any server that
  fetches remote content widens that surface.

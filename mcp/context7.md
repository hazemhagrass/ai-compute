# Context7 MCP server

Live library documentation injection. Context7 crawls library sources and docs
sites, keeps a snapshot per library (and per version), and serves the relevant
slice into the model's context on demand. It targets the most common failure in
agent coding: an API hallucinated from stale training data.

Server: `@upstash/context7-mcp` (npm, MIT, by Upstash). Source:
https://github.com/upstash/context7. Index and library pages:
https://context7.com.

## Install

Requires Node.js >= 20.18.1. An API key is optional: without one you get the
public rate limit, with one you get a higher limit plus access to private repos
you have indexed. Keys come from https://context7.com/dashboard.

Claude Code, local stdio server, user scope:

```sh
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp
```

With a key, reference the variable instead of the literal so the key stays out
of shell history and out of any config file that might get committed. Export
`CONTEXT7_API_KEY` from your shell profile; the server reads it from the
inherited environment:

```sh
claude mcp add --scope user --env CONTEXT7_API_KEY=${CONTEXT7_API_KEY} \
  context7 -- npx -y @upstash/context7-mcp
```

Remote HTTP server, no local process:

```sh
claude mcp add --scope user --transport http \
  --header "Authorization: Bearer ${CONTEXT7_API_KEY}" \
  context7 https://mcp.context7.com/mcp
```

Generic JSON config (Cursor, VS Code, Devin, BoltAI, anything reading
`mcpServers`):

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    }
  }
}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
startup_timeout_ms = 20_000
env = { CONTEXT7_API_KEY = "..." }
```

CLI flags on the server itself: `--transport <stdio|http>` (stdio default),
`--port <n>` (http only, default 3000), `--api-key <key>`. The flag wins over
`CONTEXT7_API_KEY` when both are set. Behind a corporate proxy the server honors
`https_proxy` / `HTTPS_PROXY`.

## Tools

- `resolve-library-id(libraryName)`: fuzzy name to a Context7 library ID such as
  `/vercel/next.js`. Returns candidates with a trust score, snippet count, and
  last update date.
- `get-library-docs(context7CompatibleLibraryID, topic?, page?)`: fetches the
  docs slice. `topic` narrows to a subsystem ("routing", "hooks", "streaming").
  `page` is 1 to 10; if the first page is thin, ask for page 2 with the same
  topic instead of rephrasing the query.

## How fresh the docs actually are

Freshness is per library, not global. Each entry carries a `lastUpdateDate` and
a trust score, both visible in `resolve-library-id` output and on the library's
context7.com page. Popular libraries re-crawl within days; a long tail of
community-submitted entries can be months stale, and a stale Context7 answer is
as wrong as a stale training-data answer while looking more authoritative.

Read the metadata before trusting the content:

- Check `lastUpdateDate` against the release you are coding against. If the
  library shipped a breaking release after that date, the snapshot predates it.
- Prefer high trust score and verified entries. A search for a popular name
  returns several near-identical IDs, most of them unofficial mirrors.
- Prefer the ID that points at the upstream repo (`/vercel/next.js`) over a
  scraped docs site (`/websites/nextjs`) when both exist and the repo entry is
  current, because the repo entry tracks source, not a rendered page.

## Resolving a library ID

Two steps, and skipping the first one is the usual cause of wrong docs.

1. Call `resolve-library-id` with the plain name. Read the candidate list.
2. Call `get-library-docs` with the exact ID.

When you already know the ID, put it in the prompt and the resolve step is
skipped:

```txt
Implement row level security policies. use library /supabase/supabase
```

IDs are `/org/repo`, occasionally `/websites/<name>` for docs-site-only entries.
They are not npm package names; do not guess one.

## Pin the version

An unpinned ID resolves to the library's default branch, which for many projects
is a prerelease line (`/vercel/next.js` tracks `canary`). That silently gives
you APIs that do not exist in the version in your lockfile.

Append the version segment to pin it:

```txt
/vercel/next.js/v15.1.8
```

Available versions are listed on the library's context7.com page and in the
`versions` field of the resolve result. Workflow: read the installed version out
of the lockfile or `package.json` first, then pin to the nearest indexed version
at or below it. If the exact version is not indexed, pin to the closest lower
one and say so, rather than falling back to the default branch.

Pin every time the library has a history of breaking changes across majors
(Next.js, React Router, Tailwind, Pydantic, LangChain). For a library whose API
has been stable for years, unpinned is fine and cheaper.

## Combine it with code search

Context7 tells you what the API is supposed to be. It does not tell you how this
repo actually calls it. Use both:

1. `get-library-docs` for the current signature and the intended pattern.
2. Grep the repo for existing call sites of the same symbol.
3. If they disagree, the repo is either on an older version (re-pin and recheck)
   or carrying a deliberate deviation (a wrapper, a workaround) that you should
   follow instead of the doc example.

The same applies to generated code: after writing against Context7 docs, run
typecheck and the tests. Docs freshness is not a substitute for the compiler.

## When not to use it

- Vendored, forked, or patched dependencies. The local copy is the truth and
  Context7 documents upstream; pulling upstream docs for a fork actively
  misleads. Read `node_modules`, the vendor directory, or the patch file.
- Internal and private libraries that are not indexed. Point the agent at the
  source or the in-repo docs.
- Anything where the answer lives in this repo: your own modules, config
  conventions, and build scripts.
- Stable, deeply known standard APIs (stdlib string handling, basic SQL). The
  lookup costs context and latency for something the model already has right.
- Air-gapped or offline work. The server is a network call to Context7's API;
  there is no local index.
- When the indexed entry is clearly stale (old `lastUpdateDate`, low trust
  score) and the library moves fast. Read the release notes instead.

## Recommended rule

Add this to `CLAUDE.md` (or the equivalent rules file) so the agent invokes the
tools without being asked each time:

```txt
Use Context7 for library and API questions: resolve the library id, pin the
version from the lockfile, then fetch docs. Do not use it for vendored or
forked dependencies or for code in this repo.
```

## Troubleshooting

- `ERR_MODULE_NOT_FOUND`: swap `npx` for `bunx` in the command.
- `Cannot find module 'uriTemplate.js'`: add
  `--node-options=--experimental-vm-modules` before the package name.
- TLS or certificate failures: add `--node-options=--experimental-fetch`.
- Startup "request timed out" in Codex: raise `startup_timeout_ms` to `40_000`.
- Generic client errors: append `@latest` to the package name, confirm Node 20+,
  or use the remote HTTP transport to remove the local process entirely.

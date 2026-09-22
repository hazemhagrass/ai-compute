# Filesystem MCP Server

Reference server from the MCP project. Gives an agent scoped read/write access to the
local filesystem over stdio, with an allow-list enforced inside the server itself.

Package: `@modelcontextprotocol/server-filesystem` (npm) · Docker image: `mcp/filesystem` · MIT.

## When it earns its place

Add it when the agent runs **outside** an IDE sandbox, or needs access to paths the host
tool cannot reach:

- headless/CLI agents, cron jobs, containers, CI runners;
- agents that must touch several project roots at once (cross-project refactors, doc sync);
- read-only exposure of a data or asset directory to a tool that otherwise has no file access.

Skip it when the host already sandboxes filesystem access — Cursor, modern Claude Code,
VS Code Copilot agent mode all ship native file tools bounded to the workspace. Running
this server there duplicates the tool surface, doubles the token cost of the tool list, and
usually *widens* the blast radius rather than narrowing it.

## Install

No install step is required with `npx`; the package is fetched on first run.

```bash
# smoke test: should print the allowed roots and then wait on stdio
npx -y @modelcontextprotocol/server-filesystem ~/workspace/ai-computer
```

Docker alternative (directories must be bind-mounted, conventionally under `/projects`):

```bash
docker run -i --rm \
  --mount type=bind,src=/home/you/workspace/ai-computer,dst=/projects/ai-computer \
  mcp/filesystem /projects
```

## Configure

Client config (Claude Desktop `claude_desktop_config.json`, or the `mcpServers` block of
whatever client you use):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/you/workspace/ai-computer",
        "/home/you/workspace/notes"
      ]
    }
  }
}
```

Every positional argument after the package name is an allowed root. There is no config
file and no env var for the allow-list — the roots are the argv.

Docker form of the same config:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--mount", "type=bind,src=/home/you/workspace/ai-computer,dst=/projects/ai-computer",
        "--mount", "type=bind,src=/home/you/data,dst=/projects/data,ro",
        "mcp/filesystem", "/projects"
      ]
    }
  }
}
```

The `ro` flag on a bind mount is the only way to make a root genuinely read-only; the
server itself has no per-root permission setting.

## The safe path pattern

The allow-list is enforced at the server boundary: every tool call resolves the requested
path (symlinks included) and refuses anything outside the allowed roots. That check is the
*entire* security model, so the roots you pass are the security policy.

Rules:

1. **Scope to project roots, never `$HOME`.** `~` as a root exposes `.ssh`, `.aws`,
   `.config`, browser profiles, password-manager exports and every other repo on the box to
   a single prompt injection in a file the agent reads.
2. **Also never `/`, `/etc`, `/var`, or a bare `.`** — a relative root resolves against
   whatever cwd the client happened to launch with.
3. **One root per project you actually intend to edit.** Two or three explicit paths beat
   one broad parent.
4. **Mount reference/data directories read-only** via Docker `ro` rather than adding them
   as writable roots.
5. **Keep secrets out of the roots.** A `.env` inside an allowed project *is* readable; move
   real credentials to a path outside the allow-list (or a secret manager) rather than
   relying on the agent not to look.
6. **Verify after wiring up**: ask the agent to call `list_allowed_directories` and confirm
   the output matches your intent before giving it any real work.

Good:

```
/home/you/workspace/ai-computer
/home/you/workspace/client-site
```

Bad:

```
/home/you            # everything, including credentials
/                    # everything else too
.                    # depends on the client's cwd
```

## Dynamic roots

Clients that implement the MCP **roots** capability can replace the allow-list at runtime:
the server asks for `roots/list` on initialize and re-asks on
`notifications/roots/list_changed`. Client-supplied roots **completely replace** the
command-line ones — they do not merge, and they do not stack on top.

Consequences worth knowing:

- With a roots-capable client, the argv roots are only a fallback for the pre-initialize
  window; the client's workspace folders are what actually apply.
- If the server starts with **no** argv roots and the client does not support roots (or
  sends an empty list), initialization fails with an error. That failure is the intended
  behaviour — the server refuses to run unscoped.

## Tools exposed

Read-only: `read_text_file` (with optional `head`/`tail`), `read_media_file`,
`read_multiple_files`, `list_directory`, `list_directory_with_sizes`, `directory_tree`,
`search_files`, `get_file_info`, `list_allowed_directories`.

Write: `create_directory` (idempotent), `write_file` (overwrites — destructive),
`edit_file` (pattern-based edits, supports `dryRun`; not idempotent), `move_file` (fails if
the destination exists).

There is no delete tool. Each tool carries MCP tool annotations (`readOnlyHint`,
`idempotentHint`, `destructiveHint`, and `openWorldHint: false`), so clients can auto-approve
reads while prompting on writes — configure that in the client if it supports it.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Server exits immediately at startup | No allowed directory: no argv roots and the client sent no roots. Pass an explicit path. |
| "Access denied" on a path you expected to work | Path is outside the roots, or a symlink resolves outside them. Check with `list_allowed_directories`. |
| Roots you passed on the command line are ignored | A roots-capable client replaced them with its workspace folders. Change the client's workspace, not argv. |
| Works via npx, fails in Docker | The path must be the *container* path (e.g. `/projects/ai-computer`), not the host path. |
| `npx` hangs on first run | It is fetching the package; pre-warm with `npm i -g @modelcontextprotocol/server-filesystem` and use the `mcp-server-filesystem` binary. |
| Writes fail on a Docker root | The bind mount was declared `ro`. |

## Reference

- Server README: <https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem>
- Roots concept: <https://modelcontextprotocol.io/docs/learn/client-concepts#roots>

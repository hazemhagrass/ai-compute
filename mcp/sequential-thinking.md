# Sequential Thinking MCP server

Structured multi-step reasoning exposed as a tool call. The model writes one
thought per call, numbers it, says whether another is needed, and can mark a
call as a revision of an earlier thought or a branch from it. The server keeps
the thought log for the session and prints it to stderr unless logging is
disabled.

Read the honesty section before installing this one. It is the least
load-bearing server in this directory.

## Config

`.mcp.json` (Claude Code, and the same `mcpServers` shape used by Claude
Desktop and most MCP clients):

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {
        "DISABLE_THOUGHT_LOGGING": "false"
      }
    }
  }
}
```

No token, no credentials, no network egress. The only knob is
`DISABLE_THOUGHT_LOGGING`: set it to `true` to stop the server writing formatted
thoughts to stderr. Leave it `false` if the point of installing this is the
audit trail, since that stderr log is the artifact you review afterwards.

Docker instead of npx, if you would rather not run an npx download per session:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "mcp/sequentialthinking"]
    }
  }
}
```

Build that image from the upstream repo with
`docker build -t mcp/sequentialthinking -f src/sequentialthinking/Dockerfile .`
On Windows, launch npx through `cmd /c` (`"command": "cmd"`, args
`["/c", "npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]`).
VS Code uses the same object under a `servers` key in `mcp.json` rather than
`mcpServers`. Codex CLI:
`codex mcp add sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking`.

## Remote versus local

There is no remote option worth using. The server is pure local state with no
backend, so a hosted copy would add a network hop and a third party that gets
to read your half-formed reasoning, in exchange for nothing. Run it local over
stdio.

## Least privilege

Nothing to scope: one tool, `sequential_thinking`, no filesystem, database, or
network access. The privilege question here is the inverse of the usual one,
which is how much of your context budget it may consume. Every thought is a
round trip and every thought stays in the transcript, so a twenty-thought chain
on a trivial question is a real cost. Keep it out of configs used for
high-volume or latency-sensitive agent runs, and prefer enabling it per project
rather than in your global user config.

## Honest framing

Several maintainers have made the same observation: the tool largely tells the
model that it is allowed to think in steps, and current frontier models already
do that unprompted. If your host supports extended or interleaved thinking, you
are mostly paying tool-call overhead for behavior you already had.

It earns its place in two cases:

1. The host cannot do extended thinking. Older models, or a client that gives
   you no thinking budget control, get real structure from being forced through
   numbered steps with explicit revision and branch markers.
2. You need the plan log to be reviewable. Internal reasoning is not always
   visible or durable. Thought calls are ordinary tool calls, so they land in
   the transcript, in the stderr log, and in whatever you archive, and a human
   can read them back later and see where the plan turned.

If neither is true for you, skip it. Installing it because the tool list looks
better with it on is how agents end up narrating trivial tasks in nine steps.

## Verify it connected

1. Reload or restart the host so it reconnects to the server.
2. Check that `sequential_thinking` appears in the host's MCP tool list
   (`/mcp` in Claude Code, the MCP panel in VS Code, the inspector elsewhere).
3. Ask for something genuinely multi-step, for example: plan a Postgres 14 to
   16 migration, list the risks, and revise the plan if downtime would exceed
   five minutes.
4. Confirm the host makes repeated `sequential_thinking` calls carrying
   `thought`, `thoughtNumber`, `totalThoughts`, and `nextThoughtNeeded`, rather
   than answering in one shot. Course corrections show up as `isRevision` and
   `revisesThought`, alternatives as `branchFromThought` and `branchId`.

Two failures cover almost everything:

- Server shows as failed or disconnected at startup. Usually npx cannot fetch
  the package: no `node`/`npx` on the host's PATH (GUI apps do not inherit your
  shell PATH, so use an absolute path to `npx`), no network, or a registry
  proxy that blocks it. Run the command by hand in a terminal first; it should
  start and sit waiting on stdin.
- Server connects but the tool is never called. That is not a connection
  failure, it is the model deciding it does not need the tool, which is the
  expected outcome on easy prompts. Ask explicitly to think step by step, and
  check the host is not capping the tool list or running a profile where the
  server is disabled.

## Risks

- Context and cost inflation. The main real risk. Long thought chains eat the
  window and push the actual work out of it.
- Thought logs are not secrets-aware. With logging on, whatever the model is
  reasoning about, including snippets of code, credentials it has seen, or
  customer data, gets formatted to stderr and into your host's log files. Set
  `DISABLE_THOUGHT_LOGGING=true` for anything sensitive, and treat captured
  logs with the same care as the source data.
- Visible reasoning is not verified reasoning. A neat numbered plan reads as
  rigor, and reviewers relax. The log tells you what the model said it was
  doing, not that any of it was correct.
- Session state only. Thoughts live in the running process, so restarting the
  server drops them. Pair it with the Memory server if a plan has to survive
  past one session.

## Provenance

Upstream: `modelcontextprotocol/servers`, `src/sequentialthinking`, MIT
licensed, published as `@modelcontextprotocol/server-sequential-thinking`. It
is one of the reference servers that remains maintained in that repo, not one
of the archived ones, so an old tutorial pointing at the same npm package is
still pointing at the right thing.

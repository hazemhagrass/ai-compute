# Memory MCP Server

Persistent knowledge-graph memory across sessions, stored as a local JSONL file
of entities, relations, and observations.

- Package: `@modelcontextprotocol/server-memory`
- Source: <https://github.com/modelcontextprotocol/servers/tree/main/src/memory>
- Transport: stdio
- License: MIT

## Read this first: do you actually need it?

This server is **redundant, not additive**, when the host tool already keeps
memory of its own:

- Project memory files (`CLAUDE.md`, `AGENTS.md`) already give durable,
  reviewable, diffable context. A knowledge graph nobody reads is worse.
- Hosts with built-in memory (ChatGPT memory, Cursor rules, editor workspace
  instructions) double-write the same facts, leaving two sources of truth and
  no way to tell which the model used.
- Conventions, architecture decisions, and runbooks belong in version control,
  not a per-machine JSONL.

Use it for facts that are **per-user, cross-project, and mutable**: who the
collaborators are, current priorities, which environment someone works in.

## Install

```bash
npx -y @modelcontextprotocol/server-memory   # smoke test, Ctrl-C to exit
```

No global install needed; the config below launches it on demand.

## Configure

### Claude Desktop / Claude Code (`claude_desktop_config.json`, `.mcp.json`)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": "/absolute/path/to/memory.jsonl"
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json` or user `mcp.json`)

Identical, except the top-level key is `servers` rather than `mcpServers`.

### Windows and Docker

On Windows wrap the launcher: `"command": "cmd"`, `"args": ["/c", "npx", "-y",
"@modelcontextprotocol/server-memory"]`.

For Docker use `"command": "docker"` with `args` of `["run", "-i", "-v",
"claude-memory:/app/dist", "--rm", "mcp/memory"]`. Upgrade trap: an existing
`mcp/memory` volume holds an `index.js` that a newer image will not overwrite,
so delete that file in the volume first or the container keeps running the old
server.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE_PATH` | `memory.jsonl` next to the server package | Absolute path to the graph file. Always set it explicitly -- the default lands inside the npx cache and can vanish. |

## Data model

Three primitives, and the discipline is in how you use them. An **entity** is a
node with a unique `name`, an `entityType`, and observations. A **relation** is
a directed edge written in active voice. An **observation** is one atomic string
on one entity, added and removed independently.

```jsonl
{ "name": "Ada_Lovelace", "entityType": "person", "observations": ["Works in UTC"] }
{ "from": "Ada_Lovelace", "to": "ai-computer", "relationType": "maintains" }
{ "entityName": "ai-computer", "observations": ["Uses pnpm workspaces"] }
```

### Flat facts beat prose blobs

Retrieval is `search_nodes`, a substring match over entity names, types, and
observation text. Consequences:

- **One fact per observation.** `"Prefers pnpm"` and `"Deploys with Docker"` as
  two entries are both findable; a paragraph containing both matches only on its
  exact wording.
- **No embeddings, ranking, or fuzzy matching.** Misspell the query and you get
  nothing. Name entities predictably (`Snake_Case_Proper_Nouns`) and reuse one
  vocabulary for `relationType`.
- **Long prose blobs are write-only memory.** They inflate the graph and burn
  context without ever being retrieved precisely.
- **Deletes match observations by exact string.** Paraphrasing creates a
  duplicate rather than an update; stale entries accumulate silently.
- **The whole graph is loaded and rewritten on each mutation.** Keep it in the
  hundreds to low thousands of entities. It is not a database.

## Tools

| Tool | Effect |
| --- | --- |
| `create_entities` | Add entities; existing names are ignored, not merged. |
| `create_relations` | Add edges; duplicates skipped, fails if an endpoint is missing. |
| `add_observations` | Append observations to an existing entity; fails if it does not exist. |
| `delete_entities` | Remove entities and cascade their relations. |
| `delete_observations` | Remove exact observation strings. |
| `delete_relations` | Remove exact `from`/`to`/`relationType` triples. |
| `read_graph` | Return the whole graph. Expensive once the graph grows. |
| `search_nodes` | Substring query over names, types, and observations. |
| `open_nodes` | Fetch named entities plus the relations among them. |

Resource: `memory://knowledge-graph` serves the `read_graph` payload as
`application/json`; mutations emit `notifications/resources/updated`.

## Scope isolation between projects

The server has **no namespacing**. One running instance means one flat graph
shared by every conversation pointed at it. Isolate with the file path:

```jsonc
// ~/.config/.../global config -- personal, cross-project facts
{ "env": { "MEMORY_FILE_PATH": "/home/you/.local/share/mcp/memory-global.jsonl" } }

// <repo>/.mcp.json -- project-local facts, per checkout
{ "env": { "MEMORY_FILE_PATH": "/home/you/.local/share/mcp/memory-ai-computer.jsonl" } }
```

Rules that keep it sane:

- One `MEMORY_FILE_PATH` per scope; two scopes sharing a file "just for now"
  means manual unmixing later.
- Store the graph **outside** the repo (or gitignore it). It holds unreviewed
  model-written content and often personal details.
- For two graphs at once, register the server twice under different names with
  different paths. Tool names collide, so prefer one at a time.
- Deleting the JSONL is the reset button. No migration, no schema version, so
  back it up before upgrading.

## Inspect and export

Plain JSON Lines, one record per line. Inspect it with ordinary tools.

```bash
export MEM=/absolute/path/to/memory.jsonl

# entity vs relation counts
jq -r .type "$MEM" | sort | uniq -c

# every entity with its observations
jq -r 'select(.type=="entity") | "\(.entityType)\t\(.name)\t\(.observations|join(" | "))"' "$MEM"

# the relation graph, active voice
jq -r 'select(.type=="relation") | "\(.from) --\(.relationType)--> \(.to)"' "$MEM"

# export a snapshot as a single JSON document
jq -s '{entities: map(select(.type=="entity")), relations: map(select(.type=="relation"))}' \
  "$MEM" > memory-snapshot.json
```

From inside a session, `read_graph` gives the same content and
`memory://knowledge-graph` serves it as a resource: fine for a quick audit,
wasteful as a habit. Periodically skim observations for duplicates and
paraphrases, drop entities nothing links to, and prune stale facts. Nothing in
the server does this for you.

## Prompting

The server stores; it never decides. Without instructions the agent barely
writes to it. Add explicit guidance to the host's custom instructions:

```text
At the start of a task, search your memory for entities relevant to the
current project and the people involved.
During the task, record only durable facts: identities, ongoing projects,
stated preferences, decisions and their reasons.
Write each fact as its own short observation attached to a named entity.
Do not store transient state, code, secrets, or anything already written in
the repository.
```

Tune the categories to the use case: a broad prompt produces a large, noisy,
unsearchable graph fast.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Memory empty after a restart | `MEMORY_FILE_PATH` unset; the default file lived in the npx cache. Set an absolute path. |
| `create_relations` fails | Source or target entity does not exist yet. Create entities first. |
| Searches return nothing obvious | Substring match only. Query the exact wording, or use `open_nodes` with the entity name. |
| Duplicate-looking facts | Observations are compared as exact strings; paraphrases stack up. Delete the old string explicitly. |
| Docker container runs an old version | Stale `index.js` in the `claude-memory` volume. Remove it and restart. |
| Context blowing up | Something is calling `read_graph` every turn, or the graph has grown too large. Prefer `search_nodes`/`open_nodes` and prune. |

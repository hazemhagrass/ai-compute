# Memory MCP Server

Persistent knowledge-graph memory for agents across sessions. Stores facts as a
local JSONL file and exposes them as entities, relations, and observations.

- Package: `@modelcontextprotocol/server-memory`
- Source: <https://github.com/modelcontextprotocol/servers/tree/main/src/memory>
- Transport: stdio
- License: MIT

## Read this first: do you actually need it?

This server is **redundant, not additive**, when the host tool already keeps
memory of its own:

- Claude Code / Claude Desktop with project memory files (`CLAUDE.md`,
  `AGENTS.md`) already give the agent durable, reviewable, diffable context.
  A knowledge graph that nobody reads is worse than a file in the repo.
- Hosts with a built-in memory feature (ChatGPT memory, Cursor rules, editor
  workspace instructions) will double-write the same facts. You then get two
  sources of truth and no way to tell which one the model used.
- Anything that belongs in version control — conventions, architecture
  decisions, runbooks — belongs in a repo file, not in a per-machine JSONL.

Use this server when you need facts that are **per-user, cross-project, and
mutable**: who the collaborators are, what the current priorities are, which
environment a person works in. Skip it otherwise.

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

```json
{
  "servers": {
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

### Windows

Wrap the launcher: `"command": "cmd"`, `"args": ["/c", "npx", "-y",
"@modelcontextprotocol/server-memory"]`.

### Docker

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": ["run", "-i", "-v", "claude-memory:/app/dist", "--rm", "mcp/memory"]
    }
  }
}
```

Note: an existing `mcp/memory` volume holds an `index.js` that a newer image
will not overwrite. Delete that file in the volume before upgrading, or the
container keeps running the old server.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEMORY_FILE_PATH` | `memory.jsonl` next to the server package | Absolute path to the graph file. Always set it explicitly — the default lands inside the npx cache and can vanish. |

## Data model

Three primitives, and the discipline is in how you use them.

**Entity** — a node with a unique `name`, an `entityType`, and a list of
observations.

```json
{ "name": "Hazem_Hagrass", "entityType": "person", "observations": ["Works in EEST"] }
```

**Relation** — a directed edge, written in active voice.

```json
{ "from": "Hazem_Hagrass", "to": "ai-computer", "relationType": "maintains" }
```

**Observation** — one atomic string attached to one entity. Add and remove
independently.

```json
{ "entityName": "ai-computer", "observations": ["Uses pnpm workspaces", "Deploys via Docker Compose"] }
```

### Flat facts beat prose blobs

The retrieval path is `search_nodes`, a substring match over entity names,
entity types, and observation text. That has real consequences:

- **One fact per observation.** `"Prefers pnpm"` and `"Deploys with Docker"` as
  two entries are both findable. A paragraph containing both matches only if the
  query happens to hit its exact wording.
- **There is no embedding search, no ranking, no fuzzy matching.** Misspell the
  query and you get nothing back. Name entities predictably
  (`Snake_Case_Proper_Nouns`) and reuse the same vocabulary for `relationType`.
- **Long prose blobs are write-only memory.** They inflate the graph, get
  re-read whole by `read_graph`, and burn context without ever being retrieved
  precisely.
- **Observations are matched by exact string on delete.** Paraphrasing a fact
  creates a duplicate rather than an update; stale entries accumulate silently.
- **Everything is loaded in memory and rewritten on each mutation.** Keep the
  graph in the hundreds-to-low-thousands of entities. It is not a database.

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

Resource: `memory://knowledge-graph` exposes the same payload as `read_graph` as
`application/json`, and mutations emit `notifications/resources/updated` so
subscribed clients see live changes.

## Scope isolation between projects

The server has **no namespacing**. One running instance means one flat graph
shared by every conversation pointed at it. Isolate with the file path:

```jsonc
// ~/.config/…/global config — personal, cross-project facts
{ "env": { "MEMORY_FILE_PATH": "/home/you/.local/share/mcp/memory-global.jsonl" } }

// <repo>/.mcp.json — project-local facts, per checkout
{ "env": { "MEMORY_FILE_PATH": "/home/you/.local/share/mcp/memory-ai-computer.jsonl" } }
```

Rules that keep it sane:

- One `MEMORY_FILE_PATH` per scope; never let two scopes share a file "just for
  now" — unmixing a merged graph is manual work.
- Store the graph **outside** the repo (or gitignore it). It holds unreviewed
  model-written content and often personal details; it is not a repo artifact.
- If you genuinely need two graphs at once, register the server twice under
  different names (`memory`, `memory-project`) with different paths. Tool names
  will collide in the agent's view, so prefer one at a time.
- Deleting the JSONL file is the reset button. There is no migration or schema
  version, so back it up before upgrading the server.

## Inspect and export

The store is plain JSON Lines — one entity or relation per line. Inspect it with
ordinary tools, no server required.

```bash
export MEM=/absolute/path/to/memory.jsonl

# entity vs relation counts
jq -r .type "$MEM" | sort | uniq -c

# every entity with its observations
jq -r 'select(.type=="entity") | "\(.entityType)\t\(.name)\t\(.observations|join(" | "))"' "$MEM"

# the relation graph, active voice
jq -r 'select(.type=="relation") | "\(.from) --\(.relationType)--> \(.to)"' "$MEM"

# find dangling relations (endpoint entity missing)
jq -s '
  (map(select(.type=="entity").name)|map({(.):1})|add) as $e
  | map(select(.type=="relation" and (($e[.from]//0)==0 or ($e[.to]//0)==0)))
' "$MEM"

# export a snapshot as a single JSON document
jq -s '{entities: map(select(.type=="entity")), relations: map(select(.type=="relation"))}' \
  "$MEM" > memory-snapshot.json
```

From inside a session, `read_graph` gives the same content and
`memory://knowledge-graph` serves it as a resource — useful for a quick audit,
wasteful as a habit.

Maintenance worth doing periodically: skim the observations for duplicates and
paraphrases, drop entities nothing links to, and prune facts that have gone
stale. Nothing in the server does this for you.

## Prompting

The server stores; it never decides. Without instructions the agent will barely
write to it. Add explicit guidance to the host's custom instructions, e.g.:

```text
At the start of a task, search your memory for entities relevant to the
current project and the people involved.
During the task, record only durable facts: identities, ongoing projects,
stated preferences, decisions and their reasons.
Write each fact as its own short observation attached to a named entity.
Do not store transient state, code, secrets, or anything already written in
the repository.
```

Tune the categories to the use case — a broad prompt produces a large, noisy,
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

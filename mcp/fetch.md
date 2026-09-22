# Fetch MCP server

Web page fetching for agents, from the officially maintained reference set
(`modelcontextprotocol/servers`, `src/fetch`). It retrieves a URL and returns
readable markdown instead of raw HTML, so the model spends tokens on content
rather than on nav bars, script tags, and class attributes.

Package: `mcp-server-fetch` (Python). License MIT. Requires MCP Python SDK 1.x
(`mcp>=1.29.0,<2`); SDK 2.0 renamed APIs the server still uses.

## Install

`uvx` needs no install step, it fetches and runs the package on demand:

```bash
uvx mcp-server-fetch
```

With pip instead:

```bash
pip install mcp-server-fetch
python -m mcp_server_fetch
```

Install Node.js as well if you can. When `node` is on PATH the server uses a
more robust HTML simplifier (Readability) and gets noticeably better output on
messy pages.

## Configure

Claude Desktop / Claude Code (`mcpServers` block):

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}
```

VS Code uses the same shape under an `mcp.servers` key, either in User Settings
(JSON) or in a workspace `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "fetch": {
        "command": "uvx",
        "args": ["mcp-server-fetch"]
      }
    }
  }
}
```

Docker, if you want the server off the host Python:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "mcp/fetch"]
    }
  }
}
```

On Windows, set `"env": {"PYTHONIOENCODING": "utf-8"}` in the server block.
Without it the server can hang on non-ASCII pages and the client reports a
timeout that looks like a network fault.

## The tool

`fetch(url, max_length=5000, start_index=0, raw=false)`

- `max_length` caps characters returned. The response is truncated, not
  summarized.
- `start_index` resumes from a character offset, so a long page is read in
  chunks until the model finds what it needs. This is the argument agents
  forget; without it they refetch page one and conclude the content is missing.
- `raw: true` skips markdown conversion and returns the original body. Use it
  for JSON, XML, plain text, and for pages where the converter eats the part
  you actually wanted.

There is also a `fetch` prompt taking a `url`, for user-initiated fetches.

## Robots and identity

Tool calls (model initiated) obey the target's `robots.txt`. Prompt calls (user
initiated) do not, on the theory that a human asking for one page is a reader,
not a crawler. Pass `--ignore-robots-txt` to drop the check entirely; do that
only for hosts you own or are explicitly authorized to scrape, because it is
the difference between a polite client and an unwanted bot.

Default user agents:

```
ModelContextProtocol/1.0 (Autonomous; +https://github.com/modelcontextprotocol/servers)
ModelContextProtocol/1.0 (User-Specified; +https://github.com/modelcontextprotocol/servers)
```

Override with `--user-agent=YourAgent`. Set a real contact string if you fetch
at any volume, so an operator who notices your traffic can reach you instead of
banning the range.

Route through a proxy with `--proxy-url=http://host:port`.

## Domain allow and deny lists

The server has no built-in allowlist or denylist. Anything reachable from the
process is reachable from the tool, including `localhost`, link-local
`169.254.169.254`, and everything on your LAN. That is an SSRF surface with a
language model holding the steering wheel: a page the agent fetches can contain
text telling it to fetch an internal URL next.

Enforce scope outside the server:

- Run it in the Docker image on a network that cannot reach your internal
  ranges, which is the cheapest real boundary.
- Or point `--proxy-url` at a filtering forward proxy and keep the allow or
  deny list there, where it is auditable and shared across tools.
- Do not rely on prompt instructions like "only fetch public sites" as the
  control. They are a preference, not a boundary.

## Versus curl plus an extract pipeline

A shell agent can already run
`curl -sL "$url" | python -m readability | pandoc -t markdown`. What the server
buys you is that the conversion, the truncation, the chunk offsets, and the
robots check are one typed tool call with a stable schema, so the model does not
improvise a pipeline (and does not paste a URL into a shell, where quoting and
redirection are a separate hazard). What it costs you is a fixed pipeline: no
cookies, no custom headers per request, no POST, no auth. When the fetch needs
any of those, drop back to curl deliberately.

## When it earns a slot

Many agents already have native page extraction. Adding this
server duplicates that, so install it when you have a specific reason:

- The client has no built-in fetch at all (plain Claude Desktop, VS Code MCP,
  a custom host).
- You want fetching to run inside a container with its own egress rules rather
  than in the agent's process.
- Redirect chains and hostile pages: `raw: true` plus `start_index` lets the
  model inspect what a built-in extractor silently swallowed.
- You need one identity and one proxy for every page the agent touches, for
  logging or for a site that allowlists your user agent.

Skip it when the built-in extractor already handles your pages. Two tools that
do the same thing mostly teach the model to pick the wrong one.

## Debugging

```bash
npx @modelcontextprotocol/inspector uvx mcp-server-fetch
```

From a checkout of the servers repo:

```bash
cd path/to/servers/src/fetch
npx @modelcontextprotocol/inspector uv run mcp-server-fetch
```

Empty or garbage output on a page that looks fine in a browser usually means
the content is client rendered; the server does not run JavaScript. Fetch the
underlying API endpoint with `raw: true`, or use a browser-driving tool.

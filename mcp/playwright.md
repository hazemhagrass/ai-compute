# Playwright MCP

Browser automation for agents, from Microsoft. The server drives a real browser
(Chromium, Chrome, Edge, Firefox, WebKit) and hands the model a structured
accessibility snapshot of the page instead of a screenshot.

- Package: `@playwright/mcp`
- Source: https://github.com/microsoft/playwright-mcp
- Transport: stdio by default, HTTP/SSE with `--port`
- Requires: Node.js 18 or newer (browsers are downloaded on first run)

## Standard config

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Client one-liners:

```bash
claude mcp add playwright npx @playwright/mcp@latest
codex mcp add playwright npx "@playwright/mcp@latest"
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

Pin the version (`@playwright/mcp@0.0.x`) in anything shared or CI-facing.
`@latest` re-resolves on every launch, so a server that worked yesterday can
change its tool list under you.

## Why the accessibility tree beats screenshots

A screenshot-driven agent has to locate a button by pixels, which means a vision
model, a coordinate guess, and a retry when the layout shifts by 4px. Playwright
MCP returns the page as a role/name tree:

```
- button "Sign in" [ref=e17]
- textbox "Email" [ref=e12]
```

The model acts on `ref=e17`, and Playwright resolves that to a real element with
its own auto-waiting and actionability checks. Consequences:

- No vision model needed, so cheaper models can drive a browser.
- Deterministic: the same snapshot produces the same click target.
- Much smaller payloads than images for text-heavy pages, though a huge DOM
  still produces a large snapshot. Use `--mobile` or a narrow `--viewport-size`
  when pages are heavy; mobile layouts are usually lighter.
- Fails loudly. A missing ref is an error, not a click on the wrong thing.

Pixel work is still available when you genuinely need it: `--caps=vision` adds
`browser_mouse_click_xy` and friends for canvas, maps, and drag surfaces the
accessibility tree cannot describe.

## Headless vs headed

Headed is the default. The browser window is visible, which matters more than it
sounds:

- **Headed** for anything touching a logged-in session, a captcha, or a flow you
  need to watch fail. Also the mode where a human can take over mid-run.
- **Headless** (`--headless`) for CI, containers, and any machine with no
  `DISPLAY`. Headless Chromium is detected and blocked by some bot defenses, so
  a flow that works headed may 403 headless.

Idle behavior differs too: headless browsers close after an hour of no tool
calls and relaunch on the next one, headed browsers stay open. Tune with
`--idle-timeout <ms>`, `0` disables.

## Profiles and `--isolated`

Default is a **persistent profile**, stored per workspace under the platform
cache dir (`~/.cache/ms-playwright/mcp-{channel}-{workspace-hash}` on Linux).
Logins survive across sessions. Override with `--user-data-dir`.

One persistent profile serves one browser at a time. Two MCP clients in the same
workspace will fight over it.

`--isolated` keeps the profile in memory and throws it away when the browser
closes. Use it for:

- parallel agents or parallel test runs sharing a workspace,
- untrusted or throwaway browsing that must leave no cookies behind,
- reproducible runs that must not inherit yesterday's session.

Seed an isolated session with saved auth instead of logging in every time:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--isolated",
        "--storage-state=./.auth/storage.json"
      ]
    }
  }
}
```

`--storage-state` loads cookies and localStorage from a file (see
https://playwright.dev/docs/auth). Treat that file as a credential: it is a live
session. Keep it out of git.

## Container mode

The official image runs headless Chromium only.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always",
               "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

Long-lived HTTP server instead of one container per client:

```bash
docker run -d -i --rm --init --pull=always \
  -p 8931:8931 \
  mcr.microsoft.com/playwright/mcp \
  /app/cli.js --headless --browser chromium --no-sandbox --port 8931 --host 0.0.0.0
```

Clients then point at `http://localhost:8931/mcp`. Worth it when several agents
share one browser host, or to sandbox the browser away from your real profile.
Cost: no headed mode, no Firefox or WebKit, and downloads and screenshots stay
inside the container unless you mount a volume for `--output-dir`.

Bare-metal HTTP transport works the same way: `npx @playwright/mcp@latest --port
8931`, run from an environment that has `DISPLAY` if you want headed.

## Useful flags

| Flag | Use |
|---|---|
| `--browser chrome\|msedge\|firefox\|webkit` | pick engine or channel |
| `--headless` | no window, required in containers and CI |
| `--isolated` | in-memory profile, nothing persisted |
| `--storage-state <path>` | seed an isolated session with saved auth |
| `--user-data-dir <path>` | explicit persistent profile |
| `--caps vision,pdf,devtools` | opt into coordinate clicks, PDF export, devtools |
| `--device "iPhone 15"` / `--mobile` | emulation, lighter pages, fewer tokens |
| `--viewport-size 1280x720` | fix the viewport |
| `--blocked-origins`, `--block-service-workers` | trim noisy third-party traffic |
| `--output-dir <path>` | where auto-named screenshots and PDFs land |
| `--save-session`, `--save-trace` | keep a record for debugging a run |

Every flag has a `PLAYWRIGHT_MCP_*` environment variable equivalent, which is
usually cleaner in Docker and CI than editing JSON args.

Note the file access default: the server restricts reads to the workspace roots
and blocks `file://` navigation. `--allow-unrestricted-file-access` removes that
guard, so turn it on deliberately, never by habit.

## MCP or the CLI plus a skill

Microsoft ships both `@playwright/mcp` and a CLI + SKILLS route
(https://github.com/microsoft/playwright-cli), and they recommend the CLI for
coding agents. The tradeoff is context, not capability.

**CLI plus a skill wins** for a coding agent already carrying a large repo in
context (every tool schema and accessibility snapshot competes with it), for
scripted repeatable work, and when the output should be a committed
`.spec.ts` rather than a transcript.

**MCP wins** when the loop is exploratory and the agent must read structure,
act, and re-read; when state must persist across many turns; when you want
self-healing selectors; or when a non-coding agent needs a browser and has no
shell.

Rule of thumb: **known steps go in a script the agent runs through the CLI;
unknown pages go through MCP.** Mixing them is fine and common, explore with
MCP, then have the agent write the deterministic spec and run it from the CLI
from then on.

## Verify the install

```bash
npx @playwright/mcp@latest --version
npx @playwright/mcp@latest --help
```

If the browser fails to launch on a fresh Linux box, install the system
dependencies once with `npx playwright install --with-deps chromium`. In
containers, add `--no-sandbox`.

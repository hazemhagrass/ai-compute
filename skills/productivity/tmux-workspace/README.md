# Tmux Workspace

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building terminal workspaces that survive SSH drops, rebuild themselves from one scripted command, and behave identically on every machine you log into.

## What it does

`SKILL.md` is a concrete rule set for working in tmux:

- **Sessions, windows, panes.** Pick the unit by lifetime: session per project, window per long-running job, pane only for views you read side by side.
- **Naming, detaching, reattaching.** Always `tmux new -s api`, never a numbered session, attach idempotently with `new-session -A`, start the remote job inside tmux before it runs, and reattach with `attach -d` to evict the stale client.
- **Scripting a layout.** An idempotent shell function that attaches if the session exists and builds it if not, so one word rebuilds the whole workspace.
- **Copy mode, clipboard, prefix key.** vi keys, `copy-pipe-and-cancel` into the real system clipboard, `set-clipboard on` so copy works over SSH, and a prefix off `C-b` with a `send-prefix` binding for the literal key.
- **Resizing, zooming, and targeting.** `prefix z` to read, `-r` bindings and preset layouts instead of dragging borders, fully qualified `session:window.pane` targets, `respawn-pane -k` for clean restarts.
- **Nesting, persistence, portability.** Double prefix or a key-table toggle for inner sessions, resurrect/continuum with honest limits, and `if-shell` guards so one `.tmux.conf` works across tmux versions.

It ends with a checklist to run before trusting a session with real work.

## When to use this

Load this skill when any of these are true:

- You are about to start a long-running command on a remote host over SSH, or one already died because your laptop slept or the VPN dropped.
- You rebuild the same editor plus server plus test-watcher layout every morning.
- `tmux ls` shows sessions named `0`, `1`, `2` and you cannot tell which is which.
- Copying from tmux pastes nothing elsewhere, the prefix fights your shell, or `Esc` in vim feels sticky.
- You are in local tmux, SSHed into a host running tmux, and no keystroke reaches the inner session.
- You want sessions back after a reboot, or your `.tmux.conf` prints config errors on a machine with a different tmux version.

Do not load it for a single short foreground command you will watch to completion.

## Quick start

You are setting up a workspace for the `api` project on a remote box, and it has to survive the flaky hotel wifi you are on.

**1. Check what is already running before creating anything.**

```bash
tmux ls          # no server running on /tmp/tmux-1000/default
```

**2. Create a named, detached session rooted in the project directory.**

```bash
tmux new-session -d -s api -c ~/src/api -n editor
```

`-d` builds it without attaching, so the rest of the setup runs cleanly.

**3. One window per long-running job, each with an explicit directory.**

```bash
tmux new-window -t api -c ~/src/api -n server
tmux send-keys  -t api:server 'npm run dev' C-m

tmux new-window -t api -c ~/src/api -n tests
tmux split-window -t api:tests -h -c ~/src/api
tmux send-keys  -t api:tests.0 'npm test -- --watch' C-m
```

Panes appear only in `tests`, where the watcher output and the git state are read together.

**4. Confirm the targets are what you think they are.**

```bash
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command}'
# api:0.0 nvim   api:1.0 node   api:2.0 node   api:2.1 zsh
```

**5. Attach and work.**

```bash
tmux select-window -t api:editor && tmux attach -t api
```

**6. The wifi drops mid test run. Reconnect, evicting the dead client.**

```bash
ssh box && tmux attach -d -t api
```

Everything is where you left it, scrollback included, because the processes never belonged to your SSH session.

**7. Freeze the whole thing into a function so you never build it by hand again.**

```bash
# ~/.zshrc
work() {
  local name="${1:?usage: work <project>}"
  local dir="$HOME/src/$name"

  if tmux has-session -t "=$name" 2>/dev/null; then
    tmux attach -d -t "=$name"
    return
  fi

  tmux new-session -d -s "$name" -c "$dir" -n editor
  tmux send-keys   -t "$name:editor" 'nvim .' C-m
  tmux new-window  -t "$name" -c "$dir" -n server
  tmux send-keys   -t "$name:server" 'npm run dev' C-m
  tmux new-window  -t "$name" -c "$dir" -n tests
  tmux send-keys   -t "$name:tests" 'npm test -- --watch' C-m
  tmux select-window -t "$name:editor"
  tmux attach -t "$name"
}
```

**8. Make copy actually reach your clipboard, then reload and verify.**

```bash
cat >> ~/.tmux.conf <<'CONF'
setw -g mode-keys vi
set  -g set-clipboard on
set  -g history-limit 50000
set -sg escape-time 0
bind -T copy-mode-vi v send -X begin-selection
bind -T copy-mode-vi y send -X copy-pipe-and-cancel 'xclip -selection clipboard -in'
if-shell '[ -f ~/.tmux.local.conf ]' 'source-file ~/.tmux.local.conf'
CONF

tmux source-file ~/.tmux.conf    # config errors print immediately
```

Result: `work api` rebuilds the workspace on any machine, the session outlives every disconnect, and copy lands in your real clipboard.

## Key concepts

**Lifetime decides the unit.** Sessions live for days, windows for hours, panes for the minute you need two things visible. Choosing by lifetime keeps a workspace readable and scriptable.

**The tmux server owns the processes, not your terminal.** That single fact is why an SSH drop is harmless and why closing a terminal window is not the same as detaching.

**`-A` and `=` make scripts idempotent.** `new-session -A -s api` attaches or creates, and `has-session -t "=api"` matches exactly instead of prefix-matching `api-staging`.

**`send-keys` without a target types into whatever you last clicked.** Always qualify as `session:window.pane`, and check `pane_current_command`, because a pane running vim treats your command as keystrokes.

**tmux copy buffers are invisible to the rest of the system.** Without a `copy-pipe` to `pbcopy`/`xclip`/`wl-copy`, or `set-clipboard on` for OSC 52 over SSH, copying works and pasting elsewhere does nothing.

**The outer tmux wins the prefix.** When you nest, only one server can claim the key. Double-prefix reaches the inner session, or toggle the outer server onto an empty key-table while you work inside.

**Resurrect restores layout, not state.** Directories, panes, and whitelisted programs come back; process state, open transactions, and in-flight work do not. That is also why a scripted layout beats a saved one: the script is version controlled and works on a machine you have never used, while the resurrect state file is local, opaque, and quietly stale.

**A name is an address, a number is a coincidence.** Session numbers renumber when you kill one, so `attach -t 2` can land you in a different project.

**tmux options were renamed across versions.** One unguarded line in `.tmux.conf` makes tmux print an error on every launch, which is why version-specific settings need an `if-shell` guard.

## Common pitfalls

**Creating unnamed sessions**

```bash
# Bad: numbers renumber when you kill one, so -t 2 is a moving target
tmux new && tmux attach -t 2

# Good: stable, meaningful, tab-completable
tmux new-session -A -s api -c ~/src/api
```

Reason: the name is the only durable handle on a session.

**Starting the job first and tmux second**

```bash
# Bad: the process is tied to the SSH session that is about to drop
ssh box; ./long-migration.sh

# Good: the tmux server owns the process, so the disconnect is harmless
ssh box; tmux new-session -A -s migrate -c ~/src/api; ./long-migration.sh
```

Reason: tmux can only protect a process it started.

**Attaching without evicting the stale client**

```bash
# Bad: the dead connection still counts as a client and shrinks every pane
tmux attach -t api

# Good: detach other clients as you attach
tmux attach -d -t api
```

Reason: tmux sizes a window to the smallest attached client, including ghosts.

**A layout script that is not idempotent**

```bash
# Bad: re-running stacks duplicate windows onto a working session
tmux new-window -t api -n server

# Good: attach if it exists, build only if it does not
tmux has-session -t "=api" 2>/dev/null && exec tmux attach -d -t "=api"
tmux new-session -d -s api -c ~/src/api -n server
```

Reason: you will run the script again, and it must be safe the second time.

**Prefix matching in `has-session`**

```bash
tmux has-session -t api     # Bad: true for an existing api-staging session
tmux has-session -t "=api"  # Good: exact match only
```

Reason: silent attachment to the wrong project beats no failure at all.

**Unqualified `send-keys`**

```bash
tmux send-keys 'rm -rf build' C-m                  # Bad: wherever focus is
tmux send-keys -t api:server.0 'rm -rf build' C-m  # Good: explicit target
```

Reason: focus is not a stable target, and destructive commands do not forgive.

**Assuming tmux copy reaches the system clipboard**

```tmux
# Bad: lands in a tmux paste buffer nothing else can see
bind -T copy-mode-vi y send -X copy-selection-and-cancel

# Good: pipe it out, and enable OSC 52 for remote hosts
bind -T copy-mode-vi y send -X copy-pipe-and-cancel 'xclip -selection clipboard -in'
set -g set-clipboard on
```

Reason: the internal buffer is private to tmux by design.

**Leaving the prefix on `C-b`**

```tmux
# Bad: no config at all, so the prefix stays C-b, which is backward-char
# in every readline prompt you use all day

# Good: a key no shell wants, plus a way to send it literally
unbind C-b
set -g prefix C-Space
bind C-Space send-prefix
```

Reason: a prefix that collides with the shell costs you a keystroke constantly.

**Hand-resizing panes to read one of them**

```bash
tmux resize-pane -U 20             # Bad: destroys proportions you rebuild by hand
tmux resize-pane -Z -t api:tests.0 # Good: zoom (prefix z), read, unzoom
```

Reason: zoom is reversible, manual resizing is not.

**Fighting nested tmux with the same prefix**

```tmux
# Bad: no send-prefix binding, so the outer server swallows every keystroke
# and `prefix d` detaches the OUTER session

# Good: double prefix reaches the inner session
bind C-Space send-prefix
# then: prefix prefix d detaches the inner one
```

Reason: only one server can own the key, so you need an explicit escape hatch.

**Trusting resurrect to resume work**

```tmux
# Bad: assuming the restored psql pane still holds your transaction
set -g @continuum-restore 'on'

# Good: restore layout and directories, expect fresh processes
set -g @continuum-restore 'on'
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-processes 'ssh psql "~npm run dev"'
```

Reason: resurrect rebuilds the shape of the workspace, never the state inside it.

**An unguarded version-specific option**

```tmux
# Bad: tmux 2.8 refuses this and prints a config error on every launch
set -g pane-active-border-style fg=colour45

# Good: branch on the version
if-shell -b '[ "$(echo "$TMUX_VERSION < 2.9" | bc)" = 1 ]' \
  "set -g pane-active-border-fg colour45" \
  "set -g pane-active-border-style fg=colour45"
```

Reason: options were renamed across the 2.x to 3.x line and distros ship both.

## See also

- `skills/productivity/env-doctor/SKILL.md` for diagnosing the shell and environment your panes start in, and `skills/engineering/debugging/SKILL.md` for what to do with the output a session keeps alive.
- `skills/devops/docker-troubleshooting/SKILL.md` and `skills/devops/kubernetes-debugging/SKILL.md` when the processes you babysit run in containers or hold `kubectl port-forward` open.
- `man tmux`, `tmux list-keys`, and the `tmux-resurrect` / `tmux-continuum` READMEs.

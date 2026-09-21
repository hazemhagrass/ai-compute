---
name: tmux-workspace
description: "Use when a terminal job must survive an SSH drop. Enforces named tmux sessions, scripted layouts, sane copy mode, and a portable .tmux.conf."
---

# Tmux Workspace

Rules for terminal workspaces that outlive your connection, rebuild themselves
with one command, and behave the same on every machine you SSH into.

## Sessions, Windows, Panes

- Pick the unit by lifetime, not by looks. A session is a project that lives
  for days, a window is a task inside it that lives for hours, a pane is a
  view you want side by side right now. Choosing by lifetime keeps you from
  building a 14-pane grid you cannot read and cannot rebuild.
- Give each project its own session. Sessions are the only level that survives
  independently: detach from one and everything inside keeps running.
- Use windows for the three or four long-running jobs of a project (server,
  worker, tests, shell). Window switching is one keystroke and costs no screen
  space, while every extra pane shrinks the ones you already had.
- Reserve panes for things you read at the same time: code next to its test
  output. Anything you only glance at belongs in its own window.

  ```bash
  # Bad: one session, everything crammed into panes you cannot read
  tmux new
  # then split 9 times

  # Good: one session per project, windows per job, panes only for paired views
  tmux new -s api -n server
  tmux new-window -t api -n tests
  tmux split-window -t api:tests -h
  ```

## Naming

- Always create sessions with `-s <name>`. A numbered session (`0`, `1`, `2`)
  tells you nothing after lunch, and the numbers renumber themselves when you
  kill one, so `tmux attach -t 2` silently lands you in a different project.
- Name windows too, with `-n` or `,` (rename-window), because the status bar is
  the only index you get and `1:zsh 2:zsh 3:zsh` is not an index.
- Make the name match the repo directory: the session for `~/src/api` is `api`.

- Attach idempotently in shell aliases so the same command works whether or not
  the session exists:

  ```bash
  tmux new-session -A -s api -c ~/src/api
  ```

  `-A` attaches if `api` exists and creates it otherwise, which is what you
  actually meant every time you typed `tmux attach || tmux new`.

## Detach, Reattach, Survive SSH Drops

- Start every remote task inside tmux BEFORE you start the task, not after it
  is already running. This is the entire reason tmux exists: your SSH session
  dies, the tmux server on the remote host keeps every process alive, and you
  reattach to the exact scrollback you left.
- Detach with `prefix d` when you are done. Never close the terminal window to
  "leave" a session: that works, but it trains you to kill sessions by closing
  terminals, and one day the session you close is the one running a migration.
- Reattach after a drop by name, and detach any stale client so the dead
  connection stops resizing your panes to its phantom geometry:

  ```bash
  # Bad: attaches alongside a ghost client, every pane shrinks to its size
  tmux attach -t api

  # Good: kick the stale client off first
  tmux attach -d -t api
  ```

- List what is running before you guess: `tmux ls` prints every session with
  its window count and marks the ones that already have a client attached.
- Remember what tmux does NOT save: it keeps processes and scrollback alive
  across disconnects, but the tmux server dies with the host. A reboot ends
  every session unless you have explicitly persisted them (see below).

## Scripting a Layout

- Script any layout you have built by hand more than twice. Rebuilding a
  workspace pane by pane after every reboot is the tax that makes people stop
  using tmux; a script turns it into one word.
- Write the script as a shell function that is idempotent: attach if the
  session exists, build it only if it does not. Otherwise re-running it stacks
  duplicate windows onto a working session.

  ```bash
  # ~/.zshrc or ~/.bashrc
  work() {
    local name="${1:?usage: work <project>}"
    local dir="$HOME/src/$name"

    if tmux has-session -t "=$name" 2>/dev/null; then
      tmux attach -d -t "=$name"
      return
    fi

    tmux new-session  -d -s "$name" -c "$dir" -n editor
    tmux send-keys    -t "$name:editor" 'nvim .' C-m

    tmux new-window   -t "$name" -c "$dir" -n server
    tmux send-keys    -t "$name:server" 'npm run dev' C-m

    tmux new-window   -t "$name" -c "$dir" -n tests
    tmux split-window -t "$name:tests" -h -c "$dir"
    tmux send-keys    -t "$name:tests.0" 'npm test -- --watch' C-m

    tmux select-window -t "$name:editor"
    tmux attach -t "$name"
  }
  ```

- Use `-t "=$name"` in `has-session`. Without the `=` prefix tmux does prefix
  matching, so `has-session -t api` returns true for an existing `api-staging`
  and your script attaches to the wrong project.
- Always pass `-c <dir>` when creating windows and panes. New panes inherit the
  directory of the pane that created them, which drifts the moment you `cd`.
- Only script `send-keys` for commands that are safe to re-run. Never script it
  for anything destructive: a mistimed key lands in whatever shell has focus.

## Copy Mode and Clipboard

- Turn on vi keys in copy mode if your editor is vi-like, and bind selection to
  `v`/`y`. The defaults are emacs-style and fight the muscle memory you use for
  eight hours a day.
- Pipe the selection to the system clipboard explicitly. tmux copies into its
  own paste buffer by default, which is invisible to every other application,
  and that is the single most common reason people believe "tmux broke copy".

  ```tmux
  # ~/.tmux.conf
  setw -g mode-keys vi
  bind -T copy-mode-vi v send -X begin-selection
  bind -T copy-mode-vi y send -X copy-pipe-and-cancel 'xclip -selection clipboard -in'
  ```

  Swap the pipe target per platform: `pbcopy` on macOS, `wl-copy` on Wayland,
  `clip.exe` on WSL.

- Enable `set -g set-clipboard on` so OSC 52 escape sequences carry the copy
  back to your LOCAL clipboard when you are on a remote host. Over SSH there is
  no local `xclip` to pipe to, and OSC 52 is the only path that works.
- Increase scrollback once, globally: `set -g history-limit 50000`. The default
  2000 lines loses the stack trace you scrolled up to find.

## Prefix Key

- Do not leave the prefix on `C-b` if you use readline or vi: `C-b` is
  backward-char in every shell and every input box, so the prefix steals a
  keystroke you press constantly.
- Do not move it to `C-a` blindly either, because `C-a` is beginning-of-line in
  readline and the prefix key for GNU screen. If you pick it, bind a way to
  send the literal key through.

  ```tmux
  # Option A: a key no shell wants
  unbind C-b
  set -g prefix C-Space
  bind C-Space send-prefix
  ```

- Cut the escape delay to zero (`set -sg escape-time 0`) or every `Esc` in vim
  inside tmux feels sticky, which people misdiagnose as a slow terminal.

## Resizing and Zooming

- Zoom instead of resizing when you just need to read something. `prefix z`
  fills the window with the current pane and a second press restores the exact
  layout, so you never reconstruct proportions by hand.
- Bind repeatable resize keys with `-r` when you do want a permanent split
  change, so you can hold the direction instead of re-pressing the prefix:

  ```tmux
  bind -r H resize-pane -L 5
  bind -r J resize-pane -D 5
  bind -r K resize-pane -U 5
  bind -r L resize-pane -R 5
  bind -r m resize-pane -Z      # toggle zoom, repeatable
  ```

- Reach for a preset layout before hand-resizing a messy split:
  `tmux select-layout even-horizontal` (or `main-vertical`, `tiled`) fixes in
  one command what dragging borders takes a minute to approximate.

## Sending Commands to Another Pane

- Address panes explicitly as `session:window.pane` when scripting. A bare
  `send-keys` goes to the active pane, which is whatever you last clicked, and
  that is how a `rm -rf build` ends up in your database shell.

  ```bash
  # Bad: lands wherever focus happens to be
  tmux send-keys 'npm test' C-m

  # Good: fully qualified target
  tmux send-keys -t api:tests.0 'npm test' C-m
  ```

- Find the target instead of guessing it with
  `tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command}'`.
- Use `respawn-pane -k` rather than `send-keys C-c` plus a retype when a
  long-running process must restart cleanly:

  ```bash
  tmux respawn-pane -k -t api:server 'npm run dev'
  ```

- Never `send-keys` a command into a pane whose current program is not a shell.
  If the pane is running vim or a REPL, your "command" is just keystrokes in
  that program. Check `pane_current_command` first.

## Nested tmux Over SSH

- Expect nesting the moment you run tmux locally and SSH into a host that also
  runs tmux. Both servers see the same prefix, and the outer one wins every
  time, so nothing you press reaches the inner session.
- Address the inner session by pressing the prefix twice: `prefix prefix d`
  detaches the inner session, `prefix prefix c` creates a window in it. This
  works because of an explicit `send-prefix` binding, so add one:

  ```tmux
  bind C-Space send-prefix      # matches the prefix chosen above
  ```

- Alternatively, bind `F12` to toggle the outer server onto an empty key-table
  (`set prefix None ; set key-table off ; refresh-client -S`, with the inverse
  on `-T off`). For a long remote session that beats double-prefixing every
  keystroke.
- Give the remote host a visibly different status bar colour. Two identical
  status bars stacked on one screen is how a command meant for staging runs in
  production.

## Persisting Across Reboot

- Install `tmux-resurrect` and `tmux-continuum` if you want sessions back after
  a restart, and know exactly what they restore: window and pane layout, each
  pane's working directory, and a whitelist of programs. Not process state, not
  anything that was mid-flight.

  ```tmux
  set -g @plugin 'tmux-plugins/tmux-resurrect'
  set -g @plugin 'tmux-plugins/tmux-continuum'
  set -g @continuum-restore 'on'
  set -g @continuum-save-interval '15'
  set -g @resurrect-capture-pane-contents 'on'
  set -g @resurrect-processes 'ssh psql "~npm run dev"'
  ```

- Treat restored panes as empty shells in the right directory, not as a resumed
  job. A restored `npm run dev` is a fresh process, and a restored database
  shell has no transaction.
- Prefer the layout script over resurrect for anything you can rebuild from
  scratch. The script is version controlled and reproducible on a new machine,
  while the resurrect state file is local, opaque, and quietly stale.

## Portable .tmux.conf

- Never assume the tmux version. Distros ship 2.x through 3.x, and options were
  renamed across them, so an unguarded line makes tmux refuse to start and
  print a config error on every launch.
- Guard version-specific settings with an `if-shell` test rather than editing
  the file per machine:

  ```tmux
  run-shell 'tmux setenv -g TMUX_VERSION $(tmux -V | cut -d" " -f2)'

  if-shell -b '[ "$(echo "$TMUX_VERSION < 2.9" | bc)" = 1 ]' \
    "set -g pane-active-border-fg colour45" \
    "set -g pane-active-border-style fg=colour45"
  ```

- Split machine-specific settings out and source them conditionally, so the
  shared file stays identical everywhere:

  ```tmux
  if-shell '[ -f ~/.tmux.local.conf ]' 'source-file ~/.tmux.local.conf'
  ```

- Keep the clipboard command in that local file, since it is the one line that
  genuinely differs per platform (`pbcopy`, `xclip`, `wl-copy`, `clip.exe`).
- Reload and verify after every edit instead of discovering the breakage on
  your next login:

  ```bash
  tmux source-file ~/.tmux.conf   # errors print immediately
  ```

## Quick Checklist

- Session created with `-s <name>` and `-c <dir>`, never numbered?
- Long remote job started INSIDE tmux before it started running?
- Reattached with `attach -d` so no stale client is resizing your panes?
- Layout scripted as an idempotent function using `has-session -t "=name"`?
- `send-keys` targets fully qualified as `session:window.pane`?
- Copy bound to the system clipboard, with `set-clipboard on` for remote hosts?
- Prefix key not colliding with your shell, `escape-time` at 0?
- Version-specific config guarded by `if-shell`, local bits in `~/.tmux.local.conf`?

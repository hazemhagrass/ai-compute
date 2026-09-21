"use client";

import { useState } from "react";

export default function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSetup = !configured;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSetup && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: isSetup ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        setPassword("");
        return;
      }

      // Full reload rather than router.push: the layout and every server
      // component must re-render now that a session exists.
      window.location.href = new URLSearchParams(window.location.search).get("next") ?? "/";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="amr-in w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          AI Model{" "}
          <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
            Router
          </span>
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--fg-muted)]">
          {isSetup
            ? "Set a password. It guards your stored API keys and your prompt history."
            : "Sign in to continue."}
        </p>

        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-6"
        >
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete={isSetup ? "new-password" : "current-password"}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          {isSetup && (
            <>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <p className="text-[11px] text-[var(--fg-dim)]">
                At least 12 characters. There is no recovery: if you lose it, delete
                the auth row from the database to reset.
              </p>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-xs text-[var(--bad)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] px-4 py-3 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : isSetup ? "Set password" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

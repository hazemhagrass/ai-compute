"use client";

import { useState } from "react";

import type { Model, Task } from "@/lib/types";

/** One turn rendered in the conversation thread. */
interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Cumulative usage across the whole conversation, as reported by the API. */
interface Totals {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

interface RunEvent {
  costUsd: number;
  totalTokens: number;
  latencyMs: number;
  ok: boolean;
}

/** NDJSON frames streamed back by /api/playground. */
type StreamFrame =
  | { type: "token"; text: string }
  | { type: "done"; text: string; event: RunEvent; totals: Totals; streamed: boolean }
  | { type: "error"; error: string; event: RunEvent | null; totals: Totals | null };

interface Props {
  models: Model[];
  tasks: Task[];
  onToast: (message: string, tone?: "info" | "good" | "bad") => void;
}

export default function PlaygroundPanel({ models, tasks, onToast }: Props) {
  const enabled = models.filter((m) => m.enabled);
  // The default model is derived at render time rather than stored in state,
  // so no setState runs inside an effect to pick the first enabled model.
  const [chosenModelRowId, setChosenModelRowId] = useState<number | null>(null);
  const modelRowId =
    chosenModelRowId !== null && enabled.some((m) => m.id === chosenModelRowId)
      ? chosenModelRowId
      : (enabled[0]?.id ?? null);
  const [taskSlug, setTaskSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [thread, setThread] = useState<Turn[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const modelLabel = enabled.find((m) => m.id === modelRowId)?.label ?? "";

  /**
   * Start a fresh conversation. Called from user actions (model/task switch,
   * New chat) rather than an effect, so prior turns are never billed against
   * a configuration that never saw them and no setState runs inside an effect.
   */
  function resetThread() {
    setThread([]);
    setTotals(null);
    setLatencyMs(null);
    setError("");
  }

  // Switching model or task starts a fresh conversation from user actions
  // (not an effect), so prior turns are never billed against a configuration
  // that never saw them and no setState runs inside an effect body.
  function pickModel(id: number) {
    setChosenModelRowId(id);
    resetThread();
  }

  function pickTask(slug: string) {
    setTaskSlug(slug);
    resetThread();
  }

  /** Surface a failure in the panel and via the shared toast queue. */
  function fail(message: string) {
    setError(message);
    onToast(message, "bad");
  }

  /** Apply one streamed frame to the UI; token frames append to the last assistant turn. */
  function applyFrame(frame: StreamFrame): void {
    if (frame.type === "token") {
      setThread((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + frame.text };
        }
        return next;
      });
      return;
    }
    if (frame.totals) setTotals(frame.totals);
    if (frame.event) setLatencyMs(frame.event.latencyMs);
    if (frame.type === "error") {
      fail(frame.error);
      // Drop the empty assistant placeholder when nothing arrived.
      setThread((t) => {
        const last = t[t.length - 1];
        return last?.role === "assistant" && !last.content ? t.slice(0, -1) : t;
      });
      return;
    }
    // done: swap the accumulated partial for the final server text so the
    // thread matches the recorded usage exactly, even on the fallback path.
    setThread((t) => {
      const next = [...t];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = { ...last, content: frame.text };
      }
      return next;
    });
  }

  async function run() {
    if (!modelRowId || !prompt.trim() || running) return;
    setRunning(true);
    setError("");
    const userText = prompt.trim();
    // Append the user turn and an empty assistant turn up front; token frames
    // grow the assistant bubble live as they stream in.
    setThread((t) => [
      ...t,
      { role: "user", content: userText },
      { role: "assistant", content: "" },
    ]);
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelRowId,
          prompt: userText,
          system: system || undefined,
          taskSlug: taskSlug || undefined,
          // Prior turns so the model sees the whole conversation, and the
          // totals measured so far so the API returns a running total.
          messages: thread,
          priorTotals: totals ?? undefined,
        }),
      });
      if (!res.ok) {
        // Pre-stream failures (404 model, 400 body) still arrive as JSON.
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        fail(data?.error ?? `HTTP ${res.status}`);
        setThread((t) => t.slice(0, -2));
        return;
      }
      if (!res.body) {
        fail("response has no body");
        setThread((t) => t.slice(0, -2));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          applyFrame(JSON.parse(line) as StreamFrame);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) applyFrame(JSON.parse(buffer) as StreamFrame);

      setPrompt("");
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      setThread((t) => {
        const last = t[t.length - 1];
        return last?.role === "assistant" && !last.content ? t.slice(0, -1) : t;
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Playground: {modelLabel || "pick a model"}
        </h3>
        {thread.length > 0 && (
          <button
            onClick={resetThread}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            New chat
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={modelRowId ?? ""}
          onChange={(e) => pickModel(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          {modelRowId === null && <option value="">Pick a model</option>}
          {enabled.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={taskSlug}
          onChange={(e) => pickTask(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          <option value="">No task</option>
          {tasks.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={system}
        onChange={(e) => setSystem(e.target.value)}
        placeholder="System prompt (optional)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      />

      {thread.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
          {thread.map((turn, i) => (
            <div key={i} className="text-sm">
              <span
                className={`text-xs font-semibold uppercase ${
                  turn.role === "user"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {turn.role === "user" ? "You" : modelLabel || "Model"}
              </span>
              <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {turn.content}
                {running && i === thread.length - 1 && turn.role === "assistant" && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-500 align-baseline" />
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={thread.length > 0 ? "Continue the conversation" : "Type a prompt and press Enter"}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={run}
          disabled={!modelRowId || running || !prompt.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? "Running..." : thread.length > 0 ? "Send" : "Run"}
        </button>
      </div>

      {error && (
        <pre className="rounded-lg bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </pre>
      )}

      {totals && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Conversation totals ({totals.turns} turn{totals.turns === 1 ? "" : "s"}):{" "}
          {totals.totalTokens.toLocaleString()} tokens (
          {totals.inputTokens.toLocaleString()} in / {totals.outputTokens.toLocaleString()} out), $
          {totals.costUsd.toFixed(4)}
          {latencyMs !== null ? `, last call ${latencyMs}ms` : ""}
        </div>
      )}
    </div>
  );
}

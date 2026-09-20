"use client";

import { useCallback, useEffect, useState } from "react";

import type { Model, Provider, Task } from "@/lib/types";

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text.slice(0, 300) };
  }
  if (!res.ok) {
    const msg =
      (parsed as { error?: string })?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return parsed as T;
}

export interface Catalog {
  providers: Provider[];
  models: Model[];
  tasks: Task[];
}

/** Loads providers + models + tasks together and exposes a refresh handle. */
export function useCatalog() {
  const [data, setData] = useState<Catalog>({ providers: [], models: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Await first: calling setState synchronously inside an effect body
    // triggers cascading renders (React 19 compiler rule).
    try {
      const [p, m, t] = await Promise.all([
        api<{ providers: Provider[] }>("/api/providers"),
        api<{ models: Model[] }>("/api/models"),
        api<{ tasks: Task[] }>("/api/tasks"),
      ]);
      setError(null);
      setData({ providers: p.providers, models: m.models, tasks: t.tasks });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...data, loading, error, refresh };
}

/** Tiny toast queue — no dependency. */
export interface Toast {
  id: number;
  message: string;
  tone: "info" | "good" | "bad";
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return { toasts, push };
}

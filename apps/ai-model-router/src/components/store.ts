"use client";

import { useCallback, useState } from "react";

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

/**
 * Catalog state seeded from the server render.
 *
 * There is deliberately no fetch-on-mount effect: the initial data arrives as
 * props from a Server Component that read SQLite directly, so the first paint
 * is real content rather than a spinner. `refresh` exists for use after a
 * mutation, and runs from an event handler, where updating state is expected.
 */
export function useCatalog(initial: Catalog) {
  const [data, setData] = useState<Catalog>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
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
      setRefreshing(false);
    }
  }, []);

  return { ...data, refreshing, error, refresh };
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

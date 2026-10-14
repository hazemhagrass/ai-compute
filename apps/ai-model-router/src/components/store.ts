"use client";

import { useCallback, useState } from "react";

import type { Model, Provider, Task } from "@/lib/types";

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  return (await apiWithMeta<T>(path, init)).data;
}

export async function apiWithMeta<T>(
  path: string,
  init?: RequestInit & {
    json?: unknown;
    throwOnError?: boolean;
    raw?: boolean;
  },
): Promise<{ data: T; res: Response }> {
  const { json, throwOnError = true, raw = false, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (raw) {
    if (!res.ok && throwOnError) {
      const msg = `HTTP ${res.status} ${res.statusText}`;
      throw new ApiResponseError(msg, null);
    }
    return { data: null as T, res };
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text.slice(0, 300) };
  }
  if (!res.ok && throwOnError) {
    const msg =
      (parsed as { error?: string })?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiResponseError(msg, parsed);
  }
  return { data: parsed as T, res };
}

export class ApiResponseError extends Error {
  body: unknown;
  constructor(message: string, body: unknown) {
    super(message);
    this.name = "ApiResponseError";
    this.body = body;
  }
}

export interface Catalog {
  providers: Provider[];
  models: Model[];
  tasks: Task[];
}

export function useCatalog(initial: Catalog) {
  const [data, setData] = useState<Catalog>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, m, t] = await Promise.all([
        api<{ providers: Provider[] }>("/api/providers"),
        api<{ models: Model[] }>("/api/models?all=1"),
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

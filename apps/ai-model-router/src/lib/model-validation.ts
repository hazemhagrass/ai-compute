import { fetchModelsFromProvider } from "./client";
import type { Provider } from "./types";

export type ModelIdValidation =
  | { status: "ok" }
  | { status: "skipped"; reason: "no-discovery" }
  | { status: "unverifiable"; reason: string }
  | { status: "mismatch"; modelId: string; suggestions: string[]; catalogueSize: number };

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev2: number[] | null = null;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, prev2[j - 2] + cost);
      }
      curr[j] = best;
    }
    prev2 = prev;
    prev = curr;
    curr = new Array<number>(n + 1);
  }
  return prev[n];
}

export function closestModelIds(
  submitted: string,
  catalogueIds: string[],
  limit = 5,
): string[] {
  const needle = submitted.trim().toLowerCase();
  if (!needle) return [];

  const prefix: string[] = [];
  const scored: { id: string; d: number }[] = [];
  for (const id of catalogueIds) {
    const hay = id.toLowerCase();
    if (hay.startsWith(needle) || needle.startsWith(hay)) {
      prefix.push(id);
    }
    scored.push({ id, d: editDistance(needle, hay) });
  }

  scored.sort((x, y) => x.d - y.d || x.id.localeCompare(y.id));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of prefix.sort((a, b) => a.localeCompare(b))) {
    if (out.length >= limit) break;
    seen.add(id);
    out.push(id);
  }
  for (const { id } of scored) {
    if (out.length >= limit) break;
    if (seen.has(id)) continue;
    out.push(id);
  }
  return out;
}

export async function validateModelIdAgainstProvider(
  provider: Provider,
  modelId: string,
): Promise<ModelIdValidation> {
  if (!provider.modelsPath?.trim()) {
    return { status: "skipped", reason: "no-discovery" };
  }

  const submitted = modelId.trim();
  let discovered;
  try {
    discovered = await fetchModelsFromProvider(provider);
  } catch (err) {
    return {
      status: "unverifiable",
      reason: err instanceof Error ? err.message : "provider discovery failed",
    };
  }

  const ids = discovered.map((d) => d.id);
  if (ids.includes(submitted)) return { status: "ok" };

  return {
    status: "mismatch",
    modelId: submitted,
    suggestions: closestModelIds(submitted, ids),
    catalogueSize: ids.length,
  };
}

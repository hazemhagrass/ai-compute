/**
 * Soft existence validation for submitted model ids.
 *
 * When a provider has a discovery endpoint (modelsPath set), a create or
 * update of a model row checks the submitted modelId against the provider's
 * live catalogue before saving. A miss is not silently saved: the route
 * answers 409 with a 'did-you-mean' list of the closest catalogue ids so a
 * typo like "gpt-4o-min" is caught at entry instead of at first chat call.
 *
 * Validation is deliberately soft, never a silent save and never a hard
 * network dependency:
 *   - providers without a modelsPath skip validation entirely
 *   - a failed or unparsable discovery fetch is "unverifiable", not an error;
 *     the save proceeds
 *   - all fetching goes through the same SSRF-guarded path as chat and
 *     discovery (fetchModelsFromProvider), never a raw fetch of the URL
 */
import { fetchModelsFromProvider } from "./client";
import type { Provider } from "./types";

export type ModelIdValidation =
  | { status: "ok" }
  | { status: "skipped"; reason: "no-discovery" }
  | { status: "unverifiable"; reason: string }
  | { status: "mismatch"; modelId: string; suggestions: string[]; catalogueSize: number };

/* ------------------------------------------------------- closest matches */

/**
 * Damerau-Levenshtein distance with the transposition row, small enough for
 * catalogue-sized comparisons (catalogues are a few hundred ids at most).
 */
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

/**
 * The closest catalogue ids to `submitted`, best distance first, ties broken
 * alphabetically. Ids sharing a prefix with the submission are always
 * included (within the cap) because "gpt-4o" vs "gpt-4o-mini" is the common
 * case and pure edit distance buries it under unrelated short ids.
 */
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

/* ------------------------------------------------------------ validation */

/**
 * Check `modelId` against the provider's discovered catalogue.
 *
 * Exported for tests; the routes call this once, after the body has parsed,
 * and only act on the "mismatch" result.
 */
export async function validateModelIdAgainstProvider(
  provider: Provider,
  modelId: string,
): Promise<ModelIdValidation> {
  // No discovery endpoint means there is nothing to check against. Saving
  // must not be blocked for such providers.
  if (!provider.modelsPath?.trim()) {
    return { status: "skipped", reason: "no-discovery" };
  }

  const submitted = modelId.trim();
  let discovered;
  try {
    discovered = await fetchModelsFromProvider(provider);
  } catch (err) {
    // Discovery failure is not a hard error: the provider may be briefly
    // down or its catalogue endpoint may differ from the chat path. Treat
    // the id as unverifiable and let the save proceed.
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

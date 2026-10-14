export interface CompareDraft {
  modelA: string;
  modelB: string;
  prompt: string;
}

export type BuildCompareBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string | null };

export function buildCompareBody(
  draft: CompareDraft,
  busy: boolean,
): BuildCompareBodyResult {
  const sameModel = draft.modelA !== "" && draft.modelA === draft.modelB;
  const canRun =
    !busy &&
    draft.modelA !== "" &&
    draft.modelB !== "" &&
    !sameModel &&
    draft.prompt.trim() !== "";

  if (!canRun) return { ok: false, error: sameModel ? "pick two different models" : null };

  return {
    ok: true,
    body: {
      modelRowIdA: Number(draft.modelA),
      modelRowIdB: Number(draft.modelB),
      prompt: draft.prompt,
    },
  };
}

export function compareDisabledHint(
  draft: CompareDraft,
  busy: boolean,
): string | null {
  if (!busy && draft.modelA !== "" && draft.modelA === draft.modelB) {
    return "pick two different models";
  }
  return null;
}

export function compareReady(draft: CompareDraft, busy: boolean): boolean {
  return (
    !busy &&
    draft.modelA !== "" &&
    draft.modelB !== "" &&
    draft.modelA !== draft.modelB &&
    draft.prompt.trim() !== ""
  );
}

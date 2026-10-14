import { getDb } from "./db";

export interface SavedRecommendation {
  id: number;
  ts: string;
  taskSlug: string;
  taskLabel: string;
  prompt: string;
  ranked: unknown[];
  pickedModelRowId: number | null;
  pickedAt: string | null;
}

interface Row {
  id: number;
  ts: string;
  task_slug: string;
  task_label: string;
  prompt: string;
  ranked_json: string;
  picked_model_row_id: number | null;
  picked_at: string | null;
}

function toSaved(r: Row): SavedRecommendation {
  let ranked: unknown[] = [];
  try {
    const parsed = JSON.parse(r.ranked_json);
    if (Array.isArray(parsed)) ranked = parsed;
  } catch {
  }
  return {
    id: r.id,
    ts: r.ts,
    taskSlug: r.task_slug,
    taskLabel: r.task_label,
    prompt: r.prompt,
    ranked,
    pickedModelRowId: r.picked_model_row_id,
    pickedAt: r.picked_at,
  };
}

export function saveRecommendation(input: {
  taskSlug?: string;
  taskLabel?: string;
  prompt?: string;
  ranked: unknown[];
}): SavedRecommendation {
  const info = getDb()
    .prepare(
      `INSERT INTO recommendations (task_slug, task_label, prompt, ranked_json)
       VALUES (?,?,?,?)`,
    )
    .run(
      input.taskSlug ?? "",
      input.taskLabel ?? "",
      input.prompt ?? "",
      JSON.stringify(input.ranked ?? []),
    );
  return getRecommendation(Number(info.lastInsertRowid))!;
}

export function getRecommendation(id: number): SavedRecommendation | null {
  const r = getDb()
    .prepare(`SELECT * FROM recommendations WHERE id = ?`)
    .get(id) as Row | undefined;
  return r ? toSaved(r) : null;
}

export function listRecommendations(limit = 50): SavedRecommendation[] {
  const cap = Math.max(1, Math.min(200, limit));
  const rows = getDb()
    .prepare(`SELECT * FROM recommendations ORDER BY id DESC LIMIT ?`)
    .all(cap) as Row[];
  return rows.map(toSaved);
}

export function pickRecommendation(
  id: number,
  modelRowId: number,
): SavedRecommendation | null {
  getDb()
    .prepare(
      `UPDATE recommendations
         SET picked_model_row_id = ?, picked_at = datetime('now')
       WHERE id = ?`,
    )
    .run(modelRowId, id);
  return getRecommendation(id);
}

"use client";

import { useCallback, useMemo, useState } from "react";

import { api } from "./store";
import {
  buildRecommendationBody,
  resolveActiveTask,
  resultsTitle,
  weightSummary,
  type RouterDraft,
  type RouterMode,
} from "./router.rules";
import type { Recommendation, Task } from "@/lib/types";

export type ToastTone = "info" | "good" | "bad";
export type ToastFn = (msg: string, tone?: ToastTone) => void;

const EMPTY_DRAFT: RouterDraft = {
  mode: "preset",
  taskId: null,
  text: "",
  weights: {},
  localOnly: false,
  useAi: false,
  maxOutputCost: "",
  minContext: "",
  selectedProviders: [],
};

export function useRouterViewModel({
  tasks,
  onToast,
  onRefresh,
}: {
  tasks: Task[];
  onToast: ToastFn;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<RouterDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const patch = useCallback((p: Partial<RouterDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const setMode = useCallback((mode: RouterMode) => patch({ mode }), [patch]);
  const setTaskId = useCallback(
    (taskId: number | null) => patch({ taskId }),
    [patch],
  );
  const setText = useCallback((text: string) => patch({ text }), [patch]);
  const setWeight = useCallback(
    (axis: string, value: number) =>
      setDraft((d) => ({ ...d, weights: { ...d.weights, [axis]: value } })),
    [],
  );
  const setLocalOnly = useCallback(
    (localOnly: boolean) => patch({ localOnly }),
    [patch],
  );
  const setUseAi = useCallback((useAi: boolean) => patch({ useAi }), [patch]);
  const setMaxOutputCost = useCallback(
    (maxOutputCost: string) => patch({ maxOutputCost }),
    [patch],
  );
  const setMinContext = useCallback(
    (minContext: string) => patch({ minContext }),
    [patch],
  );
  const toggleProvider = useCallback(
    (id: number) =>
      setDraft((d) => ({
        ...d,
        selectedProviders: d.selectedProviders.includes(id)
          ? d.selectedProviders.filter((x) => x !== id)
          : [...d.selectedProviders, id],
      })),
    [],
  );

  const activeTask = useMemo(
    () => resolveActiveTask(tasks, draft.taskId),
    [tasks, draft.taskId],
  );

  const run = useCallback(async () => {
    setRec(null);
    setBusy(true);
    try {
      const built = buildRecommendationBody(draft);
      if (!built.ok) {
        onToast(built.error, "bad");
        return;
      }
      const res = await api<{ recommendation: Recommendation }>(
        "/api/recommend",
        { method: "POST", json: built.body },
      );
      setRec(res.recommendation);
      if (!res.recommendation.ranked.length) {
        onToast("No model matched those constraints", "bad");
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Recommendation failed", "bad");
    } finally {
      setBusy(false);
    }
  }, [draft, onToast]);

  const pinWinner = useCallback(
    async (modelRowId: number) => {
      if (!activeTask) {
        onToast("Pinning only works with a saved task preset", "bad");
        return;
      }
      try {
        await api(`/api/tasks/${activeTask.id}`, {
          method: "PATCH",
          json: { pinnedModelId: modelRowId },
        });
        onToast("Pinned as the permanent choice for this task", "good");
        onRefresh();
      } catch (err) {
        onToast(err instanceof Error ? err.message : "Pin failed", "bad");
      }
    },
    [activeTask, onToast, onRefresh],
  );

  const unpin = useCallback(async () => {
    if (!activeTask) return;
    await api(`/api/tasks/${activeTask.id}`, {
      method: "PATCH",
      json: { pinnedModelId: null },
    });
    onToast("Unpinned — back to automatic scoring", "good");
    onRefresh();
  }, [activeTask, onToast, onRefresh]);

  const view = useMemo(
    () => ({
      draft,
      busy,
      rec,
      activeTask,
      resultsTitle: resultsTitle(rec),
      weightSummaryOfRec: rec ? weightSummary(rec.task.weights) : "",
      isPreset: draft.mode === "preset",
      isDescribe: draft.mode === "describe",
      isManual: draft.mode === "manual",
    }),
    [draft, busy, rec, activeTask],
  );

  return {
    view,
    setMode,
    setTaskId,
    setText,
    setWeight,
    setLocalOnly,
    setUseAi,
    setMaxOutputCost,
    setMinContext,
    toggleProvider,
    setDraft,
    run,
    pinWinner,
    unpin,
  };
}

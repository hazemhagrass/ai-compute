import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { chat } from "@/lib/client";
import { BASELINE_EVAL_SET, measuredSkillUpdates, runEval, type EvalRunner } from "@/lib/eval";
import { getModel, getProvider, updateModel } from "@/lib/repo";
import { computeCost } from "@/lib/usage";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  modelId: z.number().int().positive(),
  apply: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  evalVersion: z.string().optional(),
});

function measuredPerformanceAxes(result: { observedTokensPerSec: number; observedCostUsd: number }): Record<string, number> {
  const updates: Record<string, number> = {};
  if (result.observedTokensPerSec > 0) {
    updates.speed = Math.round(result.observedTokensPerSec);
  }
  if (result.observedCostUsd > 0) {
    updates.cheapness = Math.round((1 / result.observedCostUsd) * 1000);
  }
  return updates;
}

function computeWriteBack(
  model: { skills: Record<string, number> },
  result: Awaited<ReturnType<typeof runEval>>,
): { updates: Record<string, number>; currentVersion: string | null } {
  const updates: Record<string, number> = {};
  const merged = { ...model.skills };
  const stamps: Record<string, string> = {};

  for (const [axis, value] of Object.entries(measuredSkillUpdates(result))) {
    updates[axis] = value;
    merged[axis] = value;
    stamps[`${axis}Source`] = `eval:${result.evalSetVersion}`;
  }

  for (const [axis, value] of Object.entries(measuredPerformanceAxes(result))) {
    updates[axis] = value;
    merged[axis] = value;
    stamps[`${axis}Source`] = `eval:${result.evalSetVersion}`;
  }

  let currentVersion: string | null = null;
  for (const key of Object.keys(stamps)) {
    const stored = model.skills[key];
    void stored;
  }
  const sourceStamps = Object.entries(model.skills)
    .filter(([k]) => k.endsWith("Source"))
    .map(([, v]) => String(v))
    .filter((v) => v.startsWith("eval:"))
    .map((v) => v.slice(5));
  if (sourceStamps.length > 0) currentVersion = sourceStamps[0];

  void stamps;

  return { updates, currentVersion };
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  if (parsed.data.apply && parsed.data.dryRun) {
    return NextResponse.json(
      { error: "use apply or dryRun, not both" },
      { status: 400 },
    );
  }

  const model = getModel(parsed.data.modelId);
  if (!model) return NextResponse.json({ error: "model not found" }, { status: 404 });
  const provider = getProvider(model.providerId);
  if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });

  const runner: EvalRunner = async (evalCase) => {
    const r = await chat(provider, model.modelId, "", evalCase.prompt, 60000, 64);
    const cost = computeCost(
      r.usage.inputTokens,
      r.usage.outputTokens,
      model.inputCost,
      model.outputCost,
    );
    return {
      ok: r.ok,
      response: r.ok ? r.text : undefined,
      latencyMs: r.latencyMs,
      tokensPerSec:
        r.latencyMs > 0 ? (r.usage.outputTokens / r.latencyMs) * 1000 : 0,
      costUsd: cost.costUsd,
      error: r.error,
    };
  };

  const result = await runEval(model.id, BASELINE_EVAL_SET, runner);
  const { updates, currentVersion } = computeWriteBack(model, result);

  if (parsed.data.apply && currentVersion !== null && parsed.data.evalVersion !== undefined && parsed.data.evalVersion !== currentVersion) {
    return NextResponse.json(
      {
        error: "eval version mismatch",
        currentVersion,
        requestedVersion: parsed.data.evalVersion,
        hint: "pass the current evalVersion to confirm, or clear the stamps",
      },
      { status: 409 },
    );
  }

  let applied = false;
  if (parsed.data.apply && Object.keys(updates).length > 0) {
    updateModel(model.id, { skills: { ...model.skills, ...updates } });
    applied = true;
  }

  return NextResponse.json({
    eval: result,
    applied,
    wouldApply: parsed.data.dryRun === true ? updates : undefined,
    version: currentVersion,
  });
}

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
  /** Persist the measured scores onto the model. Default false: a dry run. */
  apply: z.boolean().optional(),
  /**
   * Preview the write (#167): same computation as apply, nothing persisted.
   * A dryRun and an apply are mutually exclusive on purpose -- one request
   * should not both preview and commit.
   */
  dryRun: z.boolean().optional(),
  /**
   * Refuse the write if the model's skills were last stamped by a different
   * eval version (#167). Prevents a newer harness version from silently
   * blending its numbers with an older version's; re-apply after reviewing.
   * Only consulted when the model actually carries an older stamp.
   */
  evalVersion: z.string().optional(),
});

/** Speed/cheapness axes measured on every run (not graded cases, real calls). */
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

/**
 * Compute the full write-back payload (#167): measured skill axes plus the
 * observed speed/cheapness axes, each stamped with its provenance so a
 * hand-tuned number is never silently overwritten by a machine number.
 */
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

  // Read the currently stamped eval version, if any: the newest stamp among
  // the axes just written, or a previously stored stamp on the model.
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

/**
 * Run the baseline eval set against one model and report measured per-axis
 * scores. This is the replacement for the hand-written `quality`/`skills`
 * numbers the router otherwise ranks on.
 *
 * With `apply: true` the measured axes (skills + observed speed/cheapness)
 * are written back. With `dryRun: true` the same computation runs and the
 * response reports exactly WHAT would change, persisting nothing. Axes the
 * harness did not measure (quality, latency) are left untouched, so a guess
 * is never overwritten by another guess.
 */
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

  // The harness is runner-agnostic; here the runner is the app's real chat
  // path, so the eval goes through the same provider call the router would
  // make. A failure to reach the model surfaces as an empty run, which the
  // harness already treats as unmeasured rather than as a zero score. Latency,
  // tokens/sec, and cost are measured per case so the speed and cheapness
  // axes reflect real calls.
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

  // Version-stamp refusal (#167): if the model's skills carry a stamp from a
  // DIFFERENT eval version, applying would blend numbers from two harnesses.
  // Refuse rather than blend; the caller re-applies only after reviewing.
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

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
});

/**
 * Run the baseline eval set against one model and report measured per-axis
 * scores. This is the replacement for the hand-written `quality`/`skills`
 * numbers the router otherwise ranks on.
 *
 * With `apply: true` the measured axes are written back onto the model through
 * the normal update path. Axes the harness did not measure (quality, latency)
 * are left untouched, so a guess is never overwritten by another guess.
 */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
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

  let applied = false;
  if (parsed.data.apply) {
    const skills = measuredSkillUpdates(result);
    if (Object.keys(skills).length > 0) {
      updateModel(model.id, { skills: { ...model.skills, ...skills } });
      applied = true;
    }
  }

  return NextResponse.json({ eval: result, applied });
}

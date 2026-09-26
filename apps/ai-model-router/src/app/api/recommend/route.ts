import { NextResponse } from "next/server";

import { chat } from "@/lib/client";
import { rankModels, taskFromText, type RankProvider } from "@/lib/engine";
import { explainExclusions } from "@/lib/exclusions";
import { getProvider, getTask, getTaskBySlug, listModels, listProviders } from "@/lib/repo";
import { saveRecommendation } from "@/lib/recommendations";
import { getRoutingPolicy } from "@/lib/routing-policy";
import { parseBody, recommendSchema } from "@/lib/schemas";
import { checkEntitlement } from "@/lib/subscriptions";
import { computeCost, recordUsage } from "@/lib/usage";
import type { Recommendation, Scored, Task } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface RecommendBody {
  taskId?: number;
  taskSlug?: string;
  /** Free-text use case when no preset matches. */
  text?: string;
  overrideWeights?: Record<string, number>;
  providerIds?: number[];
  localOnly?: boolean;
  ignorePin?: boolean;
  maxOutputCost?: number;
  minContext?: number;
  limit?: number;
  /** Ask a real LLM to pick from the shortlist and explain why. */
  useAi?: boolean;
  /** Which model does the judging (models table row id). */
  judgeModelId?: number;
}

function resolveTask(body: RecommendBody): Task | null {
  if (body.taskId) return getTask(body.taskId);
  if (body.taskSlug) return getTaskBySlug(body.taskSlug);
  if (body.text?.trim()) return taskFromText(body.text);
  return null;
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, recommendSchema);
  if (!parsed.ok) return parsed.response;
  const body: RecommendBody = parsed.data;

  const task = resolveTask(body);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const providers = listProviders();
  const localProviderIds = providers.filter((p) => p.kind === "local").map((p) => p.id);
  const providerIds = body.localOnly
    ? (body.providerIds?.length
        ? body.providerIds.filter((id) => localProviderIds.includes(id))
        : localProviderIds)
    : body.providerIds;

  const models = listModels({ enabledOnly: true });
  // Persisted policy is the baseline; an explicit request field wins over it,
  // so the UI sliders still work but a saved ceiling applies when the caller
  // says nothing. Zero in the policy means "no cap" and must not become a
  // filter of `<= 0`.
  const policy = getRoutingPolicy();
  const providerMap: ReadonlyMap<number, RankProvider> = new Map(
    providers.map((p) => [p.id, { id: p.id, kind: p.kind, enabled: p.enabled }]),
  );
  // The report must see the same population the ranker filters, including the
  // disabled rows, or the result would claim exclusions it never considered.
  const criteria = {
    overrideWeights: { ...policy.overrideWeights, ...body.overrideWeights },
    providerIds,
    ignorePin: body.ignorePin,
    maxOutputCost:
      body.maxOutputCost ?? (policy.maxOutputCostPer1M > 0 ? policy.maxOutputCostPer1M : undefined),
    minContext: body.minContext ?? (policy.minContext > 0 ? policy.minContext : undefined),
    limit: Math.min(25, Math.max(1, body.limit ?? 8)),
    task,
    providers: providerMap,
    checkEntitlement: policy.enforceEntitlements ? checkEntitlement : undefined,
    fallbackToLocal: policy.fallbackToLocal,
    preferLocal: policy.preferLocal,
  };
  const ranked = rankModels(task, models, criteria);
  const exclusions = explainExclusions(models, criteria);

  if (ranked.length === 0 && policy.strictEmpty) {
    return NextResponse.json(
      {
        error: "no model satisfies the routing policy",
        exclusions,
        hint: "loosen the policy in Settings, add a subscription, or enable a local provider",
      },
      { status: 422 },
    );
  }

  const result: Recommendation = {
    task,
    ranked,
    exclusions,
    generatedAt: new Date().toISOString(),
  };

  if (body.useAi && ranked.length > 1) {
    const ai = await aiPick(task, ranked, body.judgeModelId);
    if (ai) result.ai = ai;
  }

  // Persist the recommendation so a choice can be revisited later. The ranked
  // list is stored as a snapshot, not re-derived, because the point is to see
  // what the router said at the time. A persistence failure must not fail the
  // recommendation the user is waiting on.
  let recommendationId: number | null = null;
  try {
    recommendationId = saveRecommendation({
      taskSlug: task.slug,
      taskLabel: task.label,
      prompt: body.text ?? "",
      ranked,
    }).id;
  } catch {
    recommendationId = null;
  }

  return NextResponse.json({ recommendation: result, recommendationId });
}

/** Ask a configured LLM to choose among the top candidates, and log the call. */
async function aiPick(
  task: Task,
  ranked: Scored[],
  judgeModelId?: number,
): Promise<Recommendation["ai"] | null> {
  const shortlist = ranked.slice(0, 6);
  const judge = judgeModelId
    ? shortlist.find((s) => s.model.id === judgeModelId) ??
      listModels({ enabledOnly: true }).find((m) => m.id === judgeModelId)
    : null;

  const judgeModel = (judge && "model" in judge ? judge.model : judge) ?? shortlist[0].model;
  const provider = getProvider(judgeModel.providerId);
  if (!provider) return null;

  const system =
    "You are a model-selection advisor. Given a task and candidate models with " +
    "benchmark-style scores and prices, pick the single best model. " +
    "Reply as strict JSON: {\"pick\":\"<model id>\",\"runnerUp\":\"<model id>\",\"rationale\":\"<2 sentences>\"}. " +
    "No markdown, no extra text.";

  const candidates = shortlist.map((s) => ({
    id: s.model.modelId,
    provider: s.model.providerName,
    heuristicScore: Number(s.score.toFixed(1)),
    contextWindow: s.model.contextWindow,
    usdPer1M: { input: s.model.inputCost, output: s.model.outputCost },
    features: s.model.features,
    skills: s.model.skills,
  }));

  const user = [
    `Task: ${task.label}`,
    task.description ? `Description: ${task.description}` : "",
    `Priority weights: ${JSON.stringify(task.weights)}`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await chat(provider, judgeModel.modelId, system, user, 60000, 800);

  const cost = computeCost(
    res.usage.inputTokens,
    res.usage.outputTokens,
    judgeModel.inputCost,
    judgeModel.outputCost,
  );
  recordUsage({
    providerId: provider.id,
    providerSlug: provider.slug,
    providerName: provider.name,
    modelRowId: judgeModel.id,
    modelId: judgeModel.modelId,
    modelLabel: judgeModel.label,
    taskSlug: task.slug,
    taskLabel: task.label,
    source: "recommend",
    systemPrompt: system,
    prompt: user,
    response: res.text,
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
    totalTokens: res.usage.totalTokens,
    cachedTokens: res.usage.cachedTokens,
    reasoningTokens: res.usage.reasoningTokens,
    contextWindow: judgeModel.contextWindow,
    latencyMs: res.latencyMs,
    estimated: res.usage.estimated,
    ok: res.ok,
    error: res.error ?? "",
    ...cost,
  });

  if (!res.ok || !res.text) return null;

  const jsonText = res.text.replace(/^```(?:json)?|```$/gm, "").trim();
  try {
    const parsed = JSON.parse(jsonText) as {
      pick?: string;
      runnerUp?: string;
      rationale?: string;
    };
    if (!parsed.pick) return null;
    return {
      modelUsed: `${judgeModel.providerName} / ${judgeModel.label}`,
      pick: parsed.pick,
      runnerUp: parsed.runnerUp,
      rationale: parsed.rationale ?? "",
    };
  } catch {
    return {
      modelUsed: `${judgeModel.providerName} / ${judgeModel.label}`,
      pick: shortlist[0].model.modelId,
      rationale: res.text.slice(0, 400),
    };
  }
}

import { NextResponse } from "next/server";

import { enforceBudgets } from "@/lib/budget";
import { chat } from "@/lib/client";
import { getDb } from "@/lib/db";
import { getModel, getProvider, getTaskBySlug } from "@/lib/repo";
import { compareSchema, parseBody } from "@/lib/schemas";
import { computeCost, recordUsage, type UsageEvent } from "@/lib/usage";
import { requireAuth } from "@/lib/auth";
import type { Model, Provider } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface CompareBody {
  modelRowIdA: number;
  modelRowIdB: number;
  prompt: string;
  system?: string;
  taskSlug?: string;
  maxTokens?: number;
}

export interface CompareLeg {
  modelRowId: number;
  modelId: string;
  label: string;
  providerName: string;
  ok: boolean;
  text: string;
  error: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
  inputCostUsd: number;
  outputCostUsd: number;
  costUsd: number;
  event: UsageEvent;
}

async function runLeg(
  model: Model,
  provider: Provider,
  system: string,
  prompt: string,
  maxTokens: number,
  taskSlug: string,
  taskLabel: string,
): Promise<CompareLeg> {
  const res = await chat(provider, model.modelId, system, prompt, 110000, maxTokens);
  const cost = computeCost(
    res.usage.inputTokens,
    res.usage.outputTokens,
    model.inputCost,
    model.outputCost,
  );

  const event = recordUsage({
    providerId: provider.id,
    providerSlug: provider.slug,
    providerName: provider.name,
    modelRowId: model.id,
    modelId: model.modelId,
    modelLabel: model.label,
    taskSlug,
    taskLabel,
    source: "compare",
    systemPrompt: system,
    prompt,
    response: res.text,
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
    totalTokens: res.usage.totalTokens,
    cachedTokens: res.usage.cachedTokens,
    reasoningTokens: res.usage.reasoningTokens,
    contextWindow: model.contextWindow,
    latencyMs: res.latencyMs,
    estimated: res.usage.estimated,
    ok: res.ok,
    error: res.error ?? "",
    ...cost,
  });

  return {
    modelRowId: model.id,
    modelId: model.modelId,
    label: model.label,
    providerName: provider.name,
    ok: res.ok,
    text: res.ok ? res.text : "",
    error: res.error ?? "",
    latencyMs: res.latencyMs,
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
    totalTokens: res.usage.totalTokens,
    estimated: res.usage.estimated,
    ...cost,
    event,
  };
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, compareSchema);
  if (!parsed.ok) return parsed.response;
  const body: CompareBody = parsed.data;

  const gate = await enforceBudgets(getDb(), new Date());
  if (!gate.ok && gate.blocked) {
    return NextResponse.json(
      {
        error: "budget exceeded",
        budget: {
          id: gate.blocked.budgetId,
          period: gate.blocked.period,
          limitCents: gate.blocked.limitCents,
          spentCents: gate.blocked.spentCents,
          percentUsed: gate.blocked.percentUsed,
        },
        hint: "raise the limit or wait for the next period",
      },
      { status: 402 },
    );
  }

  const modelA = getModel(body.modelRowIdA);
  if (!modelA) return NextResponse.json({ error: "model A not found" }, { status: 404 });
  const modelB = getModel(body.modelRowIdB);
  if (!modelB) return NextResponse.json({ error: "model B not found" }, { status: 404 });
  const providerA = getProvider(modelA.providerId);
  if (!providerA)
    return NextResponse.json({ error: "provider for model A not found" }, { status: 404 });
  const providerB = getProvider(modelB.providerId);
  if (!providerB)
    return NextResponse.json({ error: "provider for model B not found" }, { status: 404 });

  const task = body.taskSlug ? getTaskBySlug(body.taskSlug) : null;
  const system = body.system ?? "";
  const maxTokens = Math.min(8000, Math.max(64, body.maxTokens ?? 2000));

  const [a, b] = await Promise.all([
    runLeg(modelA, providerA, system, body.prompt, maxTokens, task?.slug ?? "", task?.label ?? ""),
    runLeg(modelB, providerB, system, body.prompt, maxTokens, task?.slug ?? "", task?.label ?? ""),
  ]);

  const headers = new Headers();
  if (gate.warningPercent !== null) {
    headers.set("x-budget-warning", String(Math.round(gate.warningPercent)));
  }
  return NextResponse.json({ a, b }, { headers });
}

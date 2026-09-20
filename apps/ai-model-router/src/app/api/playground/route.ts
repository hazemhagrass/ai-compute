import { NextResponse } from "next/server";

import { chat } from "@/lib/client";
import { getModel, getProvider, getTaskBySlug } from "@/lib/repo";
import { computeCost, recordUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface PlaygroundBody {
  modelRowId: number;
  prompt: string;
  system?: string;
  taskSlug?: string;
  maxTokens?: number;
}

/** Run a real prompt against a chosen model and log prompt/answer/cost. */
export async function POST(request: Request) {
  let body: PlaygroundBody;
  try {
    body = (await request.json()) as PlaygroundBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body?.modelRowId) {
    return NextResponse.json({ error: "modelRowId is required" }, { status: 400 });
  }
  if (!body?.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const model = getModel(body.modelRowId);
  if (!model) return NextResponse.json({ error: "model not found" }, { status: 404 });
  const provider = getProvider(model.providerId);
  if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });

  const task = body.taskSlug ? getTaskBySlug(body.taskSlug) : null;
  const system = body.system ?? "";

  const res = await chat(
    provider,
    model.modelId,
    system,
    body.prompt,
    110000,
    Math.min(8000, Math.max(64, body.maxTokens ?? 2000)),
  );

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
    taskSlug: task?.slug ?? "",
    taskLabel: task?.label ?? "",
    source: "playground",
    systemPrompt: system,
    prompt: body.prompt,
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

  if (!res.ok) {
    return NextResponse.json({ error: res.error, event }, { status: 502 });
  }
  return NextResponse.json({ text: res.text, event });
}

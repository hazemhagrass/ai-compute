import { NextResponse } from "next/server";

import { chatStreamMessages } from "@/lib/client";
import { getModel, getProvider, getTaskBySlug } from "@/lib/repo";
import { parseBody, playgroundSchema } from "@/lib/schemas";
import { computeCost, recordUsage } from "@/lib/usage";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * NDJSON frames sent down the response body while a playground run streams.
 * `token` frames arrive zero or more times; exactly one terminal frame
 * (`done` or `error`) closes the stream after usage has been recorded.
 */
export type PlaygroundStreamFrame =
  | { type: "token"; text: string }
  | { type: "done"; text: string; event: unknown; totals: unknown; streamed: boolean }
  | { type: "error"; error: string; event: unknown; totals: unknown };

/** Run a real prompt against a chosen model, streaming tokens back as NDJSON. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, playgroundSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const model = getModel(body.modelRowId);
  if (!model) return NextResponse.json({ error: "model not found" }, { status: 404 });
  const provider = getProvider(model.providerId);
  if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });

  const task = body.taskSlug ? getTaskBySlug(body.taskSlug) : null;
  const system = body.system ?? "";

  // Prior turns ride along so the model sees the whole conversation; the new
  // prompt is the latest user turn at the end of the list.
  const history: { role: "user" | "assistant"; content: string }[] =
    body.messages ?? [];
  const messages = [...history, { role: "user" as const, content: body.prompt }];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (frame: PlaygroundStreamFrame) => {
        controller.enqueue(encoder.encode(JSON.stringify(frame) + "\n"));
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          // Client disconnected mid-stream; nothing left to do.
        }
      };

      (async () => {
        const res = await chatStreamMessages(
          provider,
          model.modelId,
          system,
          messages,
          110000,
          Math.min(8000, Math.max(64, body.maxTokens ?? 2000)),
          { onToken: (text) => send({ type: "token", text }) },
        );

        const cost = computeCost(
          res.usage.inputTokens,
          res.usage.outputTokens,
          model.inputCost,
          model.outputCost,
        );

        // Usage is recorded after the stream ends, from the final accumulated
        // text and the provider-reported (or estimated) totals, so the event
        // carries full token/cost figures even though the response streamed.
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

        // Running totals across the whole conversation: the client reports what
        // it has already measured for earlier turns and we add this turn on top.
        const prior = body.priorTotals ?? {};
        const totals = {
          turns: (prior.turns ?? 0) + 1,
          inputTokens: (prior.inputTokens ?? 0) + res.usage.inputTokens,
          outputTokens: (prior.outputTokens ?? 0) + res.usage.outputTokens,
          totalTokens: (prior.totalTokens ?? 0) + res.usage.totalTokens,
          costUsd: (prior.costUsd ?? 0) + cost.costUsd,
        };

        if (!res.ok) {
          send({ type: "error", error: res.error ?? "chat failed", event, totals });
        } else {
          send({ type: "done", text: res.text, event, totals, streamed: res.streamed });
        }
        close();
      })().catch((err) => {
        send({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
          event: null,
          totals: null,
        });
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

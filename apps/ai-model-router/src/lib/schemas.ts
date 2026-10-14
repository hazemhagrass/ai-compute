import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSafeProviderUrl } from "./url-guard";

const score = z.coerce.number().min(0).max(100);
const nonNegative = z.coerce.number().min(0);
const positiveInt = z.coerce.number().int().min(0);

const apiKey = z.string();

export const providerKind = z.enum(["cloud", "local", "gateway", "custom"]);
export const authType = z.enum(["bearer", "header", "query", "basic", "none"]);

const baseProviderSchema = z
  .object({
    name: z.string({ error: "name is required" }).trim().min(1, "name is required"),
    baseUrl: z.string({ error: "baseUrl is required" }).trim().min(1, "baseUrl is required"),
    slug: z.string().trim().optional(),
    kind: providerKind.optional(),
  chatPath: z.string().optional(),
  shape: z.enum(["openai", "gemini", "bedrock"]).optional(),
  modelsPath: z.string().optional(),
  authType: authType.optional(),
  authHeaderName: z.string().optional(),
  authQueryName: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  meta: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  apiKey: apiKey.optional(),
});

const providerSsrfGuard = (data: { baseUrl?: string; kind?: string }) => {
  if (!data.baseUrl) return true;
  try {
    assertSafeProviderUrl(data.baseUrl, { allowPrivate: data.kind === "local" });
    return true;
  } catch {
    return false;
  }
};

export const createProviderSchema = baseProviderSchema.refine(providerSsrfGuard, {
  message: 'baseUrl must be a public http(s) address (use kind="local" for Ollama on localhost)',
  path: ["baseUrl"],
});

export const updateProviderSchema = baseProviderSchema.partial().refine(providerSsrfGuard, {
  message: 'baseUrl must be a public http(s) address (use kind="local" for Ollama on localhost)',
  path: ["baseUrl"],
});

export const featuresSchema = z
  .object({
    tools: z.boolean(),
    vision: z.boolean(),
    json: z.boolean(),
    streaming: z.boolean(),
    reasoning: z.boolean(),
    audio: z.boolean(),
    embedding: z.boolean(),
  })
  .partial();

export const createModelSchema = z.object({
  providerId: z.coerce.number().int().positive("providerId is required"),
  modelId: z
    .string({ error: "modelId is required" })
    .trim()
    .min(1, "modelId is required"),
  label: z.string().optional(),
  quality: score.optional(),
  speed: score.optional(),
  cheapness: score.optional(),
  contextWindow: positiveInt.optional(),
  maxOutput: positiveInt.optional(),
  inputCost: nonNegative.optional(),
  outputCost: nonNegative.optional(),
  skills: z.record(z.string(), score).optional(),
  features: featuresSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const updateModelSchema = createModelSchema.partial();

export const requiresSchema = z
  .object({
    tools: z.boolean(),
    vision: z.boolean(),
    json: z.boolean(),
    reasoning: z.boolean(),
    audio: z.boolean(),
    embedding: z.boolean(),
    minContext: positiveInt,
  })
  .partial();

export const createTaskSchema = z.object({
  label: z.string({ error: "label is required" }).trim().min(1, "label is required"),
  slug: z.string().trim().optional(),
  description: z.string().optional(),
  weights: z.record(z.string(), z.coerce.number().min(0).max(10)).optional(),
  requires: requiresSchema.optional(),
  pinnedModelId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const playgroundMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string({ error: "message content is required" })
    .min(1, "message content is required"),
});

export const playgroundTotalsSchema = z
  .object({
    inputTokens: nonNegative.optional(),
    outputTokens: nonNegative.optional(),
    totalTokens: nonNegative.optional(),
    costUsd: nonNegative.optional(),
    turns: z.coerce.number().int().min(0).optional(),
  })
  .optional();

export const playgroundSchema = z.object({
  modelRowId: z.coerce.number().int().positive("modelRowId is required"),
  prompt: z
    .string({ error: "prompt is required" })
    .trim()
    .min(1, "prompt is required"),
  messages: z.array(playgroundMessageSchema).max(200).optional(),
  priorTotals: playgroundTotalsSchema,
  system: z.string().optional(),
  taskSlug: z.string().optional(),
  maxTokens: z.coerce.number().int().min(64).max(8000).optional(),
});

export const compareSchema = z
  .object({
    modelRowIdA: z.coerce.number().int().positive("modelRowIdA is required"),
    modelRowIdB: z.coerce.number().int().positive("modelRowIdB is required"),
    prompt: z
      .string({ error: "prompt is required" })
      .trim()
      .min(1, "prompt is required"),
    system: z.string().optional(),
    taskSlug: z.string().optional(),
    maxTokens: z.coerce.number().int().min(64).max(8000).optional(),
  })
  .refine((b) => b.modelRowIdA !== b.modelRowIdB, {
    message: "choose two different models to compare",
    path: ["modelRowIdB"],
  });

export const recommendSchema = z
  .object({
    taskId: z.coerce.number().int().positive().optional(),
    taskSlug: z.string().optional(),
    text: z.string().optional(),
    overrideWeights: z.record(z.string(), z.coerce.number().min(0).max(10)).optional(),
    providerIds: z.array(z.coerce.number().int().positive()).optional(),
    localOnly: z.boolean().optional(),
    ignorePin: z.boolean().optional(),
    maxOutputCost: nonNegative.optional(),
    minContext: positiveInt.optional(),
    limit: z.coerce.number().int().min(1).max(25).optional(),
    useAi: z.boolean().optional(),
    judgeModelId: z.coerce.number().int().positive().optional(),
  })
  .refine((b) => b.taskId || b.taskSlug || b.text?.trim(), {
    message: "provide taskId, taskSlug, or text",
  });

export const pricingSchema = z.object({
  apply: z.boolean().optional(),
  recalcCheapness: z.boolean().optional(),
});

export interface ParseFailure {
  ok: false;
  response: NextResponse;
}

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseSuccess<T> | ParseFailure> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "_"] = issue.message;
    }

    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    const error = first
      ? path
        ? `${path}: ${first.message}`
        : first.message
      : "invalid request body";

    return {
      ok: false,
      response: NextResponse.json(
        { error, fields },
        { status: 422 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

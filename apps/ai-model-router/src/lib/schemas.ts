import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request body schemas.
 *
 * Every route previously did `await request.json() as SomeType`, which is a
 * lie the compiler believes: a malformed body reached the SQLite layer and
 * failed there, producing a 500 and a stack trace instead of a 400 and a
 * usable message.
 */

/* ------------------------------------------------------------- primitives */

const score = z.coerce.number().min(0).max(100);
const nonNegative = z.coerce.number().min(0);
const positiveInt = z.coerce.number().int().min(0);

/**
 * Tri-state secret field.
 *
 * absent       -> keep the stored key
 * empty string -> clear it
 * a value      -> replace it
 *
 * A plain `z.string().optional()` collapses the first two cases, which
 * silently wipes stored keys on any update that does not resend them. The
 * distinction is preserved by never defaulting this field.
 */
const apiKey = z.string();

/* -------------------------------------------------------------- providers */

export const providerKind = z.enum(["cloud", "local", "gateway", "custom"]);
export const authType = z.enum(["bearer", "header", "query", "basic", "none"]);

export const createProviderSchema = z.object({
  name: z.string({ error: "name is required" }).trim().min(1, "name is required"),
  baseUrl: z
    .string({ error: "baseUrl is required" })
    .trim()
    .min(1, "baseUrl is required"),
  slug: z.string().trim().optional(),
  kind: providerKind.optional(),
  chatPath: z.string().optional(),
  modelsPath: z.string().optional(),
  authType: authType.optional(),
  authHeaderName: z.string().optional(),
  authQueryName: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  meta: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  apiKey: apiKey.optional(),
});

export const updateProviderSchema = createProviderSchema.partial();

/* ----------------------------------------------------------------- models */

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

/* ------------------------------------------------------------------ tasks */

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
  // 0-10: the scoring engine treats weight as relative importance, not a score.
  weights: z.record(z.string(), z.coerce.number().min(0).max(10)).optional(),
  requires: requiresSchema.optional(),
  pinnedModelId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

/* -------------------------------------------------------------- endpoints */

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

export const playgroundSchema = z.object({
  modelRowId: z.coerce.number().int().positive("modelRowId is required"),
  prompt: z
    .string({ error: "prompt is required" })
    .trim()
    .min(1, "prompt is required"),
  system: z.string().optional(),
  taskSlug: z.string().optional(),
  maxTokens: z.coerce.number().int().min(64).max(8000).optional(),
});

export const pricingSchema = z.object({
  apply: z.boolean().optional(),
  recalcCheapness: z.boolean().optional(),
});

/* ------------------------------------------------------------------ parse */

export interface ParseFailure {
  ok: false;
  response: NextResponse;
}

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Parse a JSON request body, returning a ready 400 response on failure.
 *
 * Field-level errors are returned so a client can point at the offending
 * input rather than showing a generic failure.
 */
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

    // Zod's default message for a missing field is "expected string, received
    // undefined", which does not say WHICH field. Prefix the path so the
    // surfaced error is actionable without opening the schema.
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
        // 422: the JSON parsed fine, the values are wrong. Distinguishing this
        // from 400 lets a client tell "malformed" from "invalid".
        { status: 422 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

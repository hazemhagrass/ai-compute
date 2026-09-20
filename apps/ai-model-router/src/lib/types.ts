/** Shared domain types for the AI Model Router. */

export type ProviderKind = "cloud" | "local" | "gateway" | "custom";

export type AuthType = "bearer" | "header" | "query" | "basic" | "none";

export interface Provider {
  id: number;
  slug: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Path appended to baseUrl for chat completions, e.g. /chat/completions */
  chatPath: string;
  /** Path used to list models, e.g. /models  (blank = no discovery) */
  modelsPath: string;
  authType: AuthType;
  /** Header name when authType = header|bearer (default Authorization) */
  authHeaderName: string;
  /** Query param name when authType = query */
  authQueryName: string;
  /** Extra static headers, JSON object */
  headers: Record<string, string>;
  /** Free-form notes / org id / project id etc. */
  meta: Record<string, string>;
  enabled: boolean;
  hasKey: boolean;
  keyPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInput {
  slug?: string;
  name: string;
  kind?: ProviderKind;
  baseUrl: string;
  chatPath?: string;
  modelsPath?: string;
  authType?: AuthType;
  authHeaderName?: string;
  authQueryName?: string;
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  enabled?: boolean;
  /** Plain secret; encrypted at rest. Omit to keep existing, "" to clear. */
  apiKey?: string;
}

export interface Model {
  id: number;
  providerId: number;
  providerSlug: string;
  providerName: string;
  modelId: string;
  label: string;
  /** 0-100 subjective/benchmark quality */
  quality: number;
  /** 0-100, higher = faster tokens/sec + lower latency */
  speed: number;
  /** 0-100, higher = cheaper */
  cheapness: number;
  contextWindow: number;
  maxOutput: number;
  inputCost: number; // USD per 1M tokens
  outputCost: number; // USD per 1M tokens
  /** Per-capability scores 0-100 */
  skills: Record<string, number>;
  /** Boolean feature flags */
  features: {
    tools: boolean;
    vision: boolean;
    json: boolean;
    streaming: boolean;
    reasoning: boolean;
    audio: boolean;
    embedding: boolean;
  };
  tags: string[];
  notes: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInput {
  providerId: number;
  modelId: string;
  label?: string;
  quality?: number;
  speed?: number;
  cheapness?: number;
  contextWindow?: number;
  maxOutput?: number;
  inputCost?: number;
  outputCost?: number;
  skills?: Record<string, number>;
  features?: Partial<Model["features"]>;
  tags?: string[];
  notes?: string;
  enabled?: boolean;
}

/** A use case such as "planning" or "code review". */
export interface Task {
  id: number;
  slug: string;
  label: string;
  description: string;
  /** Weight per skill/axis, e.g. { reasoning: 5, coding: 2, cheapness: 1 } */
  weights: Record<string, number>;
  /** Hard requirements a model must satisfy to be eligible. */
  requires: {
    tools?: boolean;
    vision?: boolean;
    json?: boolean;
    reasoning?: boolean;
    audio?: boolean;
    embedding?: boolean;
    minContext?: number;
  };
  /** Manual override — when set, this model always wins for this task. */
  pinnedModelId: number | null;
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  slug?: string;
  label: string;
  description?: string;
  weights?: Record<string, number>;
  requires?: Task["requires"];
  pinnedModelId?: number | null;
}

export interface Scored {
  model: Model;
  score: number;
  /** Per-axis contribution for the explanation UI. */
  breakdown: { axis: string; weight: number; value: number; points: number }[];
  reasons: string[];
  pinned?: boolean;
}

export interface Recommendation {
  task: Task;
  ranked: Scored[];
  generatedAt: string;
  /** Present when the LLM-assisted picker was used. */
  ai?: {
    modelUsed: string;
    pick: string;
    rationale: string;
    runnerUp?: string;
  };
}

/** Canonical skill axes. Users may add their own — these are just the seeds. */
export const SKILL_AXES = [
  "reasoning",
  "planning",
  "coding",
  "codeReview",
  "debugging",
  "longContext",
  "instruction",
  "creative",
  "math",
  "multilingual",
  "agentic",
  "extraction",
  "summarization",
  "vision",
  "speed",
  "cheapness",
  "quality",
] as const;

export type SkillAxis = (typeof SKILL_AXES)[number];

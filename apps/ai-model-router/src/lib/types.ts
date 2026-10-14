import type { ExclusionReport } from "./exclusions";

export type ProviderKind = "cloud" | "local" | "gateway" | "custom";

export type AuthType = "bearer" | "header" | "query" | "basic" | "none";

export type ProviderShape = "openai" | "gemini" | "bedrock";

export interface Provider {
  id: number;
  slug: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  chatPath: string;
  shape?: ProviderShape;
  modelsPath: string;
  authType: AuthType;
  authHeaderName: string;
  authQueryName: string;
  headers: Record<string, string>;
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
  shape?: ProviderShape;
  modelsPath?: string;
  authType?: AuthType;
  authHeaderName?: string;
  authQueryName?: string;
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  enabled?: boolean;
  apiKey?: string;
}

export interface Model {
  id: number;
  providerId: number;
  providerSlug: string;
  providerName: string;
  modelId: string;
  label: string;
  quality: number;
  speed: number;
  cheapness: number;
  contextWindow: number;
  maxOutput: number;
  inputCost: number;
  outputCost: number;
  skills: Record<string, number>;
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

export interface Task {
  id: number;
  slug: string;
  label: string;
  description: string;
  weights: Record<string, number>;
  requires: {
    tools?: boolean;
    vision?: boolean;
    json?: boolean;
    reasoning?: boolean;
    audio?: boolean;
    embedding?: boolean;
    minContext?: number;
  };
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
  breakdown: { axis: string; weight: number; value: number; points: number }[];
  reasons: string[];
  pinned?: boolean;
}

export interface Recommendation {
  task: Task;
  ranked: Scored[];
  exclusions?: ExclusionReport;
  generatedAt: string;
  ai?: {
    modelUsed: string;
    pick: string;
    rationale: string;
    runnerUp?: string;
  };
}

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

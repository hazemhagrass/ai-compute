import type { AuthType, ProviderKind } from "./types";

interface SeedModel {
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
  features?: Record<string, boolean>;
  tags?: string[];
  notes?: string;
}

interface SeedProvider {
  slug: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  authType: AuthType;
  authHeaderName?: string;
  authQueryName?: string;
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  models?: SeedModel[];
}

const F = (o: Partial<Record<string, boolean>> = {}) => ({
  tools: true,
  vision: false,
  json: true,
  streaming: true,
  reasoning: false,
  audio: false,
  embedding: false,
  ...o,
});

/**
 * Seed catalogue. Everything here is editable in the UI — these are starting
 * points, not a fixed list. Scores are 0-100 subjective priors.
 */
export const seedProviders: SeedProvider[] = [
  {
    slug: "openai",
    name: "OpenAI",
    kind: "cloud",
    baseUrl: "https://api.openai.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    meta: { docs: "https://platform.openai.com/docs", orgHeader: "OpenAI-Organization" },
    models: [
      {
        modelId: "gpt-5.2",
        label: "GPT-5.2",
        quality: 96, speed: 62, cheapness: 40,
        contextWindow: 400000, maxOutput: 128000, inputCost: 1.25, outputCost: 10,
        skills: { reasoning: 95, planning: 94, coding: 93, codeReview: 92, debugging: 90, longContext: 90, instruction: 94, creative: 88, math: 93, multilingual: 90, agentic: 94, extraction: 92, summarization: 90, vision: 88 },
        features: F({ vision: true, reasoning: true }),
        tags: ["frontier", "agentic"],
      },
      {
        modelId: "gpt-5.2-mini",
        label: "GPT-5.2 Mini",
        quality: 84, speed: 86, cheapness: 82,
        contextWindow: 400000, maxOutput: 128000, inputCost: 0.25, outputCost: 2,
        skills: { reasoning: 80, planning: 79, coding: 82, codeReview: 78, debugging: 76, longContext: 84, instruction: 86, creative: 76, math: 80, multilingual: 82, agentic: 80, extraction: 88, summarization: 86, vision: 78 },
        features: F({ vision: true, reasoning: true }),
        tags: ["balanced", "cheap"],
      },
      {
        modelId: "o4-mini",
        label: "o4-mini (reasoning)",
        quality: 88, speed: 58, cheapness: 74,
        contextWindow: 200000, maxOutput: 100000, inputCost: 1.1, outputCost: 4.4,
        skills: { reasoning: 92, planning: 90, coding: 86, codeReview: 84, debugging: 88, longContext: 78, instruction: 82, creative: 66, math: 94, multilingual: 76, agentic: 82, extraction: 78, summarization: 76 },
        features: F({ reasoning: true }),
        tags: ["reasoning"],
      },
      {
        modelId: "text-embedding-3-large",
        label: "Embedding 3 Large",
        quality: 82, speed: 92, cheapness: 94,
        contextWindow: 8191, inputCost: 0.13, outputCost: 0,
        skills: { extraction: 88 },
        features: F({ tools: false, json: false, streaming: false, embedding: true }),
        tags: ["embedding"],
      },
    ],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    kind: "cloud",
    baseUrl: "https://api.anthropic.com/v1",
    chatPath: "/messages",
    modelsPath: "/models",
    authType: "header",
    authHeaderName: "x-api-key",
    headers: { "anthropic-version": "2023-06-01" },
    meta: { docs: "https://docs.anthropic.com" },
    models: [
      {
        modelId: "claude-opus-4-6",
        label: "Claude Opus 4.6",
        quality: 97, speed: 55, cheapness: 28,
        contextWindow: 1000000, maxOutput: 64000, inputCost: 5, outputCost: 25,
        skills: { reasoning: 96, planning: 97, coding: 97, codeReview: 97, debugging: 95, longContext: 95, instruction: 95, creative: 93, math: 90, multilingual: 88, agentic: 96, extraction: 92, summarization: 93, vision: 90 },
        features: F({ vision: true, reasoning: true }),
        tags: ["frontier", "coding", "planning"],
      },
      {
        modelId: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        quality: 92, speed: 78, cheapness: 62,
        contextWindow: 1000000, maxOutput: 64000, inputCost: 3, outputCost: 15,
        skills: { reasoning: 90, planning: 91, coding: 93, codeReview: 92, debugging: 90, longContext: 92, instruction: 93, creative: 86, math: 84, multilingual: 86, agentic: 92, extraction: 90, summarization: 90, vision: 87 },
        features: F({ vision: true, reasoning: true }),
        tags: ["workhorse", "coding"],
      },
      {
        modelId: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        quality: 78, speed: 94, cheapness: 88,
        contextWindow: 200000, maxOutput: 32000, inputCost: 1, outputCost: 5,
        skills: { reasoning: 72, planning: 70, coding: 78, codeReview: 72, debugging: 70, longContext: 76, instruction: 86, creative: 70, math: 68, multilingual: 78, agentic: 74, extraction: 86, summarization: 86, vision: 74 },
        features: F({ vision: true }),
        tags: ["fast", "cheap"],
      },
    ],
  },
  {
    slug: "google",
    name: "Google AI Studio (Gemini)",
    kind: "cloud",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    chatPath: "/openai/chat/completions",
    modelsPath: "/models",
    authType: "query",
    authQueryName: "key",
    meta: { docs: "https://ai.google.dev" },
    models: [
      {
        modelId: "gemini-3-pro",
        label: "Gemini 3 Pro",
        quality: 94, speed: 70, cheapness: 58,
        contextWindow: 2000000, maxOutput: 64000, inputCost: 1.25, outputCost: 10,
        skills: { reasoning: 93, planning: 91, coding: 90, codeReview: 88, debugging: 86, longContext: 98, instruction: 90, creative: 88, math: 92, multilingual: 94, agentic: 88, extraction: 92, summarization: 94, vision: 94 },
        features: F({ vision: true, reasoning: true, audio: true }),
        tags: ["long-context", "multimodal"],
      },
      {
        modelId: "gemini-3-flash",
        label: "Gemini 3 Flash",
        quality: 82, speed: 95, cheapness: 92,
        contextWindow: 1000000, maxOutput: 64000, inputCost: 0.3, outputCost: 2.5,
        skills: { reasoning: 78, planning: 76, coding: 80, codeReview: 74, debugging: 72, longContext: 94, instruction: 86, creative: 76, math: 80, multilingual: 90, agentic: 78, extraction: 90, summarization: 92, vision: 88 },
        features: F({ vision: true, audio: true }),
        tags: ["fast", "cheap", "long-context"],
      },
    ],
  },
  {
    slug: "ollama",
    name: "Ollama (local)",
    kind: "local",
    baseUrl: "http://localhost:11434/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "none",
    meta: { hint: "Point this at any host/IP/domain running Ollama, e.g. http://192.168.1.50:11434/v1 or https://ollama.mydomain.com/v1" },
    models: [
      {
        modelId: "qwen3-coder:30b",
        label: "Qwen3 Coder 30B (local)",
        quality: 76, speed: 62, cheapness: 100,
        contextWindow: 262144, maxOutput: 32000, inputCost: 0, outputCost: 0,
        skills: { reasoning: 72, planning: 70, coding: 84, codeReview: 78, debugging: 76, longContext: 78, instruction: 76, creative: 64, math: 70, multilingual: 70, agentic: 74, extraction: 76, summarization: 74 },
        features: F(),
        tags: ["local", "free", "coding"],
      },
      {
        modelId: "llama3.3:70b",
        label: "Llama 3.3 70B (local)",
        quality: 74, speed: 45, cheapness: 100,
        contextWindow: 131072, maxOutput: 16000, inputCost: 0, outputCost: 0,
        skills: { reasoning: 74, planning: 72, coding: 70, codeReview: 68, debugging: 66, longContext: 72, instruction: 78, creative: 74, math: 68, multilingual: 78, agentic: 68, extraction: 74, summarization: 78 },
        features: F(),
        tags: ["local", "free"],
      },
    ],
  },
  {
    slug: "lmstudio",
    name: "LM Studio (local)",
    kind: "local",
    baseUrl: "http://localhost:1234/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "none",
    meta: { hint: "LM Studio local server — OpenAI compatible" },
  },
  {
    slug: "vllm",
    name: "vLLM / OpenAI-compatible self-host",
    kind: "local",
    baseUrl: "http://localhost:8000/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    meta: { hint: "Any OpenAI-compatible server: vLLM, TGI, llama.cpp, SGLang" },
  },
  {
    slug: "openrouter",
    name: "OpenRouter",
    kind: "gateway",
    baseUrl: "https://openrouter.ai/api/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    meta: { docs: "https://openrouter.ai/docs" },
  },
  {
    slug: "fireworks",
    name: "Fireworks AI",
    kind: "cloud",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    meta: { docs: "https://docs.fireworks.ai" },
  },
  {
    slug: "together",
    name: "Together AI",
    kind: "cloud",
    baseUrl: "https://api.together.xyz/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "groq",
    name: "Groq",
    kind: "cloud",
    baseUrl: "https://api.groq.com/openai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
    meta: { note: "Extremely fast inference (LPU)" },
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    kind: "cloud",
    baseUrl: "https://api.deepseek.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "mistral",
    name: "Mistral AI",
    kind: "cloud",
    baseUrl: "https://api.mistral.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "xai",
    name: "xAI (Grok)",
    kind: "cloud",
    baseUrl: "https://api.x.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "cohere",
    name: "Cohere",
    kind: "cloud",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "perplexity",
    name: "Perplexity",
    kind: "cloud",
    baseUrl: "https://api.perplexity.ai",
    chatPath: "/chat/completions",
    modelsPath: "",
    authType: "bearer",
  },
  {
    slug: "cerebras",
    name: "Cerebras",
    kind: "cloud",
    baseUrl: "https://api.cerebras.ai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "bearer",
  },
  {
    slug: "azure-openai",
    name: "Azure OpenAI",
    kind: "cloud",
    baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    authType: "header",
    authHeaderName: "api-key",
    meta: { hint: "Replace YOUR-RESOURCE with your Azure resource name" },
  },
];

interface SeedTask {
  slug: string;
  label: string;
  description: string;
  weights: Record<string, number>;
  requires?: Record<string, unknown>;
}

export const seedTasks: SeedTask[] = [
  {
    slug: "planning",
    label: "Planning & architecture",
    description: "Break down a feature, design a system, produce an engineering plan.",
    weights: { planning: 5, reasoning: 4, longContext: 2, instruction: 2, quality: 2, agentic: 1 },
    requires: { minContext: 32000 },
  },
  {
    slug: "code-writing",
    label: "Writing code",
    description: "Implement features, write functions, scaffold projects.",
    weights: { coding: 5, instruction: 3, reasoning: 2, agentic: 2, quality: 2 },
    requires: { tools: true },
  },
  {
    slug: "code-review",
    label: "Code review",
    description: "Review a diff for bugs, security issues, and style.",
    weights: { codeReview: 5, reasoning: 3, coding: 3, longContext: 2, quality: 2 },
  },
  {
    slug: "debugging",
    label: "Debugging",
    description: "Root-cause an error from logs, stack traces, and source.",
    weights: { debugging: 5, reasoning: 4, coding: 3, longContext: 1 },
  },
  {
    slug: "agentic",
    label: "Agentic / tool use",
    description: "Long autonomous loops calling tools and APIs.",
    weights: { agentic: 5, instruction: 3, reasoning: 3, coding: 2, longContext: 2 },
    requires: { tools: true },
  },
  {
    slug: "long-context",
    label: "Long document analysis",
    description: "Read a huge codebase, contract, or corpus in one shot.",
    weights: { longContext: 5, summarization: 3, extraction: 2, quality: 2 },
    requires: { minContext: 200000 },
  },
  {
    slug: "summarization",
    label: "Summarization",
    description: "Condense meetings, papers, and threads.",
    weights: { summarization: 5, instruction: 3, cheapness: 2, speed: 2 },
  },
  {
    slug: "extraction",
    label: "Structured extraction",
    description: "Pull JSON/fields out of messy text reliably.",
    weights: { extraction: 5, instruction: 4, cheapness: 2, speed: 2 },
    requires: { json: true },
  },
  {
    slug: "creative",
    label: "Creative writing",
    description: "Copy, narrative, marketing, and voice.",
    weights: { creative: 5, instruction: 2, quality: 3, multilingual: 1 },
  },
  {
    slug: "math",
    label: "Math & analysis",
    description: "Proofs, quantitative reasoning, data analysis.",
    weights: { math: 5, reasoning: 4, quality: 2 },
  },
  {
    slug: "vision",
    label: "Vision / screenshots",
    description: "Read images, screenshots, diagrams, and PDFs.",
    weights: { vision: 5, reasoning: 2, instruction: 2 },
    requires: { vision: true },
  },
  {
    slug: "cheap-bulk",
    label: "Cheap bulk work",
    description: "High-volume classification and tagging where cost dominates.",
    weights: { cheapness: 5, speed: 4, instruction: 2, extraction: 2 },
  },
  {
    slug: "fast-chat",
    label: "Fast interactive chat",
    description: "Low-latency conversation, autocomplete, inline help.",
    weights: { speed: 5, instruction: 3, cheapness: 2, quality: 1 },
  },
  {
    slug: "multilingual",
    label: "Translation & multilingual",
    description: "Work across languages with nuance.",
    weights: { multilingual: 5, instruction: 3, quality: 2, creative: 1 },
  },
  {
    slug: "embedding",
    label: "Embeddings / retrieval",
    description: "Vectorize text for semantic search and RAG.",
    weights: { extraction: 3, cheapness: 4, speed: 3 },
    requires: { embedding: true },
  },
  {
    slug: "offline-private",
    label: "Offline / private (local only)",
    description: "Work that must never leave your machine or network.",
    weights: { cheapness: 5, quality: 3, coding: 2, reasoning: 2 },
  },
];

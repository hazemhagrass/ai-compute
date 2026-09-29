/**
 * Static catalog of Hermes's built-in provider profiles (issue: per-profile
 * router dashboard). Generated once from
 * plugins/model-providers/<name>/__init__.py — those files
 * are the ground truth for base URL / auth type / env var name per provider,
 * but they are Python plugin source, not something this app should parse at
 * runtime. Re-generate by hand if Hermes ships a new bundled provider.
 *
 * "custom" is not a catalog entry with a fixed base URL: any provider not in
 * this table (or explicitly "custom") gets a free-form base URL + API key,
 * matching how Hermes's own model.provider: custom works.
 */
export type ProviderAuthType =
  | "api_key"
  | "bearer"
  | "oauth_device_code"
  | "oauth_external"
  | "copilot"
  | "aws_sdk"
  | "vertex"
  | "external_process"
  | "none";

export interface ProviderCatalogEntry {
  id: string;
  label: string;
  baseUrl: string;
  authType: ProviderAuthType;
  /** First entry is the canonical env var Hermes reads; others are accepted aliases. */
  envVars: string[];
  /** True when Hermes authenticates this provider via `hermes auth add <id>` rather than a key. */
  oauthOnly?: boolean;
}

function label(id: string): string {
  return id
    .split("-")
    .map((w) => (w.length <= 3 && w === w.toLowerCase() ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

const RAW: Record<string, { baseUrl: string; authType: ProviderAuthType; envVars: string[] }> = {
  "anthropic": { baseUrl: "https://api.anthropic.com", authType: "api_key", envVars: ["ANTHROPIC_API_KEY", "ANTHROPIC_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"] },
  "openrouter": { baseUrl: "https://openrouter.ai/api/v1", authType: "bearer", envVars: ["OPENROUTER_API_KEY"] },
  "nous": { baseUrl: "https://inference-api.nousresearch.com/v1", authType: "oauth_device_code", envVars: ["NOUS_API_KEY"] },
  "openai-codex": { baseUrl: "https://chatgpt.com/backend-api/codex", authType: "oauth_external", envVars: [] },
  "qwen-oauth": { baseUrl: "https://portal.qwen.ai/v1", authType: "oauth_external", envVars: ["QWEN_API_KEY"] },
  "minimax-oauth": { baseUrl: "https://api.minimax.io/anthropic", authType: "oauth_external", envVars: ["MINIMAX_API_KEY"] },
  "copilot": { baseUrl: "https://api.githubcopilot.com", authType: "copilot", envVars: ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] },
  "copilot-acp": { baseUrl: "acp://copilot", authType: "external_process", envVars: [] },
  "gemini": { baseUrl: "https://generativelanguage.googleapis.com/v1beta", authType: "api_key", envVars: ["GOOGLE_API_KEY", "GEMINI_API_KEY"] },
  "xai": { baseUrl: "https://api.x.ai/v1", authType: "api_key", envVars: ["XAI_API_KEY"] },
  "deepseek": { baseUrl: "https://api.deepseek.com/v1", authType: "bearer", envVars: ["DEEPSEEK_API_KEY"] },
  "zai": { baseUrl: "https://api.z.ai/api/paas/v4", authType: "bearer", envVars: ["GLM_API_KEY", "ZAI_API_KEY", "Z_AI_API_KEY"] },
  "minimax": { baseUrl: "https://api.minimax.io/anthropic", authType: "api_key", envVars: ["MINIMAX_API_KEY"] },
  "minimax-cn": { baseUrl: "https://api.minimaxi.com/anthropic", authType: "api_key", envVars: ["MINIMAX_CN_API_KEY"] },
  "kimi-coding": { baseUrl: "https://api.moonshot.ai/anthropic", authType: "api_key", envVars: ["KIMI_API_KEY"] },
  "kimi-coding-cn": { baseUrl: "https://api.moonshot.cn/anthropic", authType: "api_key", envVars: ["KIMI_CN_API_KEY"] },
  "alibaba": { baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", authType: "api_key", envVars: ["DASHSCOPE_API_KEY"] },
  "alibaba-coding-plan": { baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1", authType: "api_key", envVars: ["ALIBABA_CODING_PLAN_API_KEY", "DASHSCOPE_API_KEY"] },
  "xiaomi": { baseUrl: "https://api.xiaomimimo.com/v1", authType: "bearer", envVars: ["XIAOMI_API_KEY"] },
  "huggingface": { baseUrl: "https://router.huggingface.co/v1", authType: "bearer", envVars: ["HF_TOKEN"] },
  "fireworks": { baseUrl: "https://api.fireworks.ai/inference/v1", authType: "api_key", envVars: ["FIREWORKS_API_KEY"] },
  "novita": { baseUrl: "https://api.novita.ai/openai/v1", authType: "api_key", envVars: ["NOVITA_API_KEY", "NOVITA_BASE_URL"] },
  "nvidia": { baseUrl: "https://integrate.api.nvidia.com/v1", authType: "bearer", envVars: ["NVIDIA_API_KEY"] },
  "deepinfra": { baseUrl: "https://api.deepinfra.com/v1/openai", authType: "api_key", envVars: ["DEEPINFRA_API_KEY"] },
  "gmi": { baseUrl: "https://api.gmi-serving.com/v1", authType: "api_key", envVars: ["GMI_API_KEY"] },
  "arcee": { baseUrl: "https://api.arcee.ai/api/v1", authType: "bearer", envVars: ["ARCEEAI_API_KEY"] },
  "stepfun": { baseUrl: "https://api.stepfun.ai/step_plan/v1", authType: "bearer", envVars: ["STEPFUN_API_KEY"] },
  "upstage": { baseUrl: "https://api.upstage.ai/v1", authType: "api_key", envVars: ["UPSTAGE_API_KEY"] },
  "kilocode": { baseUrl: "https://api.kilo.ai/api/gateway", authType: "bearer", envVars: ["KILOCODE_API_KEY"] },
  "ai-gateway": { baseUrl: "https://ai-gateway.vercel.sh/v1", authType: "bearer", envVars: ["AI_GATEWAY_API_KEY"] },
  "opencode-zen": { baseUrl: "https://opencode.ai/zen/v1", authType: "bearer", envVars: ["OPENCODE_ZEN_API_KEY"] },
  "opencode-go": { baseUrl: "https://opencode.ai/go/v1", authType: "bearer", envVars: ["OPENCODE_GO_API_KEY"] },
  "ollama-cloud": { baseUrl: "https://ollama.com/v1", authType: "bearer", envVars: ["OLLAMA_API_KEY"] },
  "bedrock": { baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com", authType: "aws_sdk", envVars: [] },
  "vertex": { baseUrl: "https://aiplatform.googleapis.com", authType: "vertex", envVars: [] },
  "azure-foundry": { baseUrl: "", authType: "api_key", envVars: ["AZURE_FOUNDRY_API_KEY", "AZURE_FOUNDRY_BASE_URL"] },
  "custom": { baseUrl: "", authType: "bearer", envVars: [] },
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = Object.entries(RAW)
  .map(([id, v]) => ({ id, label: label(id), ...v }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const PROVIDER_CATALOG_BY_ID: Record<string, ProviderCatalogEntry> = Object.fromEntries(
  PROVIDER_CATALOG.map((p) => [p.id, p]),
);

/** Local network / self-hosted providers (Ollama, LM Studio, vLLM, …) are always
 * added as `custom` with a base URL the user types in — there is no catalog
 * entry because the host is unique to the user's machine. */
export function catalogEntryFor(id: string): ProviderCatalogEntry {
  return (
    PROVIDER_CATALOG_BY_ID[id] ?? {
      id,
      label: label(id),
      baseUrl: "",
      authType: "bearer",
      envVars: [],
    }
  );
}

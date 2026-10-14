export interface ShapeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ShapeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

export interface ProviderShapeAdapter {
  url(modelId: string): string;
  headers(): Record<string, string>;
  body(system: string, messages: ShapeMessage[], maxTokens: number): string;
  extractText(json: unknown): string;
  readUsage(json: unknown): ShapeUsage | null;
}

// Shared contract for native provider request shapes (Gemini, Bedrock, ...).
// Anything the OpenAI-compatible path cannot express natively goes through an
// adapter implementing this interface.

/** One conversation turn; mirrors the OpenAI messages array the app already uses. */
export interface ShapeMessage {
  role: "user" | "assistant";
  content: string;
}

/** Usage fields an adapter can report; merged into ChatUsage by the caller. */
export interface ShapeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

export interface ProviderShapeAdapter {
  /** Builds the full request URL (may include auth query params). */
  url(modelId: string): string;
  /** Headers for the request. Auth headers are added here. */
  headers(): Record<string, string>;
  /** Serializes system prompt + conversation into the provider's native body. */
  body(system: string, messages: ShapeMessage[], maxTokens: number): string;
  /** Pulls the assistant text out of the raw JSON response. */
  extractText(json: unknown): string;
  /** Normalizes the raw JSON response into the shared usage shape. */
  readUsage(json: unknown): ShapeUsage | null;
}

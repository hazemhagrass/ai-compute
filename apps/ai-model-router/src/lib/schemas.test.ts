import { describe, expect, it } from "vitest";

import {
  createModelSchema,
  createProviderSchema,
  createTaskSchema,
  playgroundSchema,
  recommendSchema,
  updateProviderSchema,
} from "./schemas";

describe("provider schemas", () => {
  it("rejects a missing name with a usable message", () => {
    const r = createProviderSchema.safeParse({ baseUrl: "https://x/v1" });

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/name/i);
  });

  it("rejects a missing baseUrl", () => {
    const r = createProviderSchema.safeParse({ name: "X" });

    expect(r.success).toBe(false);
  });

  it("rejects an unknown auth type instead of storing it", () => {
    // A bad auth type would otherwise reach buildRequest and silently send an
    // unauthenticated request.
    const r = createProviderSchema.safeParse({
      name: "X",
      baseUrl: "https://x/v1",
      authType: "magic",
    });

    expect(r.success).toBe(false);
  });

  it("accepts a whitespace-padded name and trims it", () => {
    const r = createProviderSchema.safeParse({
      name: "  Fireworks  ",
      baseUrl: " https://x/v1 ",
    });

    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Fireworks");
  });
});

describe("apiKey tri-state", () => {
  // The rule that silently destroys data if broken:
  //   absent -> keep stored key, "" -> clear it, value -> replace it.
  it("leaves apiKey absent when it was not sent", () => {
    const r = updateProviderSchema.parse({ name: "Renamed" });

    expect("apiKey" in r).toBe(false);
    expect(r.apiKey).toBeUndefined();
  });

  it("preserves an empty string as an explicit clear", () => {
    const r = updateProviderSchema.parse({ apiKey: "" });

    expect("apiKey" in r).toBe(true);
    expect(r.apiKey).toBe("");
  });

  it("preserves a value as a replace", () => {
    const r = updateProviderSchema.parse({ apiKey: "sk-new" });

    expect(r.apiKey).toBe("sk-new");
  });

  it("never substitutes a default for a missing key", () => {
    // A default here would turn every unrelated update into a key wipe.
    const r = updateProviderSchema.parse({ enabled: false });

    expect(r.apiKey).toBeUndefined();
  });
});

describe("model schemas", () => {
  it("coerces numeric strings from form inputs", () => {
    const r = createModelSchema.parse({
      providerId: "3",
      modelId: "gpt-5.2",
      quality: "88",
      inputCost: "1.25",
    });

    expect(r.providerId).toBe(3);
    expect(r.quality).toBe(88);
    expect(r.inputCost).toBe(1.25);
  });

  it("rejects a score above 100 rather than clamping silently", () => {
    const r = createModelSchema.safeParse({
      providerId: 1,
      modelId: "m",
      quality: 500,
    });

    expect(r.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const r = createModelSchema.safeParse({
      providerId: 1,
      modelId: "m",
      outputCost: -5,
    });

    expect(r.success).toBe(false);
  });

  it("rejects a missing providerId", () => {
    expect(createModelSchema.safeParse({ modelId: "m" }).success).toBe(false);
  });

  it("rejects a blank modelId", () => {
    expect(
      createModelSchema.safeParse({ providerId: 1, modelId: "   " }).success,
    ).toBe(false);
  });
});

describe("task schemas", () => {
  it("caps a weight at 10, since weight is relative importance not a score", () => {
    const r = createTaskSchema.safeParse({
      label: "T",
      weights: { coding: 99 },
    });

    expect(r.success).toBe(false);
  });

  it("accepts a null pin as an explicit unpin", () => {
    const r = createTaskSchema.parse({ label: "T", pinnedModelId: null });

    expect(r.pinnedModelId).toBeNull();
  });
});

describe("recommend schema", () => {
  it("requires at least one way of identifying the task", () => {
    const r = recommendSchema.safeParse({ limit: 5 });

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/taskId|taskSlug|text/);
  });

  it("accepts free text alone", () => {
    expect(recommendSchema.safeParse({ text: "review a diff" }).success).toBe(true);
  });

  it("rejects a limit beyond the ranking cap", () => {
    expect(
      recommendSchema.safeParse({ taskSlug: "code-review", limit: 9999 }).success,
    ).toBe(false);
  });
});

describe("playground schema", () => {
  it("rejects an empty prompt", () => {
    expect(
      playgroundSchema.safeParse({ modelRowId: 1, prompt: "   " }).success,
    ).toBe(false);
  });

  it("bounds maxTokens so a typo cannot request a fortune", () => {
    // 8000 is the ceiling; 800000 would be a very expensive slip.
    expect(
      playgroundSchema.safeParse({ modelRowId: 1, prompt: "hi", maxTokens: 800000 })
        .success,
    ).toBe(false);
  });
});

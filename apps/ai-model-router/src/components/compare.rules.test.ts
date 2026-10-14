import { describe, expect, it } from "vitest";

import {
  buildCompareBody,
  compareDisabledHint,
  compareReady,
  type CompareDraft,
} from "./compare.rules";

const READY: CompareDraft = { modelA: "1", modelB: "2", prompt: "hello" };

describe("buildCompareBody", () => {
  it("shapes the POST body with numeric row ids", () => {
    expect(buildCompareBody(READY, false)).toEqual({
      ok: true,
      body: { modelRowIdA: 1, modelRowIdB: 2, prompt: "hello" },
    });
  });

  it("rejects the same model on both sides with a message", () => {
    expect(buildCompareBody({ ...READY, modelB: "1" }, false)).toEqual({
      ok: false,
      error: "pick two different models",
    });
  });

  it.each([
    ["busy", READY, true],
    ["missing model A", { ...READY, modelA: "" }, false],
    ["missing model B", { ...READY, modelB: "" }, false],
    ["blank prompt", { ...READY, prompt: "   " }, false],
  ] as const)("is silently disabled when %s", (_label, draft, busy) => {
    expect(buildCompareBody(draft, busy)).toEqual({ ok: false, error: null });
  });
});

describe("compareDisabledHint", () => {
  it("explains a duplicate pick", () => {
    expect(compareDisabledHint({ ...READY, modelB: "1" }, false)).toBe(
      "pick two different models",
    );
  });

  it("stays quiet while busy or when nothing is wrong", () => {
    expect(compareDisabledHint({ ...READY, modelB: "1" }, true)).toBeNull();
    expect(compareDisabledHint(READY, false)).toBeNull();
    expect(compareDisabledHint({ modelA: "", modelB: "", prompt: "" }, false)).toBeNull();
  });
});

describe("compareReady", () => {
  it("agrees with buildCompareBody on every input", () => {
    const drafts: CompareDraft[] = [
      READY,
      { ...READY, modelB: "1" },
      { ...READY, modelA: "" },
      { ...READY, prompt: "" },
    ];
    for (const draft of drafts) {
      for (const busy of [false, true]) {
        expect(compareReady(draft, busy)).toBe(buildCompareBody(draft, busy).ok);
      }
    }
  });
});

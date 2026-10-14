import { describe, expect, it } from "vitest";

import { systemOneProblems } from "./systemone";

const ok = { enabled: true, endpoints: ["http://10.0.0.5:8000/v1/systemone"] };

describe("systemOneProblems", () => {
  it("accepts a minimal enabled block and a disabled block", () => {
    expect(systemOneProblems(ok)).toEqual([]);
    expect(systemOneProblems({ enabled: false })).toEqual([]);
    expect(systemOneProblems({ enabled: false, endpoints: [] })).toEqual([]);
  });

  it("requires 1 to 3 endpoints when enabled", () => {
    expect(systemOneProblems({ enabled: true })).not.toEqual([]);
    expect(systemOneProblems({ enabled: true, endpoints: [] })).not.toEqual([]);
    const four = Array(4).fill(ok.endpoints[0]);
    expect(systemOneProblems({ enabled: true, endpoints: four })).not.toEqual([]);
  });

  it("rejects endpoints Hermes would discard", () => {
    for (const bad of [
      "ftp://h/v1/systemone",
      "http:///v1/systemone",
      "http://u:p@h/v1/systemone",
      "http://h/v1/systemone?x=1",
      "http://h/v1/systemone#f",
      "http://h/v1/other",
      "not a url",
    ]) {
      expect(systemOneProblems({ enabled: true, endpoints: [bad] }), bad).not.toEqual([]);
    }
    expect(systemOneProblems({ enabled: true, endpoints: ["https://h:9/v1/systemone"] })).toEqual([]);
  });

  it("enforces Hermes numeric bounds", () => {
    const at = (extra: Record<string, unknown>) => systemOneProblems({ ...ok, ...extra });
    expect(at({ timeout_s: 0.1, attempt_timeout_s: 0.05, min_confidence: 0.5 })).toEqual([]);
    expect(at({ timeout_s: 120, attempt_timeout_s: 120, min_confidence: 1 })).toEqual([]);
    expect(at({ timeout_s: 0.09 })).not.toEqual([]);
    expect(at({ timeout_s: 121 })).not.toEqual([]);
    expect(at({ timeout_s: 2, attempt_timeout_s: 3 })).not.toEqual([]);
    expect(at({ attempt_timeout_s: 0.04 })).not.toEqual([]);
    expect(at({ min_confidence: 0.49 })).not.toEqual([]);
    expect(at({ min_confidence: 1.01 })).not.toEqual([]);
    expect(at({ timeout_s: true })).not.toEqual([]);
    expect(at({ timeout_s: Number.POSITIVE_INFINITY })).not.toEqual([]);
  });

  it("checks the default timeout against an explicit attempt timeout", () => {
    expect(systemOneProblems({ ...ok, attempt_timeout_s: 5 })).not.toEqual([]);
  });

  it("rejects model names Hermes would discard", () => {
    expect(systemOneProblems({ ...ok, routine_model: "a/b" })).not.toEqual([]);
    expect(systemOneProblems({ ...ok, verdict_model: "" })).not.toEqual([]);
    expect(systemOneProblems({ ...ok, escalation_model: "x".repeat(65) })).not.toEqual([]);
    expect(systemOneProblems({ ...ok, routine_model: "clef-flash" })).toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  getRecommendation,
  listRecommendations,
  pickRecommendation,
  saveRecommendation,
} from "./recommendations";

// Save + pick + list round-trip against the real (auto-seeded) test database.
// Assertions are scoped to rows this test creates, since the DB seeds data.

describe("recommendations", () => {
  let id = 0;
  beforeEach(() => {
    id = saveRecommendation({
      taskSlug: "t1",
      taskLabel: "Task One",
      prompt: "p",
      ranked: [{ modelId: 1, score: 90 }],
    }).id;
  });

  it("saves and reads back a recommendation snapshot", () => {
    const r = getRecommendation(id);
    expect(r?.taskSlug).toBe("t1");
    expect(r?.ranked).toEqual([{ modelId: 1, score: 90 }]);
    expect(r?.pickedModelRowId).toBeNull();
  });

  it("records which model was picked", () => {
    const r = pickRecommendation(id, 42);
    expect(r?.pickedModelRowId).toBe(42);
    expect(r?.pickedAt).toBeTruthy();
  });

  it("lists newest first and includes saved rows", () => {
    const a = saveRecommendation({ taskSlug: "a", ranked: [] }).id;
    const b = saveRecommendation({ taskSlug: "b", ranked: [] }).id;
    const list = listRecommendations(10);
    const ids = list.map((r) => r.id);
    expect(ids.indexOf(b)).toBeLessThan(ids.indexOf(a)); // newest first
  });

  it("returns null for an unknown id and for picking an unknown id", () => {
    expect(getRecommendation(999999)).toBeNull();
    expect(pickRecommendation(999999, 1)).toBeNull();
  });
});

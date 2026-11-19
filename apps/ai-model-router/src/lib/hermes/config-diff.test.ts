import { describe, expect, it } from "vitest";

import { unifiedDiff } from "./config-diff";

describe("unifiedDiff", () => {
  it("emits real hunks where only the inserted line is marked changed", () => {
    const before = "alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\n";
    const after = "alpha\nbeta\nINSERTED\ngamma\ndelta\nepsilon\nzeta\neta\n";

    const diff = unifiedDiff(before, after);

    expect(diff).toMatch(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@$/m);
    expect(diff).toContain("+INSERTED");
    const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
    expect(removed).toEqual([]);
    expect(diff).toContain(" gamma");
    expect(diff).not.toContain("+gamma");
  });

  it("groups a changed region into one hunk with a matching -/+ pair", () => {
    const before = "one\ntwo\nthree\n";
    const after = "one\nTWO\nthree\n";

    const diff = unifiedDiff(before, after);

    expect(diff).toMatch(/^@@ /m);
    expect(diff).toContain("-two");
    expect(diff).toContain("+TWO");
    expect(diff).toContain(" one");
    expect(diff).toContain(" three");
  });

  it("emits no hunk headers when the text is identical", () => {
    const diff = unifiedDiff("same\ntext\n", "same\ntext\n");
    expect(diff).not.toMatch(/^@@ /m);
    expect(diff).not.toContain("+same");
    expect(diff).not.toContain("-same");
  });
});

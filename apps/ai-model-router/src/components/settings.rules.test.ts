import { describe, expect, it } from "vitest";

import {
  budgetIdFrom,
  budgetStatusTone,
  keyVerifyStatus,
  money,
  parseModelList,
  pricingStaleDaysValue,
} from "./settings.rules";

describe("budgetIdFrom", () => {
  it("slugs the label", () => {
    expect(budgetIdFrom("Team Monthly Cap!", "monthly")).toBe("team-monthly-cap-");
  });

  it("falls back to the period when the label is empty", () => {
    expect(budgetIdFrom("", "daily")).toBe("daily");
  });
});

describe("parseModelList", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseModelList(" gpt-4o , ,claude ,")).toEqual(["gpt-4o", "claude"]);
    expect(parseModelList("")).toEqual([]);
  });
});

describe("keyVerifyStatus", () => {
  it("reports a verified key", () => {
    expect(keyVerifyStatus({ ok: true }, 200)).toEqual({ message: "verified ok", ok: true });
  });

  it("treats unknown certainty as unverified, not failed", () => {
    expect(keyVerifyStatus({ certainty: "unknown", ok: true }, 200)).toEqual({
      message: "unverified: transient error",
      ok: false,
    });
    expect(keyVerifyStatus({ certainty: "unknown", error: "timeout" }, 200).message).toBe(
      "unverified: timeout",
    );
  });

  it("reports failure with the error or the status code", () => {
    expect(keyVerifyStatus({ ok: false, error: "bad key" }, 200).message).toBe("failed: bad key");
    expect(keyVerifyStatus(null, 401).message).toBe("failed: 401");
  });
});

describe("budgetStatusTone", () => {
  it.each(["ok", "warning", "exceeded", "paused"])("labels %s with its own text", (s) => {
    expect(budgetStatusTone(s).label).toBe(s);
  });

  it("uses distinct colors per severity", () => {
    expect(budgetStatusTone("exceeded").cls).toContain("red");
    expect(budgetStatusTone("warning").cls).toContain("amber");
    expect(budgetStatusTone("ok").cls).toContain("green");
    expect(budgetStatusTone("paused").cls).toContain("--fg-dim");
  });
});

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(money(1234)).toBe("$12.34");
    expect(money(0)).toBe("$0.00");
  });
});

describe("pricingStaleDaysValue", () => {
  it("accepts integers inside 1..365", () => {
    expect(pricingStaleDaysValue("1")).toBe(1);
    expect(pricingStaleDaysValue("14")).toBe(14);
    expect(pricingStaleDaysValue("365")).toBe(365);
  });

  it("rejects out-of-range and non-numeric drafts", () => {
    expect(pricingStaleDaysValue("0")).toBeNull();
    expect(pricingStaleDaysValue("366")).toBeNull();
    expect(pricingStaleDaysValue("-5")).toBeNull();
    expect(pricingStaleDaysValue("")).toBeNull();
    expect(pricingStaleDaysValue("abc")).toBeNull();
  });
});

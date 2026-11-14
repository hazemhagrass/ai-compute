import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("./db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

const { appendPricingAudit, getPricingAudit } = await import("./pricing-audit");

beforeEach(() => {
  store.clear();
});

describe("pricing audit", () => {
  it("append adds entry with at/actor/action/details", () => {
    appendPricingAudit({ actor: "u", action: "manual_price_edit", details: { id: 1 } });
    const list = getPricingAudit();
    expect(list).toHaveLength(1);
    expect(list[0].actor).toBe("u");
    expect(list[0].action).toBe("manual_price_edit");
    expect(list[0].details).toEqual({ id: 1 });
    expect(typeof list[0].at).toBe("string");
  });

  it("keeps last 50 after 55 appends", () => {
    for (let i = 0; i < 55; i++) {
      appendPricingAudit({ actor: "s", action: "catalog_refresh", details: { i } });
    }
    const list = getPricingAudit();
    expect(list).toHaveLength(50);
    expect((list[0].details as { i: number }).i).toBe(5);
  });

  it("corrupted JSON returns []", () => {
    store.set("pricing_audit", "{bad");
    expect(getPricingAudit()).toEqual([]);
  });
});

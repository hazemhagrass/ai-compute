import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  freshnessColor,
  PricingFreshnessBadgeView,
  pricingAgeLabel,
} from "./PricingFreshnessBadge";

const DAY = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;
const NOW = 1_900_000_000_000;

function render(props: {
  fetchedAt: number | null;
  now?: number;
  staleDays?: number;
  prefix?: string;
}): string {
  return renderToStaticMarkup(
    createElement(PricingFreshnessBadgeView, {
      now: NOW,
      staleDays: STALE_DAYS,
      ...props,
    }),
  );
}

describe("PricingFreshnessBadgeView", () => {
  it("renders today in neutral colour while the table is fresh (ok)", () => {
    const html = render({ fetchedAt: NOW - 5 * 60 * 1000 });

    expect(html).toContain("today");
    expect(html).toContain('data-freshness="ok"');
    expect(html).not.toContain("stale");
    expect(html).not.toContain("var(--warn)");
    expect(html).not.toContain("var(--bad)");
  });

  it("renders days ago with the --warn token once past the threshold (amber)", () => {
    const html = render({ fetchedAt: NOW - 15 * DAY });

    expect(html).toContain("15 days ago");
    expect(html).toContain('data-freshness="amber"');
    expect(html).toContain("var(--warn)");
    expect(html).toContain("stale");
    expect(html).not.toContain("var(--bad)");
  });

  it("renders never with the --bad token for a missing or dead table (red)", () => {
    for (const fetchedAt of [null, 0]) {
      const html = render({ fetchedAt });

      expect(html).toContain("never");
      expect(html).toContain('data-freshness="red"');
      expect(html).toContain("var(--bad)");
      expect(html).not.toContain("var(--warn)");
    }
  });

  it("flips exactly at the threshold: staleDays fresh, 1ms later amber", () => {
    expect(
      render({ fetchedAt: NOW - STALE_DAYS * DAY }),
    ).toContain('data-freshness="ok"');
    expect(
      render({ fetchedAt: NOW - STALE_DAYS * DAY - 1 }),
    ).toContain('data-freshness="amber"');
  });

  it("honours a custom prefix and staleDays from /api/settings", () => {
    const html = render({
      fetchedAt: NOW - 8 * DAY,
      staleDays: 7,
      prefix: "Pricing data: ",
    });

    expect(html).toContain("Pricing data: ");
    expect(html).toContain("8 days ago");
    expect(html).toContain('data-freshness="amber"');
  });

  it("uses the shared token and label helpers", () => {
    expect(freshnessColor("ok")).toBeUndefined();
    expect(freshnessColor("amber")).toBe("var(--warn)");
    expect(freshnessColor("red")).toBe("var(--bad)");
    expect(pricingAgeLabel(NOW - 5 * 60 * 1000, NOW)).toBe("today");
    expect(pricingAgeLabel(NOW - 3 * DAY, NOW)).toBe("3 days ago");
    expect(pricingAgeLabel(0, NOW)).toBe("never");
    expect(pricingAgeLabel(null, NOW)).toBe("never");
    expect(pricingAgeLabel(Number.NaN, NOW)).toBe("never");
  });

  it("renders singular day and clamps future timestamps (clock skew) to today", () => {
    expect(pricingAgeLabel(NOW - DAY, NOW)).toBe("1 day ago");
    expect(pricingAgeLabel(NOW + DAY, NOW)).toBe("today");
    expect(pricingAgeLabel(NOW + 5, NOW)).toBe("today");
    const html = render({ fetchedAt: NOW - DAY });
    expect(html).toContain("1 day ago");
    expect(html).not.toContain("today");
  });
});

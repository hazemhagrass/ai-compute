import { describe, it, expect, vi } from "vitest";
import { subscribeVisibleRefresh } from "./PricingFreshnessBadge";

describe("subscribeVisibleRefresh", () => {
  it("fires load on window focus", () => {
    const doc = { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const win = new EventTarget();
    const load = vi.fn();
    const unsub = subscribeVisibleRefresh(doc, win, load);
    win.dispatchEvent(new Event("focus"));
    expect(load).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("fires on visibilitychange only when visible", () => {
    const handlers: Record<string, (e: Event) => void> = {};
    const doc = {
      visibilityState: "hidden",
      addEventListener: (t: string, h: (e: Event) => void) => { handlers[t] = h; },
      removeEventListener: (t: string) => { delete handlers[t]; },
    };
    const win = new EventTarget();
    const load = vi.fn();
    const unsub = subscribeVisibleRefresh(doc, win, load);
    doc.visibilityState = "hidden";
    handlers.visibilitychange(new Event("visibilitychange"));
    expect(load).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    handlers.visibilitychange(new Event("visibilitychange"));
    expect(load).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("stops firing after unsubscribe", () => {
    const handlers: Record<string, (e: Event) => void> = {};
    const doc = {
      visibilityState: "visible",
      addEventListener: (t: string, h: (e: Event) => void) => { handlers[t] = h; },
      removeEventListener: (t: string) => { delete handlers[t]; },
    };
    const win = new EventTarget();
    const load = vi.fn();
    const unsub = subscribeVisibleRefresh(doc, win, load);
    unsub();
    win.dispatchEvent(new Event("focus"));
    expect(load).not.toHaveBeenCalled();
  });
});

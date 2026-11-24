import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../", import.meta.url));
const globals = readFileSync(join(srcDir, "app/globals.css"), "utf8");
const ui = readFileSync(join(srcDir, "components/ui.tsx"), "utf8");

function componentSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentSources(path);
    return entry.name.endsWith(".tsx") ? [readFileSync(path, "utf8")] : [];
  });
}

const sources = componentSources(srcDir);

function token(name: string): string {
  const match = globals.match(new RegExp(`\\b${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match?.[1] ?? "";
}

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex.slice(offset + 1, offset + 3), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("design accessibility fixes", () => {
  it("uses the defined --accent-2 token, never --accent2", () => {
    expect(ui).toContain("var(--accent-2)");
    expect(sources.some((source) => source.includes("var(--accent2)"))).toBe(false);
    expect(globals).not.toContain("var(--accent2)");
  });

  it("keeps --fg-dim at 4.5:1 or better on every background token", () => {
    const foreground = token("fg-dim");
    expect(foreground).not.toBe("");
    for (const background of ["bg", "bg-soft", "panel", "panel-2"]) {
      const color = token(background);
      expect(color).not.toBe("");
      expect(contrast(foreground, color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives every interactive element a shared accent focus ring", () => {
    const rule = globals.match(/button:focus-visible[\s\S]*?\n}/)?.[0] ?? "";
    expect(rule).toContain("outline: 2px solid var(--accent)");
    expect(rule).toContain("outline-offset: 2px");
    for (const selector of [
      "button:focus-visible",
      "a:focus-visible",
      "input:focus-visible",
      "select:focus-visible",
      "textarea:focus-visible",
    ]) {
      expect(rule).toContain(selector);
    }
    expect(sources.some((source) => source.includes("outline-none"))).toBe(false);
  });

  it("honours prefers-reduced-motion for named animations and transitions", () => {
    const block =
      globals.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)?.[0] ??
      "";
    expect(block).not.toBe("");
    for (const selector of [".amr-in", ".amr-pulse", ".animate-pulse"]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain("animation: none !important");
    expect(block).toContain("transition: none !important");
  });
});

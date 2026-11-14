import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { ensureAuth, expect, nav, tempDir, test } from "./support/helpers";

interface ExportPayload {
  version: number;
  exportedAt: string;
  providers: unknown[];
  models: unknown[];
  tasks: unknown[];
  subscriptions: unknown[];
  budgets: unknown[];
  routingPolicy: unknown;
  providerKeys: unknown[];
}

// Import upserts touch updatedAt on every row they rewrite, and exportedAt
// is the export moment itself. Normalise only those volatile timestamp
// fields; every other value in the payload must still round-trip exactly.
const VOLATILE_TIME_KEYS = new Set(["updatedAt", "exportedAt"]);
const VOLATILE_TIME = "<volatile timestamp>";

function normaliseVolatileTimestamps<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normaliseVolatileTimestamps(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        VOLATILE_TIME_KEYS.has(key) && typeof val === "string"
          ? VOLATILE_TIME
          : normaliseVolatileTimestamps(val);
    }
    return out as T;
  }
  return value;
}

async function exportConfig(page: Page): Promise<{
  path: string;
  payload: ExportPayload;
  suggestedFilename: string;
}> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export config" }).click(),
  ]);
  const dir = tempDir("amr-e2e-export-");
  const path = join(dir, "export.json");
  await download.saveAs(path);
  const payload = JSON.parse(readFileSync(path, "utf8")) as ExportPayload;
  return { path, payload, suggestedFilename: download.suggestedFilename() };
}

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

test.describe("config export/import round-trip", () => {
  test("an exported config imports back without changing the export", async ({
    page,
  }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /^Providers/ }).click();

    const first = await exportConfig(page);

    // Import the very same file back with upsert semantics.
    await page
      .getByRole("combobox", { name: /already exists/ })
      .selectOption("upsert");
    await page.locator("#amr-import-file").setInputFiles(first.path);
    await expect(page.getByText("Import complete")).toBeVisible();
    await expect(
      page.getByText(/providers \+\d+\/\d+ · models \+\d+\/\d+/),
    ).toBeVisible();

    // The stored provider key must survive the import untouched.
    await expect(page.getByText(/^key sk-e2/)).toBeVisible();

    // Export again and require every stable section to round-trip unchanged.
    const second = await exportConfig(page);
    const stable = normaliseVolatileTimestamps;
    expect(second.payload.version).toBe(first.payload.version);
    expect(stable(second.payload.providers)).toEqual(
      stable(first.payload.providers),
    );
    expect(stable(second.payload.models)).toEqual(stable(first.payload.models));
    expect(stable(second.payload.tasks)).toEqual(stable(first.payload.tasks));
    expect(stable(second.payload.subscriptions)).toEqual(
      stable(first.payload.subscriptions),
    );
    expect(stable(second.payload.budgets)).toEqual(stable(first.payload.budgets));
    expect(stable(second.payload.routingPolicy)).toEqual(
      stable(first.payload.routingPolicy),
    );
    expect(stable(second.payload.providerKeys)).toEqual(
      stable(first.payload.providerKeys),
    );
  });
});

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
    expect(second.payload.version).toBe(first.payload.version);
    expect(second.payload.providers).toEqual(first.payload.providers);
    expect(second.payload.models).toEqual(first.payload.models);
    expect(second.payload.tasks).toEqual(first.payload.tasks);
    expect(second.payload.subscriptions).toEqual(first.payload.subscriptions);
    expect(second.payload.budgets).toEqual(first.payload.budgets);
    expect(second.payload.routingPolicy).toEqual(first.payload.routingPolicy);
    expect(second.payload.providerKeys).toEqual(first.payload.providerKeys);
  });
});

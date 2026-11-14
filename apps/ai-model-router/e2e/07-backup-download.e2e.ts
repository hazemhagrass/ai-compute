import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  E2E_FAKE_KEY,
  ensureAuth,
  expect,
  nav,
  tempDir,
  test,
} from "./support/helpers";

interface BackupProvider {
  name: string;
  keyPreview?: string | null;
}
interface BackupKey {
  providerSlug: string;
  label: string;
  active: boolean;
}

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

test.describe("config backup download", () => {
  test("downloads a complete backup artifact with no secrets in it", async ({
    page,
  }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /^Providers/ }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Export config" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ai-model-router-\d+\.json$/);

    const dir = tempDir("amr-e2e-backup-");
    const path = join(dir, "backup.json");
    await download.saveAs(path);
    const raw = readFileSync(path, "utf8");
    const payload = JSON.parse(raw) as {
      version: number;
      exportedAt: string;
      providers: BackupProvider[];
      models: unknown[];
      tasks: unknown[];
      budgets: unknown[];
      routingPolicy: unknown;
      providerKeys: BackupKey[];
    };

    // A usable backup: dated artifact with every configured object in it.
    expect(payload.version).toBe(2);
    expect(new Date(payload.exportedAt).getTime()).toBeGreaterThan(0);
    expect(payload.providers.some((p) => p.name === "Mock Provider")).toBe(
      true,
    );
    expect(payload.models.length).toBeGreaterThan(0);
    expect(payload.tasks.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.budgets)).toBe(true);
    expect(payload.routingPolicy).toBeTruthy();

    // A backup download must never carry key material or key previews.
    expect(raw).not.toContain(E2E_FAKE_KEY);
    expect(raw).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    for (const provider of payload.providers) {
      expect(provider.keyPreview ?? null).toBe(null);
    }
    for (const key of payload.providerKeys) {
      expect(Object.keys(key).sort()).toEqual(["active", "label", "providerSlug"]);
    }
  });
});

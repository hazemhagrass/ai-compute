import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  expect,
  test as base,
  type APIRequestContext,
} from "@playwright/test";

// Fake password and fake provider key. Nothing here is or should be a real
// credential: every provider call is answered by e2e/mock-provider.mjs.
export const E2E_PASSWORD = "e2e-smoke-password-not-a-real-secret";
export const E2E_FAKE_KEY = "sk-e2e-fake-key-0000000000-not-real";

const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 4105);
export const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

// Extended test: every page fails the test when it throws an uncaught JS
// exception, and console errors are attached to the report for triage.
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.stack ?? err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await use(errors);
    if (consoleErrors.length > 0) {
      await testInfo.attach("console-errors", {
        body: consoleErrors.join("\n"),
        contentType: "text/plain",
      });
    }
    expect(errors, `uncaught page errors: ${errors.join(" | ")}`).toEqual([]);
  },
});

export { expect };

// Authenticate this browser context through the real auth API using the
// password seeded by 01-login.e2e.ts (or set it up when the DB is unconfigured).
export async function ensureAuth(request: APIRequestContext): Promise<void> {
  const res = await request.get("/api/auth");
  expect(res.ok()).toBe(true);
  const status = (await res.json()) as {
    configured: boolean;
    authenticated: boolean;
  };
  if (!status.configured) {
    const setup = await request.put("/api/auth", {
      data: { password: E2E_PASSWORD },
    });
    expect(setup.ok()).toBe(true);
    return;
  }
  if (!status.authenticated) {
    const login = await request.post("/api/auth", {
      data: { password: E2E_PASSWORD },
    });
    expect(login.ok()).toBe(true);
  }
}

// Throwaway directory for downloaded artifacts; never inside the repo.
export function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

// Scope lookups to the tab bar; panel content reuses similar button names
// (for example "Providers & keys" in the Hermes panel).
export function nav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation");
}

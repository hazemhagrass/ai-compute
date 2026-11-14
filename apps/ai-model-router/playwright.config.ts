import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3105);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 4105);

// Smoke suite for the dashboard critical paths. It runs against the
// production build (next start) served from a throwaway temp data dir, with
// every provider call answered by a loopback mock. retries is 0 on purpose:
// a flaky spec is a bug report, not something to paper over.
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "e2e-results",
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-provider.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/healthz`,
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: "bash e2e/start-fresh.sh",
      url: `http://127.0.0.1:${PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

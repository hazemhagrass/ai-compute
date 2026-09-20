import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves tsconfig `paths` natively, so `@/…` imports work without a plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Suites that touch SQLite get their own process, so a test never reads or
    // writes the developer's real router.db.
    pool: "forks",
  },
});

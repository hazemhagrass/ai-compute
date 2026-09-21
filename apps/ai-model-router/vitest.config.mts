import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves tsconfig `paths` natively, so `@/…` imports work without a plugin.
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` is a build-time guard with no runtime implementation, so
      // importing it under Vitest throws. Stubbing it keeps the guard in the
      // source (where it does its job) without breaking the tests.
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Suites that touch SQLite get their own process, so a test never reads or
    // writes the developer's real router.db.
    pool: "forks",
  },
});

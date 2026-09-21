/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * The real package has no runtime export: it exists purely so that a bundler
 * errors when server code is pulled into a client bundle. Tests run outside
 * that bundler, so they need something importable.
 */
export {};

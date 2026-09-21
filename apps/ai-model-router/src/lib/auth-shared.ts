/**
 * Auth constants safe to import from anywhere, including Edge middleware.
 *
 * Kept separate from auth.ts on purpose: that module pulls in better-sqlite3
 * and node:crypto, neither of which exists on the Edge runtime, so importing
 * it from middleware fails the build.
 */
export const SESSION_COOKIE = "amr_session";

/** 12 hours, rolling. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

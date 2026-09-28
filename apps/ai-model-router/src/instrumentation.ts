/**
 * Server start hook: run the retention pass once when the process boots, so a
 * long-lived deployment keeps its tables bounded even if nothing visits the
 * analytics page. Guarded to the Node runtime (the edge runtime has no SQLite)
 * and internally rate-limited to one pass per hour, so a dev server with hot
 * reloads does not prune repeatedly.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb } = await import("./lib/db");
    const { maybeApplyRetention } = await import("./lib/retention");
    maybeApplyRetention(getDb());
  } catch {
    // A failure here must never stop the server from booting: retention is
    // housekeeping, not a prerequisite for serving requests.
  }
}

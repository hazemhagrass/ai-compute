export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb } = await import("./lib/db");
    const { maybeApplyRetention } = await import("./lib/retention");
    maybeApplyRetention(getDb());
  } catch {
  }
}

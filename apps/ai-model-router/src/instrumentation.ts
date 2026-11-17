export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { getDb } = await import("./lib/db");
    const { maybeApplyRetention } = await import("./lib/retention");
    maybeApplyRetention(getDb());
  } catch {
  }
  try {
    const { startBackupScheduler } = await import("./lib/backup-scheduler");
    startBackupScheduler();
  } catch {
  }
}

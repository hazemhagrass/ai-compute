export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { getDb } = await import("./lib/db");
    const { maybeApplyRetention } = await import("./lib/retention");
    maybeApplyRetention(getDb());
  } catch (err) {
    const code = (err as { code?: unknown; name?: unknown })?.code ?? (err as { name?: unknown })?.name;
    console.warn("[instrumentation] retention failed:", code ?? "Error");
  }
  try {
    const { startBackupScheduler } = await import("./lib/backup-scheduler");
    startBackupScheduler();
  } catch (err) {
    const code = (err as { code?: unknown; name?: unknown })?.code ?? (err as { name?: unknown })?.name;
    console.warn("[instrumentation] backup scheduler failed:", code ?? "Error");
  }
}

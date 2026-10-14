import "server-only";

import { checkBudget, listBudgets } from "./budget";
import { checkAllProviders } from "./health";
import { getDb, getSetting, setSetting } from "./db";

export type NotificationKind = "budget" | "provider_down";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  severity: "warning" | "bad";
  message: string;
  ts: string;
  tab: "settings" | "health";
}

const READ_KEY = "notifications:read_ids";
const READ_ID_CAP = 500;

function readReadIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(getSetting(READ_KEY, "[]"));
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function budgetNotifications(now: Date): NotificationItem[] {
  const db = getDb();
  const items: NotificationItem[] = [];
  for (const budget of listBudgets()) {
    if (budget.limitCents <= 0) continue;
    const { evaluation } = checkBudget(db, budget, now);
    if (evaluation.status === "ok") continue;
    items.push({
      id: `budget:${budget.id}:${evaluation.window.key}:${evaluation.status}`,
      kind: "budget",
      severity: evaluation.status === "exceeded" ? "bad" : "warning",
      message:
        evaluation.status === "exceeded"
          ? `Budget "${budget.label || budget.id}" is exhausted: $${(evaluation.spentCents / 100).toFixed(2)} of $${(evaluation.limitCents / 100).toFixed(2)} this ${budget.period.replace("ly", "")}.`
          : `Budget "${budget.label || budget.id}" at ${Math.round(evaluation.percentUsed)}%: $${(evaluation.spentCents / 100).toFixed(2)} of $${(evaluation.limitCents / 100).toFixed(2)}.`,
      ts: now.toISOString(),
      tab: "settings",
    });
  }
  return items;
}

async function healthNotifications(now: Date): Promise<NotificationItem[]> {
  const report = await checkAllProviders();
  return report.results
    .filter((r) => !r.ok && r.error !== "no API key configured")
    .map((r) => ({
      id: `provider_down:${r.id}`,
      kind: "provider_down" as const,
      severity: "bad" as const,
      message: `${r.name} is unreachable: ${r.error ?? "connection failed"}`,
      ts: now.toISOString(),
      tab: "health" as const,
    }));
}

export interface NotificationFeed {
  items: (NotificationItem & { read: boolean })[];
  unreadCount: number;
  checkedAt: string;
}

export async function getNotifications(now: Date = new Date()): Promise<NotificationFeed> {
  const [budgetItems, healthItems] = await Promise.all([
    Promise.resolve(budgetNotifications(now)),
    healthNotifications(now),
  ]);
  const readIds = readReadIds();
  const items = [...budgetItems, ...healthItems]
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "bad" ? -1 : 1))
    .map((item) => ({ ...item, read: readIds.has(item.id) }));

  return {
    items,
    unreadCount: items.filter((i) => !i.read).length,
    checkedAt: now.toISOString(),
  };
}

export function markNotificationsRead(ids: string[]): void {
  const current = readReadIds();
  for (const id of ids) current.add(id);
  const capped = [...current].slice(-READ_ID_CAP);
  setSetting(READ_KEY, JSON.stringify(capped));
}

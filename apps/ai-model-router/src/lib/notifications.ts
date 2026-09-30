import "server-only";

import { checkBudget, listBudgets } from "./budget";
import { checkAllProviders } from "./health";
import { getDb, getSetting, setSetting } from "./db";

/**
 * Merged notification feed (#187): the two signals below are each already
 * computed correctly by their own module -- checkBudget's once-per-threshold
 * alert state and checkAllProviders' per-provider probe -- but neither one
 * had anywhere in the UI that surfaced without the user opening a specific
 * tab. This module only merges and re-shapes what already exists; it does
 * not duplicate any evaluation logic.
 */

export type NotificationKind = "budget" | "provider_down";

export interface NotificationItem {
  /** Stable across calls for the same underlying event, for read-tracking. */
  id: string;
  kind: NotificationKind;
  severity: "warning" | "bad";
  message: string;
  ts: string;
  /** Tab the UI should deep-link to when this item is clicked. */
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

/** Budget alerts persist their own once-per-threshold state; this only
 * asks each budget "what would fire right now" without re-arming anything
 * (checkBudget itself already dedups across calls in the same period). */
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
    // A provider with no key yet is an onboarding state, not an outage --
    // surfacing it here would permanently redden the bell for every seeded
    // provider nobody has configured. Only a provider that WAS reachable
    // (has a key) and is now failing is worth a notification.
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

/** The merged, read-annotated feed the UI polls. */
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

/** Mark one or more notification ids read. Unknown ids are accepted silently
 * so a stale client (already-resolved budget/outage) cannot error the call. */
export function markNotificationsRead(ids: string[]): void {
  const current = readReadIds();
  for (const id of ids) current.add(id);
  // Cap so a long-lived install's read-set cannot grow the settings row
  // without bound; oldest-inserted entries are dropped first since Set
  // iteration order is insertion order.
  const capped = [...current].slice(-READ_ID_CAP);
  setSetting(READ_KEY, JSON.stringify(capped));
}

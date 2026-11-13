import { getSetting, setSetting } from "./db";

const KEY = "pricing_audit";
const MAX = 50;

export interface PricingAuditEntry {
  at: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
}

export function getPricingAudit(): PricingAuditEntry[] {
  try {
    return JSON.parse(getSetting(KEY, "[]")) as PricingAuditEntry[];
  } catch {
    return [];
  }
}

export function appendPricingAudit(entry: Omit<PricingAuditEntry, "at"> & { at?: string }): void {
  const list = getPricingAudit();
  list.push({
    at: entry.at ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    details: entry.details,
  });
  const trimmed = list.slice(-MAX);
  setSetting(KEY, JSON.stringify(trimmed));
}

import "server-only";

import { getDb } from "./db";
import { listModels, listProviders, listTasks } from "./repo";
import { maybeApplyRetention } from "./retention";
import { analytics, listUsage, type Analytics, type UsageEvent } from "./usage";
import type { Model, Provider, Task } from "./types";

/**
 * Initial page data, read straight from SQLite during the server render.
 *
 * Deliberately not an HTTP call to our own API: the database is in-process,
 * so fetching through the network layer would add a round-trip to reach data
 * already in memory. It also means the first paint has real content instead
 * of a spinner, and no component needs a fetch-on-mount effect.
 */
export interface InitialData {
  providers: Provider[];
  models: Model[];
  tasks: Task[];
  analytics: Analytics;
  logs: { events: UsageEvent[]; total: number };
}

export const LOGS_PAGE_SIZE = 25;
export const DEFAULT_ANALYTICS_DAYS = 30;

export function getInitialData(): InitialData {
  // Retention runs here as well as from the analytics API (#165): the initial
  // server render is a guaranteed once-per-page-load entry point, and the pass
  // itself is guarded to at most once per hour.
  maybeApplyRetention(getDb());

  return {
    providers: listProviders(),
    models: listModels(),
    tasks: listTasks(),
    analytics: analytics(DEFAULT_ANALYTICS_DAYS),
    logs: listUsage({ limit: LOGS_PAGE_SIZE }),
  };
}

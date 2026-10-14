import "server-only";

import { getDb } from "./db";
import { listModels, listProviders, listTasks } from "./repo";
import { maybeApplyRetention } from "./retention";
import { analytics, listUsage, type Analytics, type UsageEvent } from "./usage";
import type { Model, Provider, Task } from "./types";

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
  maybeApplyRetention(getDb());

  return {
    providers: listProviders(),
    models: listModels(),
    tasks: listTasks(),
    analytics: analytics(DEFAULT_ANALYTICS_DAYS),
    logs: listUsage({ limit: LOGS_PAGE_SIZE }),
  };
}

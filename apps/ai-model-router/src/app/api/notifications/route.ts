import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getNotifications, markNotificationsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Merged budget-alert + provider-outage feed (#187), polled by the bell in
 * AppShell. Both signals are recomputed live on every call rather than
 * cached: budgets and provider health already do their own persistence
 * (once-per-threshold alert state, provider probe results), so this route
 * has nothing of its own to cache. */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json(await getNotifications());
}

const readSchema = z.object({
  ids: z.array(z.string()).min(1),
});

/** Mark one or more notification ids read. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = readSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  markNotificationsRead(parsed.data.ids);
  return NextResponse.json(await getNotifications());
}

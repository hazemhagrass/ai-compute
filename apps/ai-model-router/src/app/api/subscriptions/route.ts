import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import {
  listSubscriptions,
  subscriptionInputSchema,
  upsertSubscription,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json({ subscriptions: listSubscriptions() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const parsed = subscriptionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json({ subscription: upsertSubscription(parsed.data) });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import {
  getRoutingPolicy,
  resetRoutingPolicy,
  routingPolicySchema,
  updateRoutingPolicy,
} from "@/lib/routing-policy";

export const dynamic = "force-dynamic";

/** Any subset of the policy fields is a valid PATCH body. */
const patchSchema = routingPolicySchema.partial();

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json({ policy: getRoutingPolicy() });
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json({ policy: updateRoutingPolicy(parsed.data) });
}

/** DELETE resets to default; safer than exposing a magic "reset=true" flag. */
export async function DELETE() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json({ policy: resetRoutingPolicy() });
}

// z is imported to keep zod as a peer dep of this file's compilation graph.
void z;

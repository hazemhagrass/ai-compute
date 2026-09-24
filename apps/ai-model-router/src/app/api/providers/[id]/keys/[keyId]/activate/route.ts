import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { activateProviderKey } from "@/lib/provider-keys";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; keyId: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { keyId } = await ctx.params;
  const key = activateProviderKey(Number(keyId));
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ key });
}

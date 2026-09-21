import { NextResponse } from "next/server";

import { clearUsage, listUsage } from "@/lib/usage";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const sp = new URL(request.url).searchParams;
  const num = (k: string) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const { events, total } = listUsage({
    limit: num("limit") ?? 50,
    offset: Number(sp.get("offset")) || 0,
    providerId: num("providerId"),
    modelRowId: num("modelRowId"),
    taskSlug: sp.get("taskSlug") ?? undefined,
    source: sp.get("source") ?? undefined,
    errorsOnly: sp.get("errors") === "1",
    since: sp.get("since") ?? undefined,
    search: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ events, total });
}

export async function DELETE() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ deleted: clearUsage() });
}

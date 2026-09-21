import { NextResponse } from "next/server";

import { createProvider, listProviders } from "@/lib/repo";
import { createProviderSchema, parseBody } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = await parseBody(request, createProviderSchema);
  if (!parsed.ok) return parsed.response;

  return NextResponse.json({ provider: createProvider(parsed.data) }, { status: 201 });
}

import { NextResponse } from "next/server";

import { createProvider, listProviders } from "@/lib/repo";
import { createProviderSchema, parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createProviderSchema);
  if (!parsed.ok) return parsed.response;

  return NextResponse.json({ provider: createProvider(parsed.data) }, { status: 201 });
}

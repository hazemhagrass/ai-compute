import { NextResponse } from "next/server";

import { createProvider, listProviders } from "@/lib/repo";
import type { ProviderInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProviderInput;
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!body?.baseUrl?.trim()) {
      return NextResponse.json({ error: "baseUrl is required" }, { status: 400 });
    }
    return NextResponse.json({ provider: createProvider(body) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid request" },
      { status: 400 },
    );
  }
}

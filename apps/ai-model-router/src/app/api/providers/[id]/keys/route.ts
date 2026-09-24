import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import {
  addProviderKey,
  listProviderKeys,
} from "@/lib/provider-keys";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  key: z.string().trim().min(1, "key is required"),
  label: z.string().default(""),
  activate: z.boolean().default(false),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ keys: listProviderKeys(Number(id)) });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const key = addProviderKey(
    Number(id),
    parsed.data.key,
    parsed.data.label,
    parsed.data.activate,
  );
  return NextResponse.json({ key });
}

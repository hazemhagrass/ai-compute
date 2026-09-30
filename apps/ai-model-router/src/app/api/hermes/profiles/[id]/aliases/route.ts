import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { aliasNameSchema, listAliases, removeAlias, setAlias } from "@/lib/hermes/aliases";
import { modelRefSchema } from "@/lib/hermes/config-schema";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({ name: aliasNameSchema, ref: modelRefSchema });
const deleteSchema = z.object({ name: aliasNameSchema });

/** `model_aliases`: friendly name -> real provider/model. */
export async function GET(_req: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/aliases">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  return NextResponse.json({ aliases: listAliases(id) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/aliases">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, upsertSchema);
  if (!parsed.ok) return parsed.response;

  const aliases = setAlias(id, parsed.data.name, parsed.data.ref);
  return NextResponse.json({ aliases }, { status: 201 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/aliases">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  const aliases = removeAlias(id, parsed.data.name);
  return NextResponse.json({ aliases });
}

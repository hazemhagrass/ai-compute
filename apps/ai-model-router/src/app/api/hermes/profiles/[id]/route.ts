import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { deleteProfile, listHermesProfiles } from "@/lib/hermes/profiles";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const deleteSchema = z.object({ confirm: z.literal(true) });

/** Delete a named profile — moves its directory to `.deleted-<id>-<ts>`
 * rather than rm -rf'ing it. Requires an explicit `{ confirm: true }` body
 * so a bare DELETE from a stray script/curl can't nuke a profile by
 * accident; the "default" profile is always rejected. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    deleteProfile(id);
    return NextResponse.json({ profiles: listHermesProfiles() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

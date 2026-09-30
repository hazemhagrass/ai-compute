import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createProfile, listHermesProfiles } from "@/lib/hermes/profiles";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "profile name is required")
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "profile name must look like an identifier"),
});

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ profiles: listHermesProfiles() });
}

/** Create a new named profile (`profiles/<id>/` with a minimal config.yaml
 * + empty .env). The default profile always exists and can't be created. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = await parseBody(request, createSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const profile = createProfile(parsed.data.id);
    return NextResponse.json({ profile, profiles: listHermesProfiles() }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

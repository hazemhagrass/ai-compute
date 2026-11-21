import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import type { TierRouterConfig } from "@/lib/hermes/config-schema";
import { ConfigChangeError } from "@/lib/hermes/config-errors";
import { createProfile, listHermesProfiles } from "@/lib/hermes/profiles";
import { resolveTierRouterSource, validateImportedRouter } from "@/lib/hermes/router-import";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Optional from (profile id) or preset seeds the new profile's tier_router
// instead of the empty one. Exactly one of the two is checked by hand so it
// returns 400 rather than the schema parser's 422.
const createSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "profile name is required")
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "profile name must look like an identifier"),
  from: z.string().trim().min(1).optional(),
  preset: z.string().trim().min(1).optional(),
});

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  return NextResponse.json({ profiles: listHermesProfiles() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = await parseBody(request, createSchema);
  if (!parsed.ok) return parsed.response;

  const { id, from, preset } = parsed.data;
  if (from && preset) {
    return NextResponse.json({ error: "provide at most one of from or preset" }, { status: 400 });
  }
  if (from && from.trim() === id) {
    return NextResponse.json({ error: "a profile cannot copy from itself" }, { status: 400 });
  }

  try {
    let tierRouter: TierRouterConfig | undefined;
    if (from || preset) {
      tierRouter = resolveTierRouterSource(from ? { from } : { preset: preset! });
      // Validate before creating anything, so a structurally broken source
      // router leaves no half-created profile behind.
      const outcome = validateImportedRouter(tierRouter);
      if (outcome.errors.length > 0) {
        return NextResponse.json(
          {
            error: `config validation failed: fix ${outcome.errors.length} highlighted row problem(s)`,
            errors: outcome.errors,
            warnings: outcome.warnings,
          },
          { status: 400 },
        );
      }
    }
    const profile = createProfile(id, tierRouter);
    return NextResponse.json({ profile, profiles: listHermesProfiles() }, { status: 201 });
  } catch (err) {
    if (err instanceof ConfigChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { ConfigChangeError } from "@/lib/hermes/config-errors";
import {
  commitConfigChange,
  expectedBaseHash,
  planConfigChange,
  planPayload,
  type ConfigChangePlan,
} from "@/lib/hermes/config-plan";
import { applyImportTierRouter, resolveTierRouterSource } from "@/lib/hermes/router-import";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Exactly one of { from: profileId } or { preset: name }. The exactly-one rule
// and the self-import rule are checked by hand so they return 400 rather than
// the schema parser's 422.
const importSchema = z.object({
  from: z.string().trim().min(1).optional(),
  preset: z.string().trim().min(1).optional(),
});

function isDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get("dry_run") === "1";
}

// Same write protocol as the tier routes: dry-run returns the preview only, a
// real write refuses an invalid plan with 400 and a stale If-Match baseHash
// with 409, and commits through the shared config-plan write path.
function finish(
  request: Request,
  profileId: string,
  plan: ConfigChangePlan,
  dryRun: boolean,
): NextResponse {
  const payload = planPayload(plan, dryRun);
  if (dryRun) return NextResponse.json(payload);
  if (!plan.valid) {
    return NextResponse.json(
      {
        ...payload,
        error: `config validation failed: fix ${plan.errors.length} highlighted row problem(s)`,
      },
      { status: 400 },
    );
  }
  const expected = expectedBaseHash(request);
  if (expected && expected !== plan.baseHash) {
    return NextResponse.json(
      { error: "config.yaml changed since the preview was generated; re-run the preview" },
      { status: 409 },
    );
  }
  commitConfigChange(profileId, plan);
  return NextResponse.json({ ...payload, tierRouter: plan.next.tier_router ?? null });
}

function changeErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ConfigChangeError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

export async function POST(request: Request, ctx: RouteContext<"/api/hermes/profiles/[id]/tiers/import">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const dryRun = isDryRun(request);
  const parsed = await parseBody(request, importSchema);
  if (!parsed.ok) return parsed.response;

  const { from, preset } = parsed.data;
  if ((from && preset) || (!from && !preset)) {
    return NextResponse.json({ error: "provide exactly one of from or preset" }, { status: 400 });
  }
  if (from && from.trim() === id) {
    return NextResponse.json({ error: "a profile cannot import its own tier_router" }, { status: 400 });
  }

  try {
    const tierRouter = resolveTierRouterSource(from ? { from } : { preset: preset! });
    const plan = planConfigChange(id, { kind: "import" }, (cfg) =>
      applyImportTierRouter(cfg, tierRouter),
    );
    return finish(request, id, plan, dryRun);
  } catch (err) {
    const res = changeErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

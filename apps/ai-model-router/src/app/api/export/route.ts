import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listBudgets } from "@/lib/budget";
import { listProviderKeys } from "@/lib/provider-keys";
import { listModels, listProviders, listTasks } from "@/lib/repo";
import { getRoutingPolicy } from "@/lib/routing-policy";
import { listSubscriptions } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Full config backup.
 *
 * API keys are NEVER included -- not the provider key and not key-pool
 * entries' secrets either. Key-pool rows export their METADATA only (label,
 * active flag) so a new machine recreates the pool shape and the user
 * re-enters secrets into it; a masked string is not a credential, and
 * storing it as if it were one fails only when the first real request is
 * made. Subscriptions, budgets, and the routing policy export in full:
 * they contain no secrets and an import without them leaves a router
 * that refuses every call (no subscription = blocked by entitlement).
 */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const providers = listProviders();
  const providerSlugById = new Map(providers.map((p) => [p.id, p.slug]));

  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    providers: providers.map((p) => ({ ...p, keyPreview: undefined })),
    models: listModels(),
    tasks: listTasks(),
    subscriptions: listSubscriptions().map((s) => ({
      providerSlug: providerSlugById.get(s.providerId) ?? "",
      tier: s.tier,
      allowModels: s.allowModels,
      denyModels: s.denyModels,
      monthlyInput: s.monthlyInput,
      monthlyOutput: s.monthlyOutput,
      monthlyBudget: s.monthlyBudget,
      notes: s.notes,
    })),
    budgets: listBudgets(),
    routingPolicy: getRoutingPolicy(),
    providerKeys: providers.flatMap((p) =>
      listProviderKeys(p.id).map((k) => ({
        providerSlug: p.slug,
        label: k.label,
        active: k.active,
      })),
    ),
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
        "content-disposition": "attachment; filename=ai-model-router-" + String(Date.now()) + ".json",
    },
  });
}

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { listBudgets } from "@/lib/budget";
import { listProviderKeys } from "@/lib/provider-keys";
import { listModels, listProviders, listTasks } from "@/lib/repo";
import { getRoutingPolicy } from "@/lib/routing-policy";
import { listSubscriptions } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

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

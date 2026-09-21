import { NextResponse } from "next/server";

import { deleteModel, getModel, updateModel, getProvider } from "@/lib/repo";
import { parseBody, updateModelSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth";
import { validateModelIdAgainstProvider } from "@/lib/model-validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const model = getModel(Number(id));
  if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/models/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = await parseBody(request, updateModelSchema);
  if (!parsed.ok) return parsed.response;

  const existing = getModel(Number(id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const nextModelId = parsed.data.modelId ?? existing.modelId;
  const nextProviderId = parsed.data.providerId ?? existing.providerId;
  if (nextModelId !== existing.modelId || nextProviderId !== existing.providerId) {
    const provider = getProvider(nextProviderId);
    if (!provider) {
      return NextResponse.json({ error: "provider not found" }, { status: 404 });
    }
    const check = await validateModelIdAgainstProvider(provider, nextModelId);
    if (check.status === "mismatch") {
      return NextResponse.json(
        {
          error: `model id "${check.modelId}" was not found in ${provider.name}'s model catalogue`,
          code: "model_id_not_found",
          modelId: check.modelId,
          didYouMean: check.suggestions,
          catalogueSize: check.catalogueSize,
        },
        { status: 409 },
      );
    }
  }

  const model = updateModel(Number(id), parsed.data);
  if (!model) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/models/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await ctx.params;
  const ok = deleteModel(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

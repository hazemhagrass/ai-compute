import { NextResponse } from "next/server";

import { listModels, listProviders, listTasks } from "@/lib/repo";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Full config backup. API keys are NEVER included — only which providers had
 * one, so you re-enter secrets on the new machine.
 */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    providers: listProviders().map((p) => ({ ...p, keyPreview: undefined })),
    models: listModels(),
    tasks: listTasks(),
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ai-model-router-${Date.now()}.json"`,
    },
  });
}

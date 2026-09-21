import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  budgetSchema,
  checkBudget,
  listBudgets,
  saveBudget,
} from "@/lib/budget";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const budgets = listBudgets();
  // Live status alongside the definition, so the UI needs no second call.
  return NextResponse.json({
    budgets: budgets.map((b) => ({
      ...b,
      check: checkBudget(getDb(), b, new Date()),
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = budgetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  return NextResponse.json({ budget: saveBudget(parsed.data) }, { status: 201 });
}

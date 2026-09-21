import { NextResponse } from "next/server";

import { fetchCatalog, recalcCheapness, syncPricing } from "@/lib/pricing";
import { pricingSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: browse the OpenRouter public catalogue (prices per 1M tokens). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").toLowerCase();
  const limit = Math.min(500, Number(sp.get("limit")) || 100);
  try {
    const { entries, cachedAt, fromCache } = await fetchCatalog(sp.get("force") === "1");
    const filtered = q
      ? entries.filter(
          (e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
        )
      : entries;
    return NextResponse.json({
      cachedAt,
      fromCache,
      total: filtered.length,
      entries: filtered.slice(0, limit),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "catalog fetch failed" },
      { status: 502 },
    );
  }
}

/** POST: sync stored model prices against OpenRouter. { apply, recalc } */
export async function POST(request: Request) {
  // An empty body is a valid dry run, so a parse failure is not an error here.
  let body: { apply?: boolean; recalcCheapness?: boolean } = {};
  try {
    body = pricingSchema.parse(await request.json());
  } catch {
    body = {};
  }
  try {
    const result = await syncPricing(body.apply === true);
    const recalced =
      body.apply === true && body.recalcCheapness !== false ? recalcCheapness() : 0;
    return NextResponse.json({ ...result, cheapnessUpdated: recalced });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed" },
      { status: 502 },
    );
  }
}

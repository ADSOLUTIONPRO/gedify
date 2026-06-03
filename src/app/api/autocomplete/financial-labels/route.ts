import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listFinancialItems } from "@/lib/budget/financial-item-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const all = await listFinancialItems({ limit: 200 });
    const labels = new Map<string, number>();
    for (const item of all) {
      if (!item.label) continue;
      labels.set(item.label, (labels.get(item.label) ?? 0) + 1);
    }
    const items = Array.from(labels.entries())
      .filter(([label]) => (q ? label.toLowerCase().includes(q) : true))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([label, count]) => ({ id: label, label, helper: `${count}×` }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete libellés impossible", error);
  }
}

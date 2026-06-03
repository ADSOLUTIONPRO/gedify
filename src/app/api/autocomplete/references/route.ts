import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listDetectedInfos } from "@/lib/ai/detected-info-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
    const all = await listDetectedInfos();
    const set = new Map<string, number>();
    for (const info of all) {
      if (
        info.kind !== "reference" &&
        info.kind !== "invoice_number" &&
        info.kind !== "customer_number" &&
        info.kind !== "contract_number"
      )
        continue;
      const ref = info.referenceValue ?? info.value;
      if (!ref) continue;
      set.set(ref, (set.get(ref) ?? 0) + 1);
    }
    const items = Array.from(set.entries())
      .filter(([ref]) => (q ? ref.toLowerCase().includes(q) : true))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([ref, count]) => ({ id: ref, label: ref, helper: `${count}×` }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete références impossible", error);
  }
}

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
      if (info.kind !== "organization") continue;
      const value = info.textValue ?? info.value;
      if (!value) continue;
      set.set(value, (set.get(value) ?? 0) + 1);
    }
    const items = Array.from(set.entries())
      .filter(([name]) => (q ? name.toLowerCase().includes(q) : true))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ id: name, label: name, helper: `${count}×` }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplete organismes impossible", error);
  }
}

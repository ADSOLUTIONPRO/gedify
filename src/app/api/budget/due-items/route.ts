import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { buildDueItems } from "@/lib/budget/budget-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const horizonRaw = request.nextUrl.searchParams.get("days");
    const days = horizonRaw ? Math.min(180, Math.max(1, Number.parseInt(horizonRaw, 10))) : 30;
    const items = await buildDueItems(days);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de calculer les échéances", error);
  }
}

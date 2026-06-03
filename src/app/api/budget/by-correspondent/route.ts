import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getAllCorrespondentsFinancialSummary,
  getCorrespondentFinancialSummary,
} from "@/lib/budget/budget-calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const idRaw = request.nextUrl.searchParams.get("correspondentId");
    if (idRaw) {
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "correspondentId invalide" }, { status: 400 });
      }
      const payload = await getCorrespondentFinancialSummary(id);
      return NextResponse.json(payload);
    }
    const all = await getAllCorrespondentsFinancialSummary();
    return NextResponse.json({ items: all });
  } catch (error) {
    return jsonError("Impossible de calculer par correspondant", error);
  }
}

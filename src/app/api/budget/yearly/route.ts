import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { currentBudgetYear } from "@/lib/budget/budget-periods";
import { getYearlySummary } from "@/lib/budget/budget-calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get("year") ?? currentBudgetYear();
    const summary = await getYearlySummary(year);
    return NextResponse.json({ summary });
  } catch (error) {
    return jsonError("Impossible de calculer l'année budgétaire", error);
  }
}

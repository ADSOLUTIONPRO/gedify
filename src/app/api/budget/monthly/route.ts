import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { currentBudgetMonth } from "@/lib/budget/budget-periods";
import { getMonthlySummary } from "@/lib/budget/budget-calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month") ?? currentBudgetMonth();
    const summary = await getMonthlySummary(month);
    return NextResponse.json({ summary });
  } catch (error) {
    return jsonError("Impossible de calculer le mois budgétaire", error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getDetectedInfo,
  updateDetectedInfo,
} from "@/lib/ai/detected-info-store";
import { createFinancialItem } from "@/lib/budget/financial-item-store";
import { toBudgetMonth } from "@/lib/budget/budget-periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const info = await getDetectedInfo(id);
    if (!info) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const amount = info.amount ?? Number.parseFloat(info.value);
    if (!Number.isFinite(amount)) {
      return NextResponse.json(
        { error: "Aucun montant exploitable." },
        { status: 422 },
      );
    }

    const item = await createFinancialItem({
      sourceDocumentId: info.sourceDocumentId,
      sourceAnalysisId: info.sourceAnalysisId,
      kind: "debt",
      label: info.label,
      amount,
      amountRemaining: amount,
      currency: info.currency ?? "EUR",
      dueDate: info.dateValue ?? null,
      budgetMonth:
        toBudgetMonth(info.dateValue) ?? toBudgetMonth(new Date()),
      correspondentId: info.correspondentId,
      correspondentName: info.correspondentName,
      isAiDetected: info.source === "ai",
      aiConfidence: info.confidence ?? null,
      validationStatus: "validated",
      status: "validated",
      validatedAt: new Date().toISOString(),
    });

    const updatedInfo = await updateDetectedInfo(id, {
      status: "converted_to_debt",
      financialItemId: item.id,
    });

    return NextResponse.json({ financialItem: item, info: updatedInfo });
  } catch (error) {
    return jsonError("Conversion vers dette impossible", error);
  }
}

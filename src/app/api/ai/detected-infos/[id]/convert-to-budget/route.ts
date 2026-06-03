import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getDetectedInfo,
  updateDetectedInfo,
} from "@/lib/ai/detected-info-store";
import { createFinancialItem } from "@/lib/budget/financial-item-store";
import { toBudgetMonth } from "@/lib/budget/budget-periods";
import type {
  FinancialItemInput,
  FinancialKind,
} from "@/lib/budget/financial-item-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  kind?: FinancialKind;
  label?: string;
  budgetMonth?: string;
  dueDate?: string;
  overrides?: Partial<FinancialItemInput>;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const info = await getDetectedInfo(id);
    if (!info) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Body;

    const amount = info.amount ?? Number.parseFloat(info.value);
    if (!Number.isFinite(amount)) {
      return NextResponse.json(
        { error: "Cette information n'a pas de montant exploitable." },
        { status: 422 },
      );
    }

    const kind = body.kind ?? "expense";
    const dueDate = body.dueDate ?? info.dateValue ?? null;
    const budgetMonth =
      body.budgetMonth ??
      toBudgetMonth(dueDate) ??
      toBudgetMonth(info.dateValue) ??
      toBudgetMonth(new Date());

    const item = await createFinancialItem({
      sourceDocumentId: info.sourceDocumentId,
      sourceAnalysisId: info.sourceAnalysisId,
      kind,
      label: body.label ?? info.label,
      amount,
      currency: info.currency ?? "EUR",
      dueDate,
      budgetMonth,
      correspondentId: info.correspondentId,
      correspondentName: info.correspondentName,
      projectId: info.projectId,
      projectName: info.projectName,
      categoryId: info.categoryId,
      categoryName: info.categoryName,
      isAiDetected: info.source === "ai",
      aiConfidence: info.confidence ?? null,
      validationStatus: "validated",
      status: "validated",
      validatedAt: new Date().toISOString(),
      ...(body.overrides ?? {}),
    });

    const updatedInfo = await updateDetectedInfo(id, {
      status: "converted_to_budget",
      financialItemId: item.id,
    });

    return NextResponse.json({ financialItem: item, info: updatedInfo });
  } catch (error) {
    return jsonError("Conversion vers budget impossible", error);
  }
}

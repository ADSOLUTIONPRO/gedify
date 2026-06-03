import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createAction } from "@/lib/actions/action-store";
import { getFinancialItem } from "@/lib/budget/financial-item-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { financialItemId: string };

/** Transforme une échéance / dette financière en action « À payer » (statut à faire). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const item = await getFinancialItem(body.financialItemId);
    if (!item) return NextResponse.json({ error: "Item financier introuvable" }, { status: 404 });

    const action = await createAction({
      title: `Payer ${item.label}`,
      description: item.description || "",
      type: "to-pay",
      status: "todo",
      priority: item.paymentStatus === "overdue" ? "urgent" : "normal",
      dueDate: item.dueDate,
      budgetItemId: item.id,
      amount: item.amount,
      currency: item.currency,
      correspondentId: item.correspondentId,
      projectId: item.projectId,
      documentIds: item.sourceDocumentId ? [item.sourceDocumentId] : [],
      createdFrom: "manual",
    });
    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return jsonError("Création de l'action impossible", error);
  }
}

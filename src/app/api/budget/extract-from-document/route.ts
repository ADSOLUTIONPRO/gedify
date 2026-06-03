import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  createDebt,
  createExpense,
  createRevenue,
} from "@/lib/budget/budget-store";
import { getAnalysis } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  analysisId: string;
  /** Which financial impact entry (by index) to import. Default 0. */
  index?: number;
  /** Optional override: force a target kind. */
  targetKind?: "revenue" | "expense" | "debt";
  /** Optional override for the category id. */
  categoryId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.analysisId) {
      return NextResponse.json({ error: "analysisId requis." }, { status: 400 });
    }
    const analysis = await getAnalysis(body.analysisId);
    if (!analysis) {
      return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
    }
    const entry = analysis.financialImpact[body.index ?? 0];
    if (!entry) {
      return NextResponse.json({ error: "Aucune extraction financière à cet index." }, { status: 404 });
    }

    const target =
      body.targetKind ??
      (entry.kind === "income" || entry.kind === "allowance" || entry.kind === "benefit" || entry.kind === "refund"
        ? "revenue"
        : entry.kind === "debt" || entry.kind === "loan" || entry.kind === "credit"
          ? "debt"
          : "expense");

    if (target === "revenue") {
      const created = await createRevenue({
        label: analysis.summary.slice(0, 80) || "Revenu détecté",
        source: entry.category ?? entry.creditor ?? "autre",
        amount: entry.amount,
        currency: entry.currency,
        date: entry.paidDate ?? new Date().toISOString().slice(0, 10),
        recurrence: entry.recurrence === "monthly" ? "monthly" : "one-shot",
        category: body.categoryId ?? entry.category ?? null,
        documentId: analysis.documentId,
        status: "planned",
        notes: `Source IA : ${analysis.id}`,
      });
      return NextResponse.json({ kind: "revenue", item: created }, { status: 201 });
    }

    if (target === "debt") {
      const created = await createDebt({
        label: analysis.summary.slice(0, 80) || "Dette détectée",
        creditor: entry.creditor ?? "",
        initialAmount: entry.amount,
        remainingAmount: entry.amount,
        currency: entry.currency,
        dueDate: entry.dueDate ?? null,
        status: "to-pay",
        priority: "normal",
        documentIds: [analysis.documentId],
        notes: `Source IA : ${analysis.id}`,
      });
      return NextResponse.json({ kind: "debt", item: created }, { status: 201 });
    }

    const created = await createExpense({
      label: analysis.summary.slice(0, 80) || "Dépense détectée",
      payee: entry.creditor ?? "",
      amount: entry.amount,
      currency: entry.currency,
      date: new Date().toISOString().slice(0, 10),
      dueDate: entry.dueDate ?? null,
      category: body.categoryId ?? entry.category ?? null,
      recurrence: "one-shot",
      documentId: analysis.documentId,
      status: entry.dueDate && new Date(entry.dueDate).getTime() < Date.now() ? "overdue" : "to-pay",
      notes: `Source IA : ${analysis.id}`,
    });
    return NextResponse.json({ kind: "expense", item: created }, { status: 201 });
  } catch (error) {
    return jsonError("Import budget impossible", error);
  }
}

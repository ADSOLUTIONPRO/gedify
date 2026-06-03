import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { addDebtPayment } from "@/lib/budget/budget-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  amount: number;
  date?: string;
  documentId?: number | null;
  notes?: string;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;
    if (typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json({ error: "amount > 0 requis." }, { status: 400 });
    }
    const item = await addDebtPayment(id, {
      amount: body.amount,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      documentId: body.documentId ?? null,
      notes: body.notes ?? "",
    });
    if (!item) return NextResponse.json({ error: "Dette introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible d'ajouter le paiement", error);
  }
}

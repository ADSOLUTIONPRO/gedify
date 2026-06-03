import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { recordPayment } from "@/lib/budget/financial-item-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Body = { amount: number; date?: string };

/**
 * Enregistre un paiement sur un item financier (met à jour amountPaid /
 * amountRemaining / statut via `recordPayment`). Alias REST de
 * `/financial-items/[id]/pay`. Le modèle agrège les paiements (montant payé
 * cumulé) : il n'y a pas d'historique de paiements individuels (PATCH/DELETE
 * paymentId non exposés).
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;
    if (typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json({ error: "amount > 0 requis" }, { status: 400 });
    }
    const item = await recordPayment(id, body.amount, body.date);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible d'enregistrer le paiement", error);
  }
}

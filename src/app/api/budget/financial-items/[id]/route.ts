import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { recordAudit } from "@/lib/audit/audit-store";
import {
  deleteFinancialItem,
  getFinancialItem,
  updateFinancialItem,
} from "@/lib/budget/financial-item-store";
import type { FinancialItemInput } from "@/lib/budget/financial-item-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Résumé lisible des champs modifiés (sans exposer les montants en clair). */
function summarizePatch(body: FinancialItemInput): string {
  const parts: string[] = [];
  if (body.status) parts.push(`statut=${body.status}`);
  if (body.validationStatus) parts.push(`validation=${body.validationStatus}`);
  if (body.amount !== undefined) parts.push("montant");
  if (body.dueDate !== undefined) parts.push("échéance");
  if (body.categoryName !== undefined || body.categoryId !== undefined) parts.push("catégorie");
  if (body.kind !== undefined) parts.push("type");
  if (body.sourceDocumentId !== undefined) parts.push("document lié");
  if (parts.length) return parts.join(", ");
  const keys = Object.keys(body).filter((k) => k !== "updatedAt");
  return keys.length ? `champs: ${keys.slice(0, 6).join(", ")}` : "—";
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const item = await getFinancialItem(id);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de récupérer l'item", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as FinancialItemInput;
    const item = await updateFinancialItem(id, body);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    await recordAudit({ action: "budget.item.update", target: `#${id}`, details: summarizePatch(body) });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de modifier l'item", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteFinancialItem(id);
    if (!ok) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    await recordAudit({ action: "budget.item.delete", target: `#${id}` });
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer l'item", error);
  }
}

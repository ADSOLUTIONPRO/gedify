import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteFinancialItem,
  getFinancialItem,
  updateFinancialItem,
} from "@/lib/budget/financial-item-store";
import type { FinancialItemInput } from "@/lib/budget/financial-item-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer l'item", error);
  }
}

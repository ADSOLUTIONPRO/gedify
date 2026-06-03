import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { deleteExpense, updateExpense } from "@/lib/budget/budget-store";
import type { ExpenseInput } from "@/lib/budget/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as ExpenseInput;
    const item = await updateExpense(id, body);
    if (!item) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de modifier la dépense", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteExpense(id);
    if (!ok) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer la dépense", error);
  }
}

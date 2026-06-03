import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createExpense, listExpenses } from "@/lib/budget/budget-store";
import type { ExpenseInput } from "@/lib/budget/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listExpenses();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les dépenses", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExpenseInput;
    const item = await createExpense(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer la dépense", error);
  }
}

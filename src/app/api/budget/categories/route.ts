import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createCategory, listCategories } from "@/lib/budget/budget-store";
import type { BudgetCategoryInput } from "@/lib/budget/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listCategories();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les catégories", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BudgetCategoryInput;
    const item = await createCategory(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer la catégorie", error);
  }
}

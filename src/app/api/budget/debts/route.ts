import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createDebt, listDebts } from "@/lib/budget/budget-store";
import type { DebtInput } from "@/lib/budget/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listDebts();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les dettes", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DebtInput;
    const item = await createDebt(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer la dette", error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createRevenue, listRevenues } from "@/lib/budget/budget-store";
import type { RevenueInput } from "@/lib/budget/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listRevenues();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les revenus", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RevenueInput;
    const item = await createRevenue(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer le revenu", error);
  }
}

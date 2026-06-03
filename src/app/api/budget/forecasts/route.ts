import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { buildForecast } from "@/lib/budget/budget-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const forecast = await buildForecast(31);
    return NextResponse.json({ forecast });
  } catch (error) {
    return jsonError("Impossible de calculer les prévisions", error);
  }
}

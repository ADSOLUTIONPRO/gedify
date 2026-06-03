import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { buildOverview } from "@/lib/budget/budget-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overview = await buildOverview();
    return NextResponse.json({ overview });
  } catch (error) {
    return jsonError("Impossible de calculer le budget", error);
  }
}

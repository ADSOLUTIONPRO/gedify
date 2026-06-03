import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { suggestCorrection } from "@/lib/ai/correction-memory-store";
import type { DetectedInfoKind } from "@/lib/ai/detected-info-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const fieldKind = request.nextUrl.searchParams.get("fieldKind") as
      | DetectedInfoKind
      | null;
    const value = request.nextUrl.searchParams.get("value");
    if (!fieldKind || !value) {
      return NextResponse.json(
        { error: "fieldKind et value requis." },
        { status: 400 },
      );
    }
    const suggestion = await suggestCorrection(fieldKind, value);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return jsonError("Impossible de calculer une suggestion", error);
  }
}

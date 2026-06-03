import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  listCorrectionMemory,
  recordCorrection,
} from "@/lib/ai/correction-memory-store";
import type { CorrectionMemoryInput } from "@/lib/ai/correction-memory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listCorrectionMemory();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister la mémoire des corrections", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CorrectionMemoryInput;
    if (!body.fieldKind || !body.originalValue || !body.correctedValue) {
      return NextResponse.json(
        { error: "fieldKind, originalValue et correctedValue requis." },
        { status: 400 },
      );
    }
    const item = await recordCorrection(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible d'enregistrer la correction", error);
  }
}

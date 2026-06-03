import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteDetectedInfo,
  getDetectedInfo,
  updateDetectedInfo,
} from "@/lib/ai/detected-info-store";
import { recordCorrection } from "@/lib/ai/correction-memory-store";
import { requireAuth } from "@/lib/auth/require-auth";
import type { DetectedInfoInput } from "@/lib/ai/detected-info-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const item = await getDetectedInfo(id);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de récupérer l'information", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const previous = await getDetectedInfo(id);
    if (!previous) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const body = (await request.json()) as DetectedInfoInput;
    const item = await updateDetectedInfo(id, body);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    // If the user changed the value, record a correction memory entry.
    if (body.value !== undefined && body.value !== previous.value) {
      try {
        await recordCorrection({
          fieldKind: previous.kind,
          originalValue: previous.value,
          correctedValue: body.value,
          payload: {
            correspondentId: item.correspondentId,
            categoryId: item.categoryId,
            financialItemId: item.financialItemId,
          },
          context: {
            documentKind: previous.kind,
            correspondentHint: previous.correspondentName ?? undefined,
          },
          documentId: previous.sourceDocumentId,
          correspondentId: previous.correspondentId,
          confidence: previous.confidence,
        });
      } catch {
        // best effort
      }
    }
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de modifier l'information", error);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await ctx.params;
    const ok = await deleteDetectedInfo(id);
    if (!ok) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    return jsonError("Impossible de supprimer l'information", error);
  }
}

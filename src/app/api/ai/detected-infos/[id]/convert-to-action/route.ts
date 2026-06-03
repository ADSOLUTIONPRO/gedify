import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getDetectedInfo,
  updateDetectedInfo,
} from "@/lib/ai/detected-info-store";
import { createAction } from "@/lib/actions/action-store";
import type { ActionItemInput, ActionType } from "@/lib/actions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  type?: ActionType;
  title?: string;
  dueDate?: string;
  overrides?: Partial<ActionItemInput>;
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const info = await getDetectedInfo(id);
    if (!info) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Body;
    const dueDate = body.dueDate ?? info.dateValue ?? null;

    const action = await createAction({
      title: body.title ?? `${info.label} : ${info.value}`,
      type: body.type ?? (info.kind === "due_date" ? "to-pay" : "to-verify"),
      priority: "normal",
      dueDate,
      documentIds: info.sourceDocumentId ? [info.sourceDocumentId] : [],
      correspondentId: info.correspondentId,
      amount: info.amount,
      currency: info.currency,
      createdFrom: "ai",
      aiAnalysisId: info.sourceAnalysisId,
      aiConfidence: info.confidence,
      ...(body.overrides ?? {}),
    });

    const updatedInfo = await updateDetectedInfo(id, {
      status: "converted_to_action",
      actionId: action.id,
    });

    return NextResponse.json({ action, info: updatedInfo });
  } catch (error) {
    return jsonError("Conversion vers action impossible", error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createAction } from "@/lib/actions/action-store";
import { getAnalysis, getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import type { ActionType } from "@/lib/actions/types";
import type { AIRecommendedActionType } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_MAP: Record<AIRecommendedActionType, ActionType> = {
  pay: "to-pay",
  reply: "to-reply",
  forward: "to-forward",
  verify: "to-verify",
  classify: "to-classify",
  "follow-up": "to-follow-up",
  sign: "to-sign",
  send: "to-send",
  keep: "to-keep",
  archive: "to-archive",
  call: "to-call",
  prepare: "to-prepare",
  declare: "to-declare",
  contest: "to-contest",
};

type Body = {
  documentId?: number;
  analysisId?: string;
  recommendedActionIds?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const analysis = body.analysisId
      ? await getAnalysis(body.analysisId)
      : body.documentId
        ? await getLatestAnalysisForDocument(body.documentId)
        : null;
    if (!analysis) {
      return NextResponse.json({ error: "Aucune analyse IA disponible pour ce document." }, { status: 404 });
    }

    const selectedIds = body.recommendedActionIds ?? analysis.recommendedActions.map((a) => a.id);
    const created = [];
    for (const recommended of analysis.recommendedActions) {
      if (!selectedIds.includes(recommended.id)) continue;
      const item = await createAction({
        title: recommended.title,
        description: recommended.description ?? "",
        type: TYPE_MAP[recommended.type],
        priority: recommended.priority ?? "normal",
        dueDate: recommended.dueDate ?? null,
        amount: recommended.amount ?? null,
        documentIds: [analysis.documentId],
        createdFrom: "ai",
        aiAnalysisId: analysis.id,
        aiConfidence: analysis.confidence,
      });
      created.push(item);
    }

    return NextResponse.json({ created });
  } catch (error) {
    return jsonError("Impossible de créer les actions depuis l'analyse", error);
  }
}

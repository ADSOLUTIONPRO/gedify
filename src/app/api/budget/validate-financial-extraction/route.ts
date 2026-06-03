import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAnalysis } from "@/lib/ai/ai-analysis-store";
import { mapImpactToCandidate } from "@/lib/budget/financial-extraction-mapper";
import {
  createFinancialItem,
  listFinancialItems,
  updateFinancialItem,
} from "@/lib/budget/financial-item-store";
import type { FinancialItemInput } from "@/lib/budget/financial-item-types";
import { getPaperlessPublicUrl } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  analysisId: string;
  impactIndex?: number;
  overrides?: FinancialItemInput;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.analysisId) {
      return NextResponse.json({ error: "analysisId requis." }, { status: 400 });
    }
    const analysis = await getAnalysis(body.analysisId);
    if (!analysis) {
      return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
    }
    const impact = analysis.financialImpact[body.impactIndex ?? 0];
    if (!impact) {
      return NextResponse.json(
        { error: "Aucune extraction financière à cet index." },
        { status: 404 },
      );
    }

    const candidate = mapImpactToCandidate(analysis, impact, {
      paperlessBaseUrl: getPaperlessPublicUrl(),
    });

    const merged: FinancialItemInput = {
      ...candidate,
      ...(body.overrides ?? {}),
      validationStatus: "validated",
      status: body.overrides?.status ?? "validated",
      validatedAt: new Date().toISOString(),
    };

    // Replace an existing pending suggestion for the same analysis+impactIndex if any.
    const existing = await listFinancialItems({
      analysisId: analysis.id,
      validationStatus: "pending",
    });
    const reused = existing.find((entry) => entry.amount === impact.amount);
    if (reused) {
      const updated = await updateFinancialItem(reused.id, merged);
      return NextResponse.json({ item: updated, replaced: true });
    }

    const item = await createFinancialItem(merged);
    return NextResponse.json({ item, replaced: false }, { status: 201 });
  } catch (error) {
    return jsonError("Validation impossible", error);
  }
}

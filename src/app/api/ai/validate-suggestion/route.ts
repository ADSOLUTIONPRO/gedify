import { NextResponse, type NextRequest } from "next/server";
import { paperlessProxyError } from "@/lib/api-utils";
import { getAnalysis, upsertAnalysis } from "@/lib/ai/ai-analysis-store";
import { updateDocument } from "@/lib/paperless";
import { ensureTaxonomyByName } from "@/lib/engine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  analysisId: string;
  applyClassification?: boolean;
  /** Outrepasse les garde-fous (warnings / autoApplyEligible) — réservé à
   *  l'application manuelle après que l'utilisateur a explicitement validé
   *  les avertissements depuis l'UI. */
  forceApply?: boolean;
  correspondentId?: number | null;
  documentTypeId?: number | null;
  tagIds?: number[];
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

    // Garde-fou : refuser toute application automatique si l'analyse contient
    // des warnings ou si autoApplyEligible n'est pas explicitement true.
    // L'utilisateur peut outrepasser via forceApply=true (revue manuelle).
    if (body.applyClassification && !body.forceApply) {
      const warnings = analysis.warnings ?? [];
      if (warnings.length > 0) {
        const isMockFallback = analysis.provider?.includes("fallback-mock");
        const userMessage = isMockFallback
          ? "Cette analyse provient du mock de secours (le provider IA a échoué). Relancez une ré-analyse avant d'appliquer."
          : "L'analyse contient des avertissements. Examinez-les puis renvoyez avec forceApply=true si vous confirmez.";
        return NextResponse.json(
          { error: "warnings_present", message: userMessage, warnings },
          { status: 422 },
        );
      }
      if (analysis.autoApplyEligible === false) {
        return NextResponse.json(
          {
            error: "auto_apply_disabled",
            message:
              "Application refusée : autoApplyEligible=false. Validez manuellement le classement depuis la fiche IA.",
          },
          { status: 422 },
        );
      }
    }

    let documentUpdate: { correspondent?: number | null; document_type?: number | null; tags?: number[] } | null = null;
    // Entités réellement persistées (création par NOM si l'IA suggère une
    // nouvelle valeur sans id → plus jamais « MEIJE/Psychiatre » perdus).
    let appliedCorrespondentId: number | null | undefined = body.correspondentId;
    let appliedDocumentTypeId: number | null | undefined = body.documentTypeId;
    let appliedTagIds: number[] | undefined;

    if (body.applyClassification) {
      // Correspondant : id fourni, sinon find-or-create depuis le nom suggéré.
      if (appliedCorrespondentId == null && analysis.suggestedCorrespondentName) {
        const c = await ensureTaxonomyByName("correspondents", analysis.suggestedCorrespondentName);
        if (c) appliedCorrespondentId = Number(c.entity.id);
      }
      // Type : idem.
      if (appliedDocumentTypeId == null && analysis.suggestedDocumentTypeName) {
        const t = await ensureTaxonomyByName("document_types", analysis.suggestedDocumentTypeName);
        if (t) appliedDocumentTypeId = Number(t.entity.id);
      }
      // Tags : union des ids fournis + find-or-create de chaque nom suggéré.
      const tagIds = new Set<number>(
        Array.isArray(body.tagIds) ? body.tagIds : (analysis.suggestedTagIds ?? []),
      );
      for (const name of analysis.suggestedTagNames ?? []) {
        const tg = await ensureTaxonomyByName("tags", name);
        if (tg) tagIds.add(Number(tg.entity.id));
      }
      appliedTagIds = [...tagIds];

      // Association atomique côté document (après création des entités → si
      // l'update échoue, les entités créées restent, rien n'est perdu).
      documentUpdate = {};
      if (appliedCorrespondentId !== undefined) documentUpdate.correspondent = appliedCorrespondentId;
      if (appliedDocumentTypeId !== undefined) documentUpdate.document_type = appliedDocumentTypeId;
      documentUpdate.tags = appliedTagIds;
      await updateDocument(analysis.documentId, documentUpdate);
    }

    const updated = await upsertAnalysis({
      ...analysis,
      id: analysis.id,
      status: documentUpdate ? "applied" : "validated",
      suggestedCorrespondentId: appliedCorrespondentId ?? analysis.suggestedCorrespondentId,
      suggestedDocumentTypeId: appliedDocumentTypeId ?? analysis.suggestedDocumentTypeId,
      suggestedTagIds: appliedTagIds ?? analysis.suggestedTagIds,
    });

    return NextResponse.json({ analysis: updated });
  } catch (error) {
    return paperlessProxyError("Validation IA impossible", error);
  }
}

import "server-only";

import { computeDocumentFingerprint, matchBestTemplate } from "./document-fingerprint";
import { listActiveLearnedTemplates } from "./learned-templates-store";
import type { TemplateMatch } from "./learned-templates-types";
import type { AIAnalysisInput } from "./types";
import type { PaperlessDocument } from "@/lib/paperless-types";

/** Cherche le meilleur modèle appris correspondant au document. */
export async function findTemplateMatch(document: PaperlessDocument, ocrText: string): Promise<TemplateMatch | null> {
  const templates = await listActiveLearnedTemplates();
  if (templates.length === 0) return null;
  const fp = computeDocumentFingerprint(document, ocrText);
  return matchBestTemplate(fp, templates);
}

/**
 * Champs de classement à superposer sur une analyse (extraction locale) quand
 * un modèle appris correspond fortement : le modèle fournit le CLASSEMENT
 * (type/correspondant/tags/dossier), l'extraction fournit dates/montants.
 */
export function templateClassificationOverride(match: TemplateMatch): AIAnalysisInput {
  const t = match.template;
  return {
    suggestedDocumentTypeName: t.documentType,
    suggestedCorrespondentName: t.primaryCorrespondent,
    secondaryCorrespondentNames: t.secondaryCorrespondents,
    suggestedTagNames: t.tags,
    suggestedFolderName: t.folder,
    detectedDocumentKind: t.documentType ?? undefined,
    confidence: "high",
    globalConfidenceScore: match.score,
    classificationSource: "learned_template",
    matchedTemplateId: t.id,
    matchedTemplateLabel: t.label,
    similarityScore: match.score,
    needsReview: false,
    warnings: [],
    autoApplyEligible: true,
  };
}

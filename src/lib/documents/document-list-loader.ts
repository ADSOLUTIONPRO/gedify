import "server-only";

import { formatAmount, type DocumentStatus, type DocumentStatusesVM, type DocumentVM } from "@/components/documents/types";
import { resolveFileTypeLabel } from "@/components/ui/file-type-badge";
import { getTitleOverridesMap } from "@/lib/documents/document-title-store";
import { pickLatestAnalysis, resolveTitlesForDocuments } from "@/lib/documents/document-title-utils";
import {
  getDocumentSubtitle,
  getNameById,
  getTagsForDocument,
  isDocumentArchived,
  isDocumentToProcess,
  isDocumentWithAsn,
} from "@/lib/document-utils";
import { formatDate } from "@/lib/format";
import { firstParam, numberParam } from "@/lib/page-params";
import type { AIAnalysis } from "@/lib/ai/types";
import type { FinancialItem } from "@/lib/budget/financial-item-types";
import type { PaperlessCorrespondent, PaperlessDocument, PaperlessDocumentType, PaperlessTag } from "@/lib/paperless-types";

const DUE_DATE_LABEL = /(éch[ée]ance|limite|paiement|expir|due)/i;

/** Construit les paramètres Paperless d'une liste de documents depuis les filtres. */
export function buildDocumentApiParams(
  params: Record<string, string | string[] | undefined>,
  tab: string,
  pageSize: number,
): Record<string, string | number> {
  const apiParams: Record<string, string | number> = {
    page: numberParam(params, "page", 1),
    page_size: pageSize,
  };
  const query = firstParam(params, "query");
  const correspondent = firstParam(params, "correspondent");
  const documentType = firstParam(params, "document_type");
  const tag = firstParam(params, "tag");
  const createdFrom = firstParam(params, "created_from");
  const addedFrom = firstParam(params, "added_from");
  const asn = firstParam(params, "asn");
  const ordering = tab === "recents" ? "-added" : firstParam(params, "ordering", "-added");

  if (query) apiParams.query = query;
  if (correspondent) apiParams.correspondent__id = correspondent;
  if (documentType) apiParams.document_type__id = documentType;
  if (tag) apiParams.tags__id__all = tag;
  if (createdFrom) apiParams.created__gte = createdFrom;
  if (addedFrom) apiParams.added__date__gte = addedFrom;
  // « Récents » = ajoutés dans GEDify au cours des dernières 48 h (date d'ajout,
  // jamais la date métier/OCR). Filtre serveur réel (date d'ajout ≥ J-2).
  if (tab === "recents" && !addedFrom) {
    apiParams.added__date__gte = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  if (asn === "with") apiParams.archive_serial_number__isnull = "false";
  if (asn === "without") apiParams.archive_serial_number__isnull = "true";
  if (ordering) apiParams.ordering = ordering;
  return apiParams;
}

export function statusFor(document: PaperlessDocument, tags: Parameters<typeof getTagsForDocument>[0]): DocumentStatus {
  if (isDocumentToProcess(document, tags)) return "todo";
  if (isDocumentArchived(document)) return "archived";
  return "validated";
}

/** Confiance IA en % : score numérique si présent, sinon repli qualitatif. */
export function confidencePctOf(analysis: AIAnalysis | null): number | null {
  if (!analysis) return null;
  if (typeof analysis.globalConfidenceScore === "number") return Math.round(analysis.globalConfidenceScore * 100);
  if (analysis.confidence === "high") return 90;
  if (analysis.confidence === "medium") return 60;
  if (analysis.confidence === "low") return 30;
  return null;
}

/** Vrai si l'analyse demande une vérification (auto-apply refusé / warnings). */
export function needsReviewOf(analysis: AIAnalysis | null): boolean {
  if (!analysis) return false;
  if (analysis.status === "applied" || analysis.status === "validated") return false;
  return (
    analysis.needsReview === true ||
    (analysis.warnings?.length ?? 0) > 0 ||
    analysis.autoApplyEligible === false
  );
}

/** Statuts dérivés (OCR / IA / budget / classement) pour les badges de vignette. */
export function deriveStatuses(
  document: PaperlessDocument,
  analysis: AIAnalysis | null,
  financial: { validationStatus: string } | null,
): DocumentStatusesVM {
  const contentLen = (document.content ?? "").trim().length;
  const ocr: DocumentStatusesVM["ocr"] =
    contentLen > 50 ? "done" : contentLen > 0 ? "low" : analysis ? "done" : "pending";

  let ai: DocumentStatusesVM["ai"] = "none";
  if (analysis) {
    if (analysis.enrichmentStatus === "error" || analysis.enrichmentStatus === "timeout") ai = "error";
    else if (needsReviewOf(analysis)) ai = "review";
    else ai = "done";
  }

  const budget: DocumentStatusesVM["budget"] = financial
    ? financial.validationStatus === "needs_review" ? "review" : "created"
    : "none";

  const classified = document.correspondent != null && document.document_type != null;
  const src = analysis?.classificationSource ?? null;
  const learned: DocumentStatusesVM["learned"] = src === "learned_template" ? "template" : src === "similar" ? "similar" : null;

  return {
    ocr,
    ai,
    confidencePct: confidencePctOf(analysis),
    budget,
    classified,
    learned,
    matchedLabel: analysis?.matchedTemplateLabel ?? null,
    thumbnailError: (document as { thumbnail_error?: string | null }).thumbnail_error ?? null,
  };
}

/** Prédicat de filtrage par état dérivé (filtre « État »). */
export function matchesEtat(s: DocumentStatusesVM, etat: string): boolean {
  switch (etat) {
    case "ia_done": return s.ai === "done";
    case "ia_review": return s.ai === "review";
    case "ia_error": return s.ai === "error";
    case "ia_none": return s.ai === "none";
    case "ocr_done": return s.ocr === "done";
    case "ocr_error": return s.ocr === "pending";
    case "ocr_low": return s.ocr === "low";
    case "classified": return s.classified;
    case "unclassified": return !s.classified;
    case "budget_created": return s.budget === "created";
    case "budget_review": return s.budget === "review";
    default: return true;
  }
}

export type DocumentVMDeps = {
  correspondents: PaperlessCorrespondent[];
  types: PaperlessDocumentType[];
  tags: PaperlessTag[];
  analyses: AIAnalysis[];
  financialItems: FinancialItem[];
  paperlessUrl: string | null;
};

/**
 * Construit les `DocumentVM[]` (titre métier, IA, statuts dérivés, badges…)
 * à partir des documents Paperless bruts + dépendances. Réutilisé par l'espace
 * Documents ET la vue dossier de l'espace Organiser.
 */
export async function buildDocumentVMs(documents: PaperlessDocument[], deps: DocumentVMDeps): Promise<DocumentVM[]> {
  const { correspondents, types, tags, analyses, financialItems, paperlessUrl } = deps;

  const financialByDocId = new Map<number, { validationStatus: string }>();
  for (const it of financialItems) {
    if (it.sourceDocumentId != null && !financialByDocId.has(it.sourceDocumentId)) {
      financialByDocId.set(it.sourceDocumentId, { validationStatus: it.validationStatus });
    }
  }

  const documentIds = documents.map((d) => Number(d.id));
  const titleOverrides = await getTitleOverridesMap(documentIds);
  const analysesByDocId = new Map(documentIds.map((id) => [id, pickLatestAnalysis(analyses, id)]));
  const titles = resolveTitlesForDocuments(documents, titleOverrides, analysesByDocId);

  return documents.map((doc) => {
    const id = Number(doc.id);
    const resolved = titles.get(id);
    const analysis = analysesByDocId.get(id) ?? null;
    const correspondentName = doc.correspondent__name ?? getNameById(correspondents, doc.correspondent) ?? null;
    const typeName = doc.document_type__name ?? getNameById(types, doc.document_type) ?? null;
    const amount = analysis?.detectedAmounts?.[0] ?? null;
    const dueDate = analysis?.detectedDates?.find((d) => DUE_DATE_LABEL.test(d.label)) ?? null;

    return {
      id,
      displayTitle: resolved?.displayTitle ?? doc.title ?? `Document #${id}`,
      fileName: resolved?.originalFilename ?? null,
      subtitle: getDocumentSubtitle(doc, correspondents, types),
      correspondentName: correspondentName || null,
      correspondentId: doc.correspondent ?? null,
      typeName: typeName || null,
      typeId: doc.document_type ?? null,
      tagIds: Array.isArray(doc.tags) ? (doc.tags as number[]) : [],
      dateLabel: formatDate(doc.created),
      createdISO: doc.created ?? doc.created_date ?? null,
      titleRaw: doc.title ?? null,
      sourceLabel: resolveFileTypeLabel(doc.original_file_name ?? doc.original_filename ?? doc.filename ?? null, doc.mime_type ?? null),
      added: doc.added ?? null,
      tags: getTagsForDocument(tags, doc).map((t) => ({ id: t.id, name: t.name, color: t.color, text_color: t.text_color })),
      status: statusFor(doc, tags),
      asn: isDocumentWithAsn(doc) ? String(doc.archive_serial_number) : null,
      amount: amount ? { label: amount.label, amount: amount.amount, currency: amount.currency } : null,
      due: dueDate ? { label: dueDate.label, iso: dueDate.iso, formatted: formatDate(dueDate.iso) } : null,
      thumbUrl: `/api/paperless/documents/${id}/thumb`,
      detailHref: `/documents/${id}`,
      downloadUrl: `/api/paperless/documents/${id}/download`,
      paperlessUrl: paperlessUrl ? `${paperlessUrl}/documents/${id}` : null,
      mimeType: doc.mime_type ?? null,
      ai: analysis
        ? {
            summary: analysis.summary ?? "",
            explanation: analysis.plainLanguageExplanation ?? "",
            kind: analysis.detectedDocumentKind ?? null,
            correspondentName: analysis.suggestedCorrespondentName ?? null,
            secondaryCorrespondentNames: analysis.secondaryCorrespondentNames ?? [],
            typeName: analysis.suggestedDocumentTypeName ?? null,
            tagNames: analysis.suggestedTagNames ?? [],
            dates: (analysis.detectedDates ?? []).map((d) => ({ label: d.label, iso: d.iso, formatted: formatDate(d.iso) })),
            amounts: (analysis.detectedAmounts ?? []).map((a) => ({ label: a.label, formatted: formatAmount(a.amount, a.currency), amount: a.amount, currency: a.currency })),
            actions: (analysis.recommendedActions ?? []).map((a) => ({ type: a.type, title: a.title })),
            confidence: analysis.confidence ?? null,
            confidencePct: confidencePctOf(analysis),
            needsReview: needsReviewOf(analysis),
            appliedFields: analysis.appliedFields ?? [],
            source: analysis.classificationSource ?? null,
            matchedTemplateLabel: analysis.matchedTemplateLabel ?? null,
            similarityPct: analysis.similarityScore != null ? Math.round(analysis.similarityScore * 100) : null,
            analyzedAt: analysis.updatedAt ?? analysis.createdAt ?? null,
          }
        : null,
      statuses: deriveStatuses(doc, analysis, financialByDocId.get(id) ?? null),
    };
  });
}

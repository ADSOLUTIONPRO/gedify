import "server-only";

import { buildUsefulOcrContext } from "@/lib/ai/document-context-extractor";
import { classifyDocumentFromOCR, getAllMatchingClassifications } from "@/lib/ai/rules/document-classification-engine";
import { extractDocumentFields } from "@/lib/ai/rules/field-extractors";
import { normalizeTags } from "@/lib/ai/rules/tag-normalizer";
import { getTagDiff } from "@/lib/ai/rules/rule-conflict-resolver";
import type { PaperlessDocument } from "@/lib/paperless-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OcrStats = {
  totalChars: number;
  totalLines: number;
  usefulChars: number;
  hasNumbers: boolean;
  hasDates: boolean;
  hasAmounts: boolean;
  hasSiret: boolean;
  hasIban: boolean;
};

export type LocalRuleAnalysis = {
  primaryKind: string | null;
  documentTypeName: string | null;
  confidence: number;
  matchedRuleIds: string[];
  allMatches: Array<{ kind: string; priority: number; excluded: boolean }>;
  suggestedCorrespondent: string | null;
  suggestedTags: string[];
  extractedFields: Record<string, unknown>;
  tagsToAdd: string[];
  tagsToRemove: string[];
};

export type StructuredDocumentContext = {
  documentId: number;
  title: string | null;
  filename: string | null;
  paperlessMetadata: {
    correspondent: string | null;
    documentType: string | null;
    tags: string[];
    created: string | null;
    added: string | null;
  };
  ocrStats: OcrStats;
  /** Trimmed OCR text — keyword-focused, max AI_OCR_MAX_CHARS */
  usefulOcrText: string;
  /** Lines containing financial amounts */
  amountLines: string[];
  /** Lines containing dates */
  dateLines: string[];
  /** Lines containing key identifiers (SIRET, IBAN, etc.) */
  identifierLines: string[];
  /** Result of local rule-based classification */
  localRuleAnalysis: LocalRuleAnalysis;
  /** Existing Paperless taxonomies (for context, not for overriding) */
  existingTaxonomies: {
    correspondentNames: string[];
    documentTypeNames: string[];
    tagNames: string[];
  };
};

// ---------------------------------------------------------------------------
// OCR stats
// ---------------------------------------------------------------------------

function computeOcrStats(ocr: string): OcrStats {
  const lines = ocr.split("\n");
  return {
    totalChars: ocr.length,
    totalLines: lines.length,
    usefulChars: buildUsefulOcrContext(ocr).length,
    hasNumbers: /\d{4,}/.test(ocr),
    hasDates: /\d{1,2}\/\d{2}\/\d{4}/.test(ocr),
    hasAmounts: /\d{1,3}(?:[,.\s]\d{3})*[,.]\d{2}\s*[€$]/.test(ocr),
    hasSiret: /\bSIRET\b/i.test(ocr),
    hasIban: /\bIBAN\b/i.test(ocr),
  };
}

// ---------------------------------------------------------------------------
// Key line extractors
// ---------------------------------------------------------------------------

const AMOUNT_KEYWORDS = /montant|total|net|brut|tva|solde|[àa]\s+payer|[eé]ch[eé]ance|cotisation|salaire/i;
const DATE_KEYWORDS = /date|p[eé]riode|[eé]ch[eé]ance|naissance|cr[eé]ation|[eé]mission|expiration|validit[eé]/i;
const ID_KEYWORDS = /siret|siren|iban|bic|rib|n[°o]\s*(client|facture|contrat|dossier|allocataire)|r[eé]f[eé]rence|num[eé]ro/i;

function extractKeyLines(ocr: string, keywords: RegExp, maxLines = 15): string[] {
  return ocr
    .split("\n")
    .filter((line) => keywords.test(line) && line.trim().length > 3)
    .slice(0, maxLines)
    .map((l) => l.trim());
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build a structured context from a Paperless document.
 * This is the single object passed to the LLM instead of raw OCR.
 *
 * Design goal: the LLM receives LESS text but MORE signal:
 *  1. Pre-classified document type and extracted fields.
 *  2. Only keyword-relevant OCR sections (not the full text).
 *  3. Existing Paperless metadata to avoid overwriting correct data.
 */
export function buildStructuredDocumentContext(
  document: PaperlessDocument,
  options: {
    existingCorrespondentNames?: string[];
    existingDocumentTypeNames?: string[];
    existingTagNames?: string[];
  } = {}
): StructuredDocumentContext {
  const ocr = (document.content ?? "").normalize("NFC");
  const title = document.title ?? null;
  const filename =
    document.original_file_name ?? document.original_filename ?? document.filename ?? null;

  // ── Classification ──────────────────────────────────────────────────────
  const primaryMatch = classifyDocumentFromOCR(ocr, title);
  const allMatches = getAllMatchingClassifications(ocr);

  // ── Field extraction ────────────────────────────────────────────────────
  const extractedFields: Record<string, unknown> = {};
  if (primaryMatch) {
    try {
      const fields = extractDocumentFields(primaryMatch.kind, ocr);
      if (fields.kind !== "other") {
        Object.assign(extractedFields, fields);
      }
    } catch {
      // Field extraction failure is non-fatal
    }
  }

  // ── Tag suggestions ─────────────────────────────────────────────────────
  const baseTags = primaryMatch?.tags ?? [];
  const diff = primaryMatch ? getTagDiff(primaryMatch.kind, []) : { add: [], remove: [] };
  const suggestedTags = normalizeTags([...baseTags, ...diff.add]);

  const localRuleAnalysis: LocalRuleAnalysis = {
    primaryKind: primaryMatch?.kind ?? null,
    documentTypeName: primaryMatch?.documentTypeName ?? null,
    confidence: primaryMatch
      ? Math.min(0.5 + primaryMatch.matchedMarkers.length * 0.1, 0.95)
      : 0,
    matchedRuleIds: primaryMatch ? [primaryMatch.kind] : [],
    allMatches: allMatches.map((m) => ({ kind: m.kind, priority: m.priority, excluded: m.excluded })),
    suggestedCorrespondent: primaryMatch?.correspondentHint ?? null,
    suggestedTags,
    extractedFields,
    tagsToAdd: diff.add,
    tagsToRemove: diff.remove,
  };

  return {
    documentId: document.id ?? 0,
    title,
    filename,
    paperlessMetadata: {
      correspondent: document.correspondent__name ?? null,
      documentType: document.document_type__name ?? null,
      tags: [],
      created: document.created ?? null,
      added: document.added ?? null,
    },
    ocrStats: computeOcrStats(ocr),
    usefulOcrText: buildUsefulOcrContext(ocr),
    amountLines: extractKeyLines(ocr, AMOUNT_KEYWORDS),
    dateLines: extractKeyLines(ocr, DATE_KEYWORDS),
    identifierLines: extractKeyLines(ocr, ID_KEYWORDS, 10),
    localRuleAnalysis,
    existingTaxonomies: {
      correspondentNames: options.existingCorrespondentNames ?? [],
      documentTypeNames: options.existingDocumentTypeNames ?? [],
      tagNames: options.existingTagNames ?? [],
    },
  };
}

/**
 * Serialize the context into a compact string for LLM consumption.
 * Includes only what the model needs, not all metadata.
 */
export function serializeContextForLLM(ctx: StructuredDocumentContext): string {
  const la = ctx.localRuleAnalysis;
  const sections: string[] = [];

  sections.push(`## Document`);
  sections.push(`Titre : ${ctx.title ?? "(sans titre)"}`);
  if (ctx.filename) sections.push(`Fichier : ${ctx.filename}`);
  if (ctx.paperlessMetadata.created) sections.push(`Date document : ${ctx.paperlessMetadata.created}`);
  if (ctx.paperlessMetadata.correspondent) {
    sections.push(`Correspondant Paperless existant : ${ctx.paperlessMetadata.correspondent}`);
  }

  if (la.primaryKind) {
    sections.push(`\n## Pré-classification locale`);
    sections.push(`Type détecté : ${la.documentTypeName} (confiance : ${Math.round(la.confidence * 100)}%)`);
    if (la.suggestedCorrespondent) sections.push(`Correspondant probable : ${la.suggestedCorrespondent}`);
    if (la.suggestedTags.length > 0) sections.push(`Tags suggérés : ${la.suggestedTags.join(", ")}`);
    if (la.allMatches.length > 1) {
      const others = la.allMatches.filter((m) => m.kind !== la.primaryKind && !m.excluded).slice(0, 3);
      if (others.length > 0) {
        sections.push(`Autres types possibles : ${others.map((m) => m.kind).join(", ")}`);
      }
    }
  }

  if (ctx.amountLines.length > 0) {
    sections.push(`\n## Lignes montants`);
    sections.push(ctx.amountLines.slice(0, 10).join("\n"));
  }

  if (ctx.dateLines.length > 0) {
    sections.push(`\n## Lignes dates`);
    sections.push(ctx.dateLines.slice(0, 8).join("\n"));
  }

  if (ctx.identifierLines.length > 0) {
    sections.push(`\n## Références / identifiants`);
    sections.push(ctx.identifierLines.slice(0, 8).join("\n"));
  }

  sections.push(`\n## Texte OCR (sections pertinentes)`);
  sections.push(ctx.usefulOcrText);

  return sections.join("\n");
}

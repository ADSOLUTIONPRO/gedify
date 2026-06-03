import "server-only";

import type { AIAnalysis, AIConfidence } from "@/lib/ai/types";
import type { PaperlessCorrespondent } from "@/lib/paperless-types";

export type CorrespondentSuggestionStatus =
  | "existing_match"
  | "possible_match"
  | "new_correspondent"
  | "uncertain";

export type CorrespondentMatch = { id: number; name: string };

export type CorrespondentSuggestion = {
  documentId: number;
  detectedName: string | null;
  normalizedName: string | null;
  status: CorrespondentSuggestionStatus;
  confidence: AIConfidence | null;
  /** Correspondant existant correspondant exactement (nom normalisé). */
  existingMatch: CorrespondentMatch | null;
  /** Correspondants proches (sous-chaîne / inclusion). */
  closeMatches: CorrespondentMatch[];
  /** Preuves OCR (marqueurs des règles déterministes ayant matché). */
  evidence: string[];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Construit une suggestion de correspondant à partir d'une analyse IA et de la
 * liste des correspondants Paperless existants. Purement déductif (aucune
 * mutation) : classe en existing_match / possible_match / new_correspondent /
 * uncertain.
 */
export function buildCorrespondentSuggestion(
  analysis: AIAnalysis,
  correspondents: PaperlessCorrespondent[]
): CorrespondentSuggestion {
  const detectedName = analysis.suggestedCorrespondentName?.trim() || null;
  const evidence = (analysis.ruleMatches ?? []).flatMap((r) => r.markersMatched ?? []).slice(0, 8);

  if (!detectedName) {
    return {
      documentId: analysis.documentId,
      detectedName: null,
      normalizedName: null,
      status: "uncertain",
      confidence: analysis.confidence ?? null,
      existingMatch: null,
      closeMatches: [],
      evidence,
    };
  }

  const norm = normalize(detectedName);
  let existingMatch: CorrespondentMatch | null = null;
  const closeMatches: CorrespondentMatch[] = [];

  for (const c of correspondents) {
    const cn = normalize(c.name);
    if (!cn) continue;
    if (cn === norm) {
      existingMatch = { id: Number(c.id), name: c.name };
    } else if (cn.includes(norm) || norm.includes(cn)) {
      closeMatches.push({ id: Number(c.id), name: c.name });
    }
  }

  const status: CorrespondentSuggestionStatus = existingMatch
    ? "existing_match"
    : closeMatches.length > 0
    ? "possible_match"
    : "new_correspondent";

  return {
    documentId: analysis.documentId,
    detectedName,
    normalizedName: norm,
    status,
    confidence: analysis.confidence ?? null,
    existingMatch,
    closeMatches: closeMatches.slice(0, 5),
    evidence,
  };
}

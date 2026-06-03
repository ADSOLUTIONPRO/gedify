import "server-only";

import type { AIAnalysis } from "@/lib/ai/types";
import type { PaperlessCorrespondent, PaperlessDocumentType, PaperlessTag } from "@/lib/paperless-types";
import { buildCorrespondentSuggestion } from "@/lib/ai/correspondent-suggestions";

export type EntitySuggestionStatus =
  | "existing_match"
  | "possible_match"
  | "new_entity"
  | "uncertain";

export type EntityMatch = { id: number; name: string };

export type TagSuggestion = {
  suggestedName: string;
  normalizedName: string;
  status: EntitySuggestionStatus;
  existingMatch: EntityMatch | null;
  closeMatches: EntityMatch[];
};

export type DocumentTypeSuggestion = {
  suggestedName: string | null;
  normalizedName: string | null;
  status: EntitySuggestionStatus;
  existingMatch: EntityMatch | null;
  closeMatches: EntityMatch[];
};

export type AllEntitySuggestions = {
  documentId: number;
  correspondent: ReturnType<typeof buildCorrespondentSuggestion>;
  documentType: DocumentTypeSuggestion;
  tags: TagSuggestion[];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchEntities(
  suggestedName: string,
  entities: { id: number | string; name: string }[],
): { existingMatch: EntityMatch | null; closeMatches: EntityMatch[] } {
  const norm = normalize(suggestedName);
  let existingMatch: EntityMatch | null = null;
  const closeMatches: EntityMatch[] = [];

  for (const e of entities) {
    const en = normalize(e.name);
    if (!en) continue;
    if (en === norm) {
      existingMatch = { id: Number(e.id), name: e.name };
    } else if (en.includes(norm) || norm.includes(en)) {
      closeMatches.push({ id: Number(e.id), name: e.name });
    }
  }

  return { existingMatch, closeMatches: closeMatches.slice(0, 5) };
}

export function buildTagSuggestions(
  analysis: AIAnalysis,
  existingTags: PaperlessTag[],
): TagSuggestion[] {
  const suggestedNames = analysis.suggestedTagNames ?? [];
  return suggestedNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const { existingMatch, closeMatches } = matchEntities(name, existingTags);
      const status: EntitySuggestionStatus = existingMatch
        ? "existing_match"
        : closeMatches.length > 0
          ? "possible_match"
          : "new_entity";
      return {
        suggestedName: name,
        normalizedName: normalize(name),
        status,
        existingMatch,
        closeMatches,
      };
    });
}

export function buildDocumentTypeSuggestion(
  analysis: AIAnalysis,
  existingTypes: PaperlessDocumentType[],
): DocumentTypeSuggestion {
  const suggestedName = analysis.suggestedDocumentTypeName?.trim() || null;
  if (!suggestedName) {
    return {
      suggestedName: null,
      normalizedName: null,
      status: "uncertain",
      existingMatch: null,
      closeMatches: [],
    };
  }

  const { existingMatch, closeMatches } = matchEntities(suggestedName, existingTypes);
  const status: EntitySuggestionStatus = existingMatch
    ? "existing_match"
    : closeMatches.length > 0
      ? "possible_match"
      : "new_entity";

  return {
    suggestedName,
    normalizedName: normalize(suggestedName),
    status,
    existingMatch,
    closeMatches,
  };
}

export function buildAllEntitySuggestions(
  analysis: AIAnalysis,
  correspondents: PaperlessCorrespondent[],
  documentTypes: PaperlessDocumentType[],
  tags: PaperlessTag[],
): AllEntitySuggestions {
  return {
    documentId: analysis.documentId,
    correspondent: buildCorrespondentSuggestion(analysis, correspondents),
    documentType: buildDocumentTypeSuggestion(analysis, documentTypes),
    tags: buildTagSuggestions(analysis, tags),
  };
}

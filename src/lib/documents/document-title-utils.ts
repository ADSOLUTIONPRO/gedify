import type { AIAnalysis } from "@/lib/ai/types";
import type {
  DocumentDisplayMetadata,
  DocumentTitleOverride,
  DocumentTitleSource,
} from "@/lib/documents/document-title-types";
import type { PaperlessDocument } from "@/lib/paperless-types";

const FILENAME_TITLE_FALLBACK = /\.[a-z0-9]{2,5}$/i;
const UUID_LIKE = /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12,}\b/i;

function looksLikeTechnicalFilename(value: string): boolean {
  if (!value) return false;
  // Long hex/UUID-like strings ⇒ technical
  if (UUID_LIKE.test(value)) return true;
  // > 30 chars and includes 6+ digits in a row
  if (value.length > 30 && /\d{6,}/.test(value)) return true;
  // 3+ underscores or hyphens in a row
  if ((value.match(/[_-]/g) ?? []).length >= 4) return true;
  return false;
}

function humanizeFilename(filename: string): string {
  return filename
    .replace(FILENAME_TITLE_FALLBACK, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAcceptableTitle(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (looksLikeTechnicalFilename(trimmed)) return false;
  return trimmed.length >= 3;
}

export type DocumentTitleInput = {
  document: PaperlessDocument;
  override?: DocumentTitleOverride | null;
  aiSuggestedTitle?: string | null;
  aiTitleConfidence?: number | null;
};

export type ResolvedDocumentTitle = {
  displayTitle: string;
  source: DocumentTitleSource;
  confidence: number | null;
  editedByUser: boolean;
  originalFilename: string | null;
};

/**
 * Resolve the user-facing title for a document using priority:
 * 1. User-edited override
 * 2. AI suggested title (validated)
 * 3. Paperless title (if not a technical filename)
 * 4. Humanized filename
 * 5. `Document #id`
 */
export function getDocumentDisplayTitle(input: DocumentTitleInput): ResolvedDocumentTitle {
  const { document, override, aiSuggestedTitle, aiTitleConfidence } = input;
  const originalFilename =
    document.original_file_name ?? document.original_filename ?? document.filename ?? null;

  if (override && override.editedByUser) {
    return {
      displayTitle: override.displayTitle,
      source: "user",
      confidence: override.confidence,
      editedByUser: true,
      originalFilename,
    };
  }

  if (override && isAcceptableTitle(override.displayTitle)) {
    return {
      displayTitle: override.displayTitle,
      source: override.source,
      confidence: override.confidence,
      editedByUser: false,
      originalFilename,
    };
  }

  if (isAcceptableTitle(aiSuggestedTitle)) {
    return {
      displayTitle: aiSuggestedTitle.trim(),
      source: "ai",
      confidence: aiTitleConfidence ?? null,
      editedByUser: false,
      originalFilename,
    };
  }

  if (isAcceptableTitle(document.title)) {
    return {
      displayTitle: document.title.trim(),
      source: "paperless",
      confidence: null,
      editedByUser: false,
      originalFilename,
    };
  }

  if (originalFilename) {
    const humanized = humanizeFilename(originalFilename);
    if (isAcceptableTitle(humanized)) {
      return {
        displayTitle: humanized,
        source: "filename",
        confidence: null,
        editedByUser: false,
        originalFilename,
      };
    }
  }

  return {
    displayTitle: `Document #${document.id}`,
    source: "filename",
    confidence: null,
    editedByUser: false,
    originalFilename,
  };
}

/**
 * Pick the most relevant analysis for a document (latest one).
 */
export function pickLatestAnalysis(
  analyses: AIAnalysis[],
  documentId: number
): AIAnalysis | null {
  const matches = analyses
    .filter((a) => a.documentId === documentId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  return matches[0] ?? null;
}

/**
 * Resolve titles for a batch of documents. Caller passes in the overrides map
 * and a per-document AI analysis (or null). Returns a Map keyed by documentId.
 */
export function resolveTitlesForDocuments(
  documents: PaperlessDocument[],
  overrides: Map<number, DocumentTitleOverride>,
  analysesByDocumentId: Map<number, AIAnalysis | null>
): Map<number, ResolvedDocumentTitle> {
  const out = new Map<number, ResolvedDocumentTitle>();
  for (const doc of documents) {
    const id = Number(doc.id);
    const override = overrides.get(id) ?? null;
    const analysis = analysesByDocumentId.get(id) ?? null;
    out.set(
      id,
      getDocumentDisplayTitle({
        document: doc,
        override,
        aiSuggestedTitle: analysis?.suggestedTitle ?? null,
        aiTitleConfidence: analysis?.titleConfidence ?? null,
      })
    );
  }
  return out;
}

/**
 * Build the full display metadata for a single document.
 */
export function buildDisplayMetadata(input: {
  document: PaperlessDocument;
  override: DocumentTitleOverride | null;
  analysis: AIAnalysis | null;
}): DocumentDisplayMetadata {
  const resolved = getDocumentDisplayTitle({
    document: input.document,
    override: input.override,
    aiSuggestedTitle: input.analysis?.suggestedTitle ?? null,
    aiTitleConfidence: input.analysis?.titleConfidence ?? null,
  });

  return {
    documentId: Number(input.document.id),
    displayTitle: resolved.displayTitle,
    originalFilename: resolved.originalFilename,
    generatedTitle: input.analysis?.suggestedTitle ?? null,
    titleSource: resolved.source,
    titleConfidence: resolved.confidence,
    titleEditedByUser: resolved.editedByUser,
    titleEditedAt: input.override?.editedAt ?? null,
    createdAt: input.override?.editedAt ?? input.document.added ?? new Date().toISOString(),
    updatedAt: input.override?.editedAt ?? input.document.added ?? new Date().toISOString(),
  };
}

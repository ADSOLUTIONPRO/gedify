import type { DetectedInfoKind } from "./detected-info-types";

export type CorrectionMemoryContext = {
  /** Free-form context (e.g. document kind, source domain). */
  documentKind?: string;
  correspondentHint?: string;
  organizationName?: string;
};

export type CorrectionMemory = {
  id: string;
  fieldKind: DetectedInfoKind;
  /** Lowercase + trimmed normalization of the original AI value. */
  originalValue: string;
  /** Final value the user applied. */
  correctedValue: string;
  /** Optional structured payload (correspondent id, category id…). */
  payload: Record<string, unknown>;
  context: CorrectionMemoryContext;
  documentId: number | null;
  correspondentId: number | null;
  confidence: "low" | "medium" | "high" | null;
  /** Times this correction has been re-applied. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CorrectionMemoryInput = Partial<
  Omit<CorrectionMemory, "id" | "createdAt" | "updatedAt">
> & {
  fieldKind: DetectedInfoKind;
  originalValue: string;
  correctedValue: string;
};

export type CorrectionSuggestion = {
  memory: CorrectionMemory;
  match: "exact" | "fuzzy";
};

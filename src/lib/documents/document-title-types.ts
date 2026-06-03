export type DocumentTitleSource =
  | "user"
  | "ai"
  | "paperless"
  | "rule"
  | "imported"
  | "filename";

export type DocumentDisplayMetadata = {
  documentId: number;
  displayTitle: string;
  originalFilename: string | null;
  generatedTitle: string | null;
  titleSource: DocumentTitleSource;
  titleConfidence: number | null;
  titleEditedByUser: boolean;
  titleEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTitleOverride = {
  documentId: number;
  displayTitle: string;
  source: DocumentTitleSource;
  confidence: number | null;
  editedByUser: boolean;
  editedAt: string;
};

export type WriterDocumentStatus =
  | "draft"
  | "review"
  | "ready-to-send"
  | "sent-to-paperless"
  | "archived";

export type WriterLetterType =
  | "administratif"
  | "avocat"
  | "notaire"
  | "employeur"
  | "caf"
  | "cpam"
  | "assurance"
  | "libre";

export type WriterDocument = {
  id: string;
  title: string;
  letterType: WriterLetterType;
  templateId: string | null;
  recipient: string;
  recipientAddress: string;
  subject: string;
  reference: string;
  projectId: string | null;
  paperlessCorrespondent: number | null;
  paperlessDocumentType: number | null;
  paperlessTags: number[];
  fileName: string;
  fileSize: number;
  contentType: string;
  version: number;
  /** Set after sending to Paperless. */
  paperlessTaskId: string | null;
  paperlessDocumentId: number | null;
  status: WriterDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type WriterDocumentInput = Partial<
  Omit<
    WriterDocument,
    | "id"
    | "fileName"
    | "fileSize"
    | "contentType"
    | "version"
    | "paperlessTaskId"
    | "paperlessDocumentId"
    | "createdAt"
    | "updatedAt"
  >
>;

export type WriterTemplate = {
  id: string;
  name: string;
  description: string;
  letterType: WriterLetterType;
  variables: string[];
};

export type WriterSignature = {
  id: string;
  name: string;
  isDefault: boolean;
  fileName: string;
  contentType: string;
  width: number;
  height: number;
  createdAt: string;
};

export type WriterSignatureInput = Partial<
  Omit<WriterSignature, "id" | "fileName" | "contentType" | "createdAt">
> & {
  /** Base64 data URL (image/png or image/jpeg) — never persisted in clear text logs. */
  dataUrl?: string;
};

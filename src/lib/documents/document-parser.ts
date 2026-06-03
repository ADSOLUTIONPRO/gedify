import "server-only";

// ---------------------------------------------------------------------------
// Interface for document parsers
//
// Design: future parsers (docling, unstructured, pdfplumber) will implement
// this interface and plug into the pipeline via the registry below.
// The current implementation uses Moteur OCR (local) text directly.
// ---------------------------------------------------------------------------

export type DocumentParserProvider =
  | "paperless_ocr"        // Current: raw OCR text from Paperless
  | "markdown_extractor"   // Future: structured markdown from PDF
  | "docling"              // Future: Docling (IBM, open-source PDF parser)
  | "unstructured"         // Future: Unstructured.io
  | "pdfplumber"           // Future: pdfplumber (Python)
  | "azure_form_recognizer"; // Future: Azure Form Recognizer / Document Intelligence

export type ParsedDocumentSection = {
  type: "header" | "paragraph" | "table" | "list" | "footer" | "metadata";
  content: string;
  /** Confidence that this section was parsed correctly (0–1) */
  confidence?: number;
  /** Page number if available */
  page?: number;
};

export type ParsedDocument = {
  provider: DocumentParserProvider;
  documentId: number;
  rawText: string;
  sections: ParsedDocumentSection[];
  tables: Array<{
    markdown: string;
    caption?: string;
    page?: number;
  }>;
  metadata: {
    pageCount?: number;
    language?: string;
    encoding?: string;
    parsedAt: string;
  };
};

export type DocumentParserOptions = {
  maxChars?: number;
  includeMetadata?: boolean;
  extractTables?: boolean;
};

export interface IDocumentParser {
  readonly provider: DocumentParserProvider;
  readonly displayName: string;
  readonly isAvailable: () => boolean | Promise<boolean>;
  parse(documentId: number, rawOcr: string, options?: DocumentParserOptions): Promise<ParsedDocument>;
}

// ---------------------------------------------------------------------------
// Built-in: Moteur OCR (local) parser (wraps raw text into the unified format)
// ---------------------------------------------------------------------------

export class PaperlessOcrParser implements IDocumentParser {
  readonly provider: DocumentParserProvider = "paperless_ocr";
  readonly displayName = "Moteur OCR (local)";

  isAvailable(): boolean {
    return true;
  }

  async parse(
    documentId: number,
    rawOcr: string,
    options: DocumentParserOptions = {}
  ): Promise<ParsedDocument> {
    const maxChars = options.maxChars ?? 50_000;
    const truncated = rawOcr.length > maxChars
      ? rawOcr.slice(0, maxChars) + "\n[...tronqué]"
      : rawOcr;

    // Simple section detection: paragraphs separated by blank lines
    const paragraphs = truncated
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const sections: ParsedDocumentSection[] = paragraphs.map((content) => ({
      type: "paragraph" as const,
      content,
    }));

    return {
      provider: "paperless_ocr",
      documentId,
      rawText: truncated,
      sections,
      tables: [],
      metadata: {
        language: "fr",
        parsedAt: new Date().toISOString(),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PARSERS: Map<DocumentParserProvider, IDocumentParser> = new Map([
  ["paperless_ocr", new PaperlessOcrParser()],
  // Future: register additional parsers here
]);

export function getDocumentParser(
  provider: DocumentParserProvider = "paperless_ocr"
): IDocumentParser {
  return PARSERS.get(provider) ?? PARSERS.get("paperless_ocr")!;
}

export function getDefaultParser(): IDocumentParser {
  const envProvider = process.env.DOCUMENT_PARSER_PROVIDER as DocumentParserProvider | undefined;
  if (envProvider && PARSERS.has(envProvider)) {
    return PARSERS.get(envProvider)!;
  }
  return PARSERS.get("paperless_ocr")!;
}

export function registerParser(parser: IDocumentParser): void {
  PARSERS.set(parser.provider, parser);
}

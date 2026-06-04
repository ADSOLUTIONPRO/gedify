import "server-only";

import type { ExtractResult } from "./ocr";
import type { EngineDocument } from "./stores";

/* Métadonnées OCR dérivées d'un résultat d'extraction (Partie 4). Partagé entre
   l'import (consume) et le job OCR pour rester cohérent. */

const LOW_CONFIDENCE = 60;
const SHORT_TEXT = 30;

export function ocrQuality(text: string, confidence: number | null): "good" | "low" | null {
  const len = text.trim().length;
  if (len === 0) return null;
  if (confidence != null && confidence < LOW_CONFIDENCE) return "low";
  if (len < SHORT_TEXT) return "low";
  return "good";
}

function engineLabel(source: ExtractResult["source"]): string {
  switch (source) {
    case "ocr_engine":
      return "tesseract";
    case "native_pdf_text":
      return "pdf-text";
    case "text_file":
      return "fichier";
    default:
      return "—";
  }
}

/** Champs OCR à fusionner sur le document après une extraction. */
export function ocrMetaFields(r: ExtractResult, startedAt: string): Partial<EngineDocument> {
  const len = r.text.trim().length;
  return {
    ocr_source: r.source,
    ocr_engine: engineLabel(r.source),
    ocr_language: r.source === "ocr_engine" ? process.env.OCR_LANGUAGE?.trim() || "fra+eng" : null,
    ocr_confidence: r.confidence,
    ocr_text_length: len,
    ocr_pages_count: r.pageCount ?? null,
    ocr_quality: ocrQuality(r.text, r.confidence),
    ocr_started_at: startedAt,
    ocr_finished_at: new Date().toISOString(),
  };
}

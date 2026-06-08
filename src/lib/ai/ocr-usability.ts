import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   §16 — Décide si un texte OCR est EXPLOITABLE. Un OCR n'est pas exploitable
   s'il est trop court, contient trop peu de mots, ou est majoritairement
   composé de caractères parasites (scan illisible). Dans ce cas, l'UI propose
   la même confirmation que pour un OCR absent.
   ──────────────────────────────────────────────────────────────────────── */

export type OcrUsability = {
  usable: boolean;
  reason: "ok" | "empty" | "too_short" | "too_few_words" | "garbled";
  length: number;
  words: number;
  validRatio: number;
};

const MIN_CHARS = 25;
const MIN_WORDS = 5;
const MIN_VALID_RATIO = 0.6;

/** Ratio de caractères « valides » (lettres/chiffres/espaces/ponctuation usuelle). */
function validCharRatio(text: string): number {
  if (text.length === 0) return 0;
  const valid = (text.match(/[\p{L}\p{N}\s.,;:!?'"()\-/€$%@&°+]/gu) ?? []).length;
  return valid / text.length;
}

export function assessOcr(raw: string | null | undefined): OcrUsability {
  const text = (raw ?? "").trim();
  const length = text.length;
  const words = text.split(/\s+/).filter((w) => w.length >= 2).length;
  const validRatio = validCharRatio(text);
  if (length === 0) return { usable: false, reason: "empty", length, words, validRatio };
  if (length < MIN_CHARS) return { usable: false, reason: "too_short", length, words, validRatio };
  if (words < MIN_WORDS) return { usable: false, reason: "too_few_words", length, words, validRatio };
  if (validRatio < MIN_VALID_RATIO) return { usable: false, reason: "garbled", length, words, validRatio };
  return { usable: true, reason: "ok", length, words, validRatio };
}

/** Vrai si l'OCR est exploitable pour une analyse fiable. */
export function isOcrUsable(raw: string | null | undefined): boolean {
  return assessOcr(raw).usable;
}

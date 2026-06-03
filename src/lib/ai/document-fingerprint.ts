import type { PaperlessDocument } from "@/lib/paperless-types";
import type { LearnedTemplate, MetadataFingerprint, TemplateMatch, TextFingerprint } from "./learned-templates-types";

/** Empreinte d'un document, pour comparaison aux modèles appris. */
export type DocumentFingerprint = {
  text: TextFingerprint;
  metadata: MetadataFingerprint;
};

const DIACRITICS = /[̀-ͯ]/g;

/** Stop-words FR fréquents à exclure des mots-clés. */
const STOP = new Set([
  "le", "la", "les", "des", "une", "uns", "und", "und", "dans", "pour", "avec", "sur", "par", "aux", "que",
  "qui", "est", "sont", "vous", "nous", "votre", "vos", "nos", "notre", "cette", "ces", "son", "ses", "leur",
  "leurs", "plus", "moins", "tout", "tous", "toute", "toutes", "etre", "avoir", "fait", "faite", "selon",
  "page", "total", "euros", "euro", "date", "montant", "numero", "reference", "client", "merci", "cordialement",
]);

function norm(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/** Extrait les mots-clés caractéristiques (tokens fréquents, hors stop-words). */
function extractKeywords(ocr: string, limit = 40): string[] {
  const tokens = norm(ocr).match(/[a-z][a-z0-9]{3,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (STOP.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

export function computeDocumentFingerprint(document: PaperlessDocument, ocrText: string): DocumentFingerprint {
  const correspondent = document.correspondent__name ?? null;
  return {
    text: {
      keywords: extractKeywords(ocrText),
      issuer: correspondent ? norm(correspondent) : null,
    },
    metadata: {
      mimeType: document.mime_type ?? null,
      pageCount: document.page_count ?? null,
      correspondentName: correspondent,
    },
  };
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Score de similarité document ↔ modèle (0–1). */
export function scoreSimilarity(template: LearnedTemplate, fp: DocumentFingerprint): { text: number; metadata: number; visual: number; global: number } {
  const text = jaccard(template.textFingerprint.keywords, fp.text.keywords);

  // Métadonnées : correspondant (fort) + mime + nb de pages proche.
  let metaParts = 0;
  let metaScore = 0;
  const tName = template.metadataFingerprint.correspondentName;
  const dName = fp.metadata.correspondentName;
  if (tName || dName) {
    metaParts += 1;
    if (tName && dName && norm(tName) === norm(dName)) metaScore += 1;
  }
  // Émetteur présent dans les mots-clés du document (utile si correspondant absent).
  if (template.textFingerprint.issuer && fp.text.keywords.some((k) => template.textFingerprint.issuer!.includes(k) || k.includes(template.textFingerprint.issuer!))) {
    metaParts += 1; metaScore += 1;
  }
  if (template.metadataFingerprint.mimeType && fp.metadata.mimeType) {
    metaParts += 1;
    if (template.metadataFingerprint.mimeType === fp.metadata.mimeType) metaScore += 1;
  }
  if (template.metadataFingerprint.pageCount && fp.metadata.pageCount) {
    metaParts += 1;
    if (Math.abs(template.metadataFingerprint.pageCount - fp.metadata.pageCount) <= 1) metaScore += 1;
  }
  const metadata = metaParts > 0 ? metaScore / metaParts : 0;

  const visual = 0; // empreinte visuelle non encore calculée (structure prévue)
  // Pondération : texte prioritaire, métadonnées en appui (visuel = 0 pour l'instant).
  const global = 0.7 * text + 0.3 * metadata;
  return { text, metadata, visual, global };
}

/** Meilleur modèle actif correspondant au document (ou null). */
export function matchBestTemplate(fp: DocumentFingerprint, templates: LearnedTemplate[]): TemplateMatch | null {
  let best: TemplateMatch | null = null;
  for (const template of templates) {
    if (!template.active) continue;
    const s = scoreSimilarity(template, fp);
    if (!best || s.global > best.score) {
      best = { template, score: s.global, text: s.text, metadata: s.metadata, visual: s.visual };
    }
  }
  return best;
}

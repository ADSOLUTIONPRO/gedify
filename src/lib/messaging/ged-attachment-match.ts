import "server-only";

import { getDocuments } from "@/lib/paperless";
import type { PaperlessDocument } from "@/lib/paperless-types";

export type GedMatch = { documentId: number; documentTitle: string };

const DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalise un nom de fichier pour la comparaison : retire les accents, passe en
 * minuscules et supprime tout caractère non alphanumérique (on conserve le point
 * pour garder l'extension dans la comparaison). Ainsi « Conditions Générales.pdf »
 * et « conditions_generales.pdf » deviennent identiques.
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "");
}

function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{1,8}$/i, "");
}

/**
 * Cherche dans la GED (Paperless) un document correspondant déjà à une pièce
 * jointe, par comparaison du nom de fichier (exact puis normalisé). On compare
 * `original_file_name`, `archived_file_name`, `filename` et le titre. Renvoie le
 * document trouvé ou `null` (on privilégie l'absence de faux positif).
 */
export async function detectExistingGedDocument(
  filename: string,
  _mimeType?: string | null,
): Promise<GedMatch | null> {
  const target = normalizeName(filename);
  if (!target) return null;

  let candidates: PaperlessDocument[] = [];
  // Recherche plein texte : Paperless indexe le nom de fichier d'origine.
  try {
    const byQuery = await getDocuments({ query: filename, page_size: 10 });
    candidates = byQuery.results ?? [];
  } catch {
    /* on tentera le repli par titre */
  }
  // Repli : recherche par titre (nom sans extension).
  if (candidates.length === 0) {
    try {
      const byTitle = await getDocuments({ title__icontains: stripExtension(filename), page_size: 10 });
      candidates = byTitle.results ?? [];
    } catch {
      return null;
    }
  }

  for (const doc of candidates) {
    const names = [doc.original_file_name, doc.original_filename, doc.archived_file_name, doc.filename, doc.title]
      .filter((n): n is string => Boolean(n));
    if (names.some((n) => normalizeName(n) === target)) {
      return { documentId: Number(doc.id), documentTitle: doc.title ?? filename };
    }
  }
  return null;
}

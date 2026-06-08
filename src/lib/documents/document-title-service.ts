import "server-only";

import type { AIAnalysis } from "@/lib/ai/types";
import { findTitlePattern, renderDocumentTitle, titleFromFileName } from "./title-conventions";

/* ────────────────────────────────────────────────────────────────────────
   Service central de titrage. Toute génération de titre passe par ici :
   1) si une convention existe pour le type détecté → titre DÉTERMINISTE
      construit à partir des champs structurés (date, émetteur, référence…) ;
   2) sinon → titre IA libre (avec sa confiance) ;
   3) sinon → nom de fichier nettoyé.
   Garantit la cohérence entre documents de même famille (seules les variables
   changent), sans reformulation créative.
   ──────────────────────────────────────────────────────────────────────── */

export type BuiltTitleSource = "convention" | "ai" | "filename";
export type BuiltTitle = { title: string; source: BuiltTitleSource; confidence: number };

/** Date la plus représentative du document (date d'émission > 1ʳᵉ détectée). */
function pickDocumentDate(analysis: AIAnalysis): string | null {
  const dates = analysis.detectedDates ?? [];
  if (dates.length === 0) return null;
  const emission = dates.find((d) => /document|émission|emission|établi|etabli|facture|arr[êe]t|imposition/i.test(d.label));
  return (emission ?? dates[0]).iso ?? null;
}

/** Construit le titre à partir d'une analyse + nom de fichier (dernier recours).
 *  `templatePattern` = motif appris d'un document similaire validé (prioritaire
 *  sur la convention générique : il porte la structure réellement validée). */
export function buildTitleFromAnalysis(analysis: AIAnalysis, fileName?: string | null, templatePattern?: string | null): BuiltTitle {
  const typeName = analysis.suggestedDocumentTypeName ?? null;
  const kind = analysis.detectedDocumentKind ?? null;
  // 1) Motif appris d'un document similaire validé (réutilise la STRUCTURE).
  const pattern = (templatePattern && templatePattern.trim()) || findTitlePattern(typeName, kind);

  if (pattern) {
    const title = renderDocumentTitle(pattern, {
      type: typeName,
      date: pickDocumentDate(analysis),
      emetteur: analysis.suggestedCorrespondentName ?? null,
      reference: (analysis.detectedReferences ?? [])[0]?.value ?? null,
      objet: analysis.summary ? analysis.summary.split(/[.\n]/)[0]?.slice(0, 48) ?? null : null,
    });
    if (title && title.length >= 3) {
      // Titre déterministe (convention) → confiance élevée par construction.
      const conf = analysis.globalConfidenceScore ?? analysis.titleConfidence ?? 0.9;
      return { title, source: "convention", confidence: Math.max(0.85, conf) };
    }
  }

  if (analysis.suggestedTitle && analysis.suggestedTitle.trim().length >= 3) {
    return { title: analysis.suggestedTitle.trim(), source: "ai", confidence: analysis.titleConfidence ?? 0.5 };
  }

  const fromFile = titleFromFileName(fileName);
  return { title: fromFile, source: "filename", confidence: fromFile ? 0.4 : 0 };
}

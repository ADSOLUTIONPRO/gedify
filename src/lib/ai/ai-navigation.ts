import "server-only";

import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import type { AIAnalysisStatus } from "@/lib/ai/types";

/* ────────────────────────────────────────────────────────────────────────
   File de revue IA : ordre = liste « Documents analysés » (/ia/documents),
   c.-à-d. analyses triées par updatedAt décroissant, dédoublonnées par
   documentId. Sert à la navigation précédent/suivant et au « valider et
   passer au suivant » dans la fiche IA.
   ──────────────────────────────────────────────────────────────────────── */

/** Statuts encore « à vérifier / à valider » (le reste est traité). */
const PENDING: ReadonlySet<AIAnalysisStatus> = new Set(["draft", "ready-to-validate"]);

export type ReviewNavigation = {
  /** Nombre total de documents dans la file. */
  total: number;
  /** Position 1-based du document courant (0 s'il n'est pas dans la file). */
  position: number;
  inQueue: boolean;
  /** Voisins immédiats dans la file (tous statuts). */
  previousId: number | null;
  nextId: number | null;
  /** Prochain document ENCORE à vérifier après le courant (ou le 1er si hors file). */
  nextPendingId: number | null;
  /** Documents encore à vérifier dans toute la file. */
  remaining: number;
};

export async function getReviewNavigation(documentId: number): Promise<ReviewNavigation> {
  const analyses = [...(await listAnalyses())].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));

  // Une entrée par document (la plus récente prime, l'ordre est déjà décroissant).
  const seen = new Set<number>();
  const queue: { documentId: number; pending: boolean }[] = [];
  for (const a of analyses) {
    if (seen.has(a.documentId)) continue;
    seen.add(a.documentId);
    queue.push({ documentId: a.documentId, pending: PENDING.has(a.status) });
  }

  const total = queue.length;
  const remaining = queue.filter((q) => q.pending).length;
  const idx = queue.findIndex((q) => q.documentId === documentId);

  if (idx === -1) {
    const firstPending = queue.find((q) => q.pending)?.documentId ?? null;
    return { total, position: 0, inQueue: false, previousId: null, nextId: null, nextPendingId: firstPending, remaining };
  }

  const previousId = idx > 0 ? queue[idx - 1].documentId : null;
  const nextId = idx < total - 1 ? queue[idx + 1].documentId : null;
  const nextPendingId = queue.slice(idx + 1).find((q) => q.pending)?.documentId ?? null;

  return { total, position: idx + 1, inQueue: true, previousId, nextId, nextPendingId, remaining };
}

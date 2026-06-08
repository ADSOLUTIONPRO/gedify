import type { DocumentVM } from "@/components/documents/types";

/* ────────────────────────────────────────────────────────────────────────
   Matrice de capacités des actions groupées : source de vérité unique des
   libellés conditionnels (OCR / IA / archivage) selon les STATUTS de la
   sélection (homogène ou mixte) + résumés avant lancement. Réutilisable par
   la barre d'actions groupées (et plus tard la Fiche Doc / la vue tableau).
   ──────────────────────────────────────────────────────────────────────── */

export type BulkActionsMatrix = {
  count: number;
  /** OCR : libellé adapté (Lancer / Relancer / Lancer ou relancer). */
  ocrLabel: string;
  ocrSummary: string | null;
  /** IA : Lancer l'analyse / Réanalyser. */
  aiLabel: string;
  aiSummary: string | null;
  /** Archivage : seuls les non archivés sont concernés. */
  archiveLabel: string;
  archiveEnabled: boolean;
  archiveReason: string | null;
};

export function getBulkActionsMatrix(docs: DocumentVM[]): BulkActionsMatrix {
  const count = docs.length;

  // OCR : statuses.ocr ∈ done | low | pending. "pending" = à (re)faire.
  const ocrToRun = docs.filter((d) => d.statuses.ocr === "pending").length;
  const ocrToRedo = count - ocrToRun;
  const ocrLabel = ocrToRun === count ? "Lancer l'OCR" : ocrToRedo === count ? "Relancer l'OCR" : "Lancer / relancer l'OCR";
  const ocrSummary = count > 1 && ocrToRun > 0 && ocrToRedo > 0 ? `${ocrToRun} à lancer · ${ocrToRedo} à relancer` : null;

  // IA : statuses.ai ∈ none | done | review | error.
  const aiNone = docs.filter((d) => d.statuses.ai === "none").length;
  const aiLabel = aiNone === count ? "Lancer l'analyse IA" : "Réanalyser avec l'IA";
  const aiSummary = count > 1 && aiNone > 0 && aiNone < count ? `${aiNone} analyse(s) initiale(s) · ${count - aiNone} réanalyse(s)` : null;

  // Archivage : on ne ré-archive jamais un document déjà archivé.
  const notArchived = docs.filter((d) => d.status !== "archived").length;
  const archiveEnabled = notArchived > 0;
  const archiveLabel = notArchived === count ? "Archiver" : notArchived === 0 ? "Déjà archivés" : `Archiver les non archivés (${notArchived})`;
  const archiveReason = notArchived === 0 ? "Tous les documents sélectionnés sont déjà archivés." : null;

  return { count, ocrLabel, ocrSummary, aiLabel, aiSummary, archiveLabel, archiveEnabled, archiveReason };
}

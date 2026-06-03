/**
 * Regroupement intelligent (CaseCluster): identifie un "dossier" composé de plusieurs
 * documents qui se rapportent au même cas (ex: facture → relance → mise en demeure → huissier).
 *
 * Logique de matching prévue (à connecter):
 *   - même correspondant
 *   - montant identique ou proche (tolérance 5%)
 *   - même référence (facture, contrat, dossier)
 *   - vocabulaire récurrent ("relance", "huissier", "saisie", …)
 *   - même projet/dossier rattaché
 */

export type CaseClusterStage =
  | "initial" // facture, demande, déclaration
  | "reminder" // relance
  | "formal_notice" // mise en demeure
  | "litigation" // contentieux, huissier
  | "resolved" // payé / classé
  | "other";

export type CaseClusterDocument = {
  documentId: number;
  /** Ce qu'on a détecté pour ce document dans le cluster. */
  stage: CaseClusterStage;
  /** Snapshot du titre au moment du clustering. */
  title: string;
  /** Date du document (pour ordonner le cluster chronologiquement). */
  date: string | null;
};

export type CaseCluster = {
  id: string;
  /** Libellé synthétique du dossier (ex: "Trésor Public — facture 2024 #ABC123"). */
  label: string;
  /** Correspondant principal (souvent unique). */
  correspondentId: number | null;
  correspondentName: string | null;
  /** Montant nominal du dossier (souvent la créance d'origine). */
  amount: number | null;
  currency: string | null;
  /** Référence pivot (numéro de facture / dossier). */
  reference: string | null;
  documents: CaseClusterDocument[];
  /** Tags discriminants détectés (relance, huissier, contestation…). */
  tags: string[];
  /** Conseil IA sur la conduite à tenir. */
  recommendation: string | null;
  createdAt: string;
  updatedAt: string;
};

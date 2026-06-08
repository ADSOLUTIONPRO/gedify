/**
 * Modèle de classement APPRIS (mémoire d'apprentissage documentaire).
 * Chaque validation utilisateur crée ou renforce un modèle réutilisable pour
 * reconnaître et classer automatiquement les documents similaires.
 */

/** Origine du classement appliqué à un document (affiché dans la Fiche IA). */
export type ClassificationSource = "openai" | "learned_template" | "similar" | "rule" | "user";

export type TemplateBudgetMapping = {
  /** Type principal finance (revenu, depense, dette…). */
  type: string | null;
  category: string | null;
  status: string | null;
  /** D'où vient le montant ("net_to_pay", "total"…). */
  amountSource: string | null;
  /** D'où vient la date ("payment_date_or_period", "document"…). */
  dateSource: string | null;
};

/** Empreinte texte : mots-clés OCR caractéristiques + émetteur. */
export type TextFingerprint = {
  keywords: string[];
  issuer: string | null;
};

/** Empreinte métadonnées (format / structure). */
export type MetadataFingerprint = {
  mimeType: string | null;
  pageCount: number | null;
  correspondentName: string | null;
};

/** Empreinte visuelle — structure prévue, remplie plus tard (hash perceptuel). */
export type VisualFingerprint = {
  /** Hash perceptuel de la 1ʳᵉ page (vide au départ). */
  pHash?: string | null;
  pageWidth?: number | null;
  pageHeight?: number | null;
};

export type LearnedTemplate = {
  id: string;
  label: string;
  documentType: string | null;
  primaryCorrespondent: string | null;
  secondaryCorrespondents: string[];
  tags: string[];
  folder: string | null;
  budgetMapping: TemplateBudgetMapping | null;
  textFingerprint: TextFingerprint;
  metadataFingerprint: MetadataFingerprint;
  visualFingerprint: VisualFingerprint;
  /** Exemples de documents ayant validé ce modèle. */
  exampleDocumentIds: number[];
  validatedCount: number;
  lastValidatedAt: string;
  confidenceThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;

  /* ── Édition manuelle (gestion des « Modèles IA appris ») ──────────────────
     Tous OPTIONNELS → les modèles existants restent valides sans migration. */
  /** Description libre (affichée dans la fiche). */
  description?: string | null;
  /** Prompt système spécifique à CE modèle (consignes IA ciblées). */
  promptSystem?: string | null;
  /** Instructions complémentaires (ce qu'il faut extraire, format attendu…). */
  promptInstructions?: string | null;
  /** Numéro de version (incrémenté à chaque modification manuelle). */
  version?: number;
  /** Auteur de la dernière modification (username si disponible). */
  updatedBy?: string | null;
  /** Snapshot du prompt précédent → restauration sur 1 niveau. */
  previousPrompt?: { promptSystem: string | null; promptInstructions: string | null; at: string } | null;
  /** Motif de titre appris (ex. « Arrêt maladie {{date}} ») — structure, pas valeur. */
  titlePattern?: string | null;
};

export type LearnedTemplateInput = Partial<Omit<LearnedTemplate, "id" | "createdAt" | "updatedAt">>;

/** Résultat d'un appariement document ↔ modèle appris. */
export type TemplateMatch = {
  template: LearnedTemplate;
  score: number; // global 0–1
  text: number;
  metadata: number;
  visual: number;
};

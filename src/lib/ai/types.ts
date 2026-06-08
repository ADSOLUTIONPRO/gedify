export type AIConfidence = "low" | "medium" | "high";

export type AIAnalysisStatus =
  | "draft"
  | "ready-to-validate"
  | "validated"
  | "rejected"
  | "applied";

export type AIUrgency = "info" | "normal" | "important" | "urgent";

export type AIDetectedAmount = {
  label: string;
  amount: number;
  currency: string;
  kind?: string;
};

export type AIDetectedDate = {
  label: string;
  date: string;
  iso: string;
};

export type AIDetectedReference = {
  label: string;
  value: string;
};

export type AIRecommendedActionType =
  | "pay"
  | "reply"
  | "forward"
  | "verify"
  | "classify"
  | "follow-up"
  | "sign"
  | "send"
  | "keep"
  | "archive"
  | "call"
  | "prepare"
  | "declare"
  | "contest";

export type AIRecommendedAction = {
  id: string;
  type: AIRecommendedActionType;
  title: string;
  description?: string;
  dueDate?: string | null;
  amount?: number | null;
  priority?: "low" | "normal" | "high" | "urgent";
};

export type AIFinancialKind =
  | "income"
  | "expense"
  | "debt"
  | "refund"
  | "invoice"
  | "subscription"
  | "due"
  | "allowance"
  | "benefit"
  | "tax"
  | "credit"
  | "loan"
  | "fees"
  | "other";

export type AIFinancialImpact = {
  kind: AIFinancialKind;
  amount: number;
  currency: string;
  dueDate?: string | null;
  paidDate?: string | null;
  creditor?: string;
  debtor?: string;
  reference?: string;
  category?: string;
  recurrence?: string;
  confidence: AIConfidence;
};

export type AIAnalysisWarning = {
  code:
    | "low_confidence"
    | "conflicting_evidence"
    | "missing_issuer"
    | "missing_amount"
    | "missing_date"
    | "unreliable_ocr"
    | "policy_violation"
    | "other";
  message: string;
};

export type AIOriginalSuggestion = {
  correspondentName: string | null;
  documentTypeName: string | null;
  tagNames: string[];
  source: "ai";
  capturedAt: string;
};

export type AIRuleMatch = {
  ruleId: string;
  description: string;
  weight: "strong" | "medium" | "weak";
  enforceCategory: string | null;
  canonicalName: string | null;
  markersMatched: string[];
};

export type AIAnalysis = {
  id: string;
  documentId: number;
  summary: string;
  /** Échéance saisie manuellement dans la Fiche Doc (ISO date), persistée pour
   *  être relue à la réouverture (prime sur les dates détectées). */
  dueDate?: string | null;
  plainLanguageExplanation: string;
  detectedDocumentKind: string;
  suggestedTitle?: string | null;
  titleConfidence?: number | null;
  titleReason?: string | null;
  warnings?: AIAnalysisWarning[];
  autoApplyEligible?: boolean;
  /** Score de confiance global numérique [0,1] issu du schéma riche (null si provider local). */
  globalConfidenceScore?: number | null;
  /** Dossier/projet suggéré par l'IA (nom). Aujourd'hui appliqué automatiquement si confiance haute. */
  suggestedFolderName?: string | null;
  /** Nom du dossier réellement appliqué au document (auto-classement). */
  appliedFolderName?: string | null;
  /** Champs déjà appliqués au document (correspondant, type, tags, dossier, date, titre). */
  appliedFields?: string[];
  /** Date de la dernière application des suggestions (ISO). */
  appliedAt?: string | null;
  /** Origine du classement : openai | learned_template | similar | rule | user. */
  classificationSource?: "openai" | "learned_template" | "similar" | "rule" | "user";
  /** Modèle appris ayant servi au classement (apprentissage progressif). */
  matchedTemplateId?: string | null;
  matchedTemplateLabel?: string | null;
  /** Score de similarité (0–1) avec le modèle appris. */
  similarityScore?: number | null;
  /** Vrai si l'analyse demande une vérification humaine (auto-apply refusé). */
  needsReview?: boolean;
  /** Suggestion IA telle que renvoyée par le modèle, avant correction par les
   *  règles de cohérence. Permet à l'UI d'afficher l'historique. */
  originalSuggestion?: AIOriginalSuggestion | null;
  /** Liste des règles déterministes qui ont matché lors du contrôle de cohérence. */
  ruleMatches?: AIRuleMatch[];
  /** Raison du blocage de l'auto-apply (null si rien ne bloque). */
  blockedAutoApplyReason?: string | null;
  suggestedCorrespondentId: number | null;
  suggestedCorrespondentName: string | null;
  /** Correspondants secondaires proposés par l'IA (noms). */
  secondaryCorrespondentNames?: string[];
  suggestedDocumentTypeId: number | null;
  suggestedDocumentTypeName: string | null;
  suggestedTagIds: number[];
  suggestedTagNames: string[];
  suggestedProjectIds: string[];
  detectedDates: AIDetectedDate[];
  detectedAmounts: AIDetectedAmount[];
  detectedReferences: AIDetectedReference[];
  detectedPeople: string[];
  detectedOrganizations: string[];
  urgency: AIUrgency;
  recommendedActions: AIRecommendedAction[];
  financialImpact: AIFinancialImpact[];
  confidence: AIConfidence;
  status: AIAnalysisStatus;
  provider: string;
  /** Données structurées enrichies produites par le provider cloud avancé. */
  richData?: Record<string, unknown> | null;
  /**
   * Statut de l'enrichissement IA (complément optionnel post-analyse locale).
   * undefined / "none" → pas d'enrichissement tenté
   * "done"    → enrichissement réussi
   * "timeout" → Ollama n'a pas répondu à temps — analyse locale conservée
   * "error"   → erreur non-timeout
   */
  enrichmentStatus?: "none" | "done" | "timeout" | "error" | null;
  /** Message associé à enrichmentStatus (ex: raison du timeout ou de l'erreur). */
  enrichmentMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AIAnalysisInput = Partial<Omit<AIAnalysis, "createdAt" | "updatedAt">>;

import { STRICT_FRENCH_ADMIN_SYSTEM_PROMPT } from "./document-analysis-system-prompt";
import { CORRESPONDENT_DETECTION_RULES } from "./correspondent-detection-prompt";
import { DOCUMENT_CLASSIFICATION_RULES } from "./document-classification-prompt";
import { FINANCIAL_EXTRACTION_RULES } from "./financial-extraction-prompt";
import { ACTION_DETECTION_RULES } from "./action-detection-prompt";

/**
 * Identifiants des profils de prompt disponibles.
 *
 * - `strict_french_admin` : profil métier strict pour documents administratifs
 *   français. Détection du correspondant règle-par-règle, justification
 *   obligatoire, confiance "low" en cas de doute. C'est le profil par défaut.
 * - `legacy` : ancien prompt généraliste, conservé pour comparaison et
 *   compatibilité descendante. Ne pas utiliser en production.
 */
export type PromptProfile = "strict_french_admin" | "legacy";

export const DEFAULT_PROMPT_PROFILE: PromptProfile = "strict_french_admin";

const LEGACY_SYSTEM_PROMPT = `Tu es un assistant administratif personnel français. Tu analyses des documents pour proposer un classement et détecter les actions à faire.

Réponds STRICTEMENT en JSON. Aucun texte avant ou après. Aucun markdown. Schéma :

{
  "summary": "string (3-5 phrases en français, factuel, neutre)",
  "plainLanguageExplanation": "string (1-3 phrases simples, pour utilisateur non technique)",
  "detectedDocumentKind": "string (ex. 'Facture', 'Avis CAF', 'Bulletin de salaire', 'Mise en demeure'...)",
  "suggestedTitle": "string (titre métier court et lisible)",
  "titleConfidence": "number entre 0 et 1",
  "titleReason": "string (1 phrase expliquant le titre choisi)",
  "suggestedCorrespondentName": "string ou null (organisme émetteur)",
  "suggestedDocumentTypeName": "string ou null (type Paperless suggéré)",
  "suggestedTagNames": ["string"],
  "detectedDates": [{"label": "string", "date": "DD/MM/YYYY", "iso": "YYYY-MM-DD"}],
  "detectedAmounts": [{"label": "string", "amount": number, "currency": "EUR"}],
  "detectedReferences": [{"label": "string", "value": "string"}],
  "detectedPeople": ["string"],
  "detectedOrganizations": ["string"],
  "urgency": "info|normal|important|urgent",
  "recommendedActions": [{"type": "pay|reply|forward|verify|classify|follow-up|sign|send|keep|archive|call|prepare|declare|contest", "title": "string", "description": "string", "dueDate": "YYYY-MM-DD ou null", "amount": number ou null, "priority": "low|normal|high|urgent"}],
  "financialImpact": [{"kind": "income|expense|debt|refund|invoice|subscription|due|allowance|benefit|tax|credit|loan|fees|other", "amount": number, "currency": "EUR", "dueDate": "YYYY-MM-DD ou null", "creditor": "string ou null", "category": "string ou null", "recurrence": "monthly|yearly|one-shot|null"}],
  "confidence": "low|medium|high"
}

Règles :
- Toujours du JSON valide.
- Tableaux vides plutôt que null pour les listes.
- Ne pas inventer de montants, dates ou références qui ne sont pas dans le texte.
- Si tu n'es pas sûr, mets confidence à "low" et urgency à "normal".
- Toutes les recommandations supposent que l'utilisateur les validera avant exécution.`;

const REGISTRY: Record<PromptProfile, { systemPrompt: string; label: string }> = {
  strict_french_admin: {
    systemPrompt: STRICT_FRENCH_ADMIN_SYSTEM_PROMPT,
    label: "Profil strict admin français (DGFIP, CAF, CPAM, banque…)",
  },
  legacy: {
    systemPrompt: LEGACY_SYSTEM_PROMPT,
    label: "Prompt généraliste historique (compatibilité)",
  },
};

/**
 * Résout le profil de prompt à utiliser à partir de la variable d'env
 * `AI_PROMPT_PROFILE`. Toute valeur inconnue retombe sur le profil par
 * défaut (`strict_french_admin`) — c'est volontaire pour éviter de tomber
 * sur un prompt vide en production.
 */
export function resolvePromptProfile(): PromptProfile {
  const raw = (process.env.AI_PROMPT_PROFILE ?? "").trim();
  if (raw === "legacy") return "legacy";
  if (raw === "strict_french_admin") return "strict_french_admin";
  return DEFAULT_PROMPT_PROFILE;
}

/**
 * Retourne le prompt système actif côté serveur.
 *
 * Toujours utilisé côté serveur uniquement : le prompt ne doit jamais être
 * envoyé au client et la clé OpenAI ne quitte pas le serveur.
 */
export function getActiveSystemPrompt(profile?: PromptProfile): string {
  const resolved = profile ?? resolvePromptProfile();
  return REGISTRY[resolved].systemPrompt;
}

/**
 * Renvoie le label lisible du profil (utile pour logs / diagnostics).
 */
export function getPromptProfileLabel(profile?: PromptProfile): string {
  const resolved = profile ?? resolvePromptProfile();
  return REGISTRY[resolved].label;
}

/**
 * Sections de prompt métier modulaires (lecture seule), exposées pour
 * affichage / diagnostic dans l'espace Analyse IA (page « Prompts métier »).
 * Ces sections restent côté serveur ; aucune clé OpenAI n'est jamais exposée.
 */
export type PromptSection = {
  id: string;
  label: string;
  description: string;
  content: string;
};

export function getBusinessPromptSections(): PromptSection[] {
  return [
    {
      id: "correspondent",
      label: "Détection du correspondant",
      description: "Familles administratives françaises (DGFIP, CAF, CPAM, banque, notaire…).",
      content: CORRESPONDENT_DETECTION_RULES,
    },
    {
      id: "classification",
      label: "Classement (type de document)",
      description: "OCR prioritaire, nom de fichier = indice faible, ancien type Paperless potentiellement faux.",
      content: DOCUMENT_CLASSIFICATION_RULES,
    },
    {
      id: "financial",
      label: "Extraction financière",
      description: "Montants, échéances et impacts budgétaires, sans invention.",
      content: FINANCIAL_EXTRACTION_RULES,
    },
    {
      id: "actions",
      label: "Détection des actions",
      description: "Actions recommandées, toujours soumises à validation humaine.",
      content: ACTION_DETECTION_RULES,
    },
  ];
}

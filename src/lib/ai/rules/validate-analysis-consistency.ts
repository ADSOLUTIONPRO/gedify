import "server-only";

import {
  CORRESPONDENT_RULES,
  type CorrespondentCategory,
  type CorrespondentRule,
} from "./correspondent-rules";
import { applyDocumentTypeRules } from "./document-type-rules";
import type { AnalyzeResult } from "../ai-provider";
import type { AIAnalysisWarning } from "../types";

/**
 * Snapshot de la suggestion IA d'origine, conservé avant toute correction
 * par les règles de cohérence. Permet à l'UI d'afficher "l'IA proposait
 * initialement X, la règle Y a corrigé en Z".
 */
export type AIOriginalSuggestion = {
  correspondentName: string | null;
  documentTypeName: string | null;
  tagNames: string[];
  source: "ai";
  capturedAt: string;
};

export type ConsistencyWarningCode =
  | "category_conflict"
  | "category_unsupported"
  | "correspondent_overridden"
  | "filename_dominated"
  | "low_evidence"
  | "weak_marker_only";

export type ConsistencyWarning = {
  code: ConsistencyWarningCode;
  message: string;
  ruleId?: string;
  markers?: string[];
};

export type RuleMatch = {
  ruleId: string;
  description: string;
  weight: CorrespondentRule["weight"];
  enforceCategory: CorrespondentCategory | null;
  canonicalName: string | null;
  markersMatched: string[];
};

export type ValidationOutput = {
  /** Analyse possiblement corrigée par les règles (correspondent / tags). */
  correctedAnalysis: AnalyzeResult;
  /** Avertissements détectés par les règles. */
  warnings: ConsistencyWarning[];
  /**
   * Raison agrégée du blocage de l'auto-apply. `null` si rien ne bloque.
   * Quand non null, `correctedAnalysis.autoApplyEligible` vaut toujours false.
   */
  blockedAutoApplyReason: string | null;
  /** Règles déterministes ayant matché. */
  ruleMatches: RuleMatch[];
  /** Snapshot original avant corrections (pour historique UI). */
  originalSuggestion: AIOriginalSuggestion;
};

function uniqMarkers(matches: string[]): string[] {
  return Array.from(new Set(matches.map((m) => m.trim()))).filter(Boolean);
}

function runRule(rule: CorrespondentRule, ocr: string): string[] {
  const found: string[] = [];
  for (const re of rule.markers) {
    const match = ocr.match(re);
    if (match) {
      found.push(match[0]);
      if (found.length >= 8) break;
    }
  }
  return uniqMarkers(found);
}

/**
 * Valide la cohérence d'une analyse IA contre le texte OCR et le nom du
 * fichier. Ne touche jamais les corrections marquées comme utilisateur :
 * c'est la responsabilité de l'appelant de ne pas écraser un override
 * `editedByUser=true` (cf. `getTitleOverride` côté titres documentaires).
 *
 * Garanties :
 *  - Toujours renvoie un objet (jamais d'exception sur input vide).
 *  - L'analyse retournée est une copie ; l'entrée n'est pas mutée.
 *  - `autoApplyEligible` est forcé à `false` dès qu'un warning est présent
 *    OU qu'une règle `strong` a dû corriger la proposition IA.
 */
export function validateAIAnalysisConsistency(
  analysis: AnalyzeResult,
  ocrText: string | null | undefined,
  filename?: string | null
): ValidationOutput {
  const ocr = (ocrText ?? "").normalize("NFC");
  const fname = (filename ?? "").normalize("NFC");
  const warnings: ConsistencyWarning[] = [];
  const ruleMatches: RuleMatch[] = [];

  const originalSuggestion: AIOriginalSuggestion = {
    correspondentName: analysis.suggestedCorrespondentName ?? null,
    documentTypeName: analysis.suggestedDocumentTypeName ?? null,
    tagNames: [...(analysis.suggestedTagNames ?? [])],
    source: "ai",
    capturedAt: new Date().toISOString(),
  };

  // 1. Exécuter les règles contre le texte OCR.
  const strongRules: { rule: CorrespondentRule; markers: string[] }[] = [];
  for (const rule of CORRESPONDENT_RULES) {
    const matched = runRule(rule, ocr);
    if (matched.length === 0) continue;
    ruleMatches.push({
      ruleId: rule.id,
      description: rule.description,
      weight: rule.weight,
      enforceCategory: rule.enforceCategory ?? null,
      canonicalName: rule.canonicalName ?? null,
      markersMatched: matched,
    });
    if (rule.weight === "strong") {
      strongRules.push({ rule, markers: matched });
    }
  }

  const corrected: AnalyzeResult = {
    ...analysis,
    suggestedTagNames: [...(analysis.suggestedTagNames ?? [])],
    warnings: [...(analysis.warnings ?? [])],
  };

  const proposedName = (corrected.suggestedCorrespondentName ?? "").trim();
  let correspondentWasOverridden = false;

  // ── Règles de type de document (bulletin de paie, employeur, montants) ──
  // Ces règles s'exécutent AVANT les checks de conflits pour que le type
  // "Bulletin de salaire" puisse corriger URSSAF → employeur en premier.
  const docTypeResult = applyDocumentTypeRules(corrected, ocr, fname);
  // On prend les corrections apportées par les règles de type doc
  Object.assign(corrected, docTypeResult.correctedAnalysis);
  // On convertit les DocumentTypeWarning en ConsistencyWarning et on les fusionne
  const docTypeWarnings: ConsistencyWarning[] = docTypeResult.warnings.map((w) => ({
    code: w.code === "forbidden_correspondent_overridden" ? "correspondent_overridden"
        : w.code === "pay_slip_employer_override" ? "correspondent_overridden"
        : w.code === "pay_slip_forbidden_correspondent" ? "category_conflict"
        : w.code === "pay_slip_forbidden_type" ? "category_conflict"
        : w.code === "pay_slip_secondary_organisms" ? "weak_marker_only"
        : "low_evidence",
    message: w.message,
    ruleId: w.ruleId,
    markers: w.markers,
  }));
  warnings.push(...docTypeWarnings);
  // Les match de règles de type doc s'ajoutent à la liste
  for (const w of docTypeResult.warnings) {
    ruleMatches.push({
      ruleId: w.ruleId,
      description: `Règle type document: ${w.ruleId}`,
      weight: "strong",
      enforceCategory: null,
      canonicalName: null,
      markersMatched: w.markers,
    });
  }
  // Mise à jour proposedName après les corrections document-type-rules
  const updatedName = (corrected.suggestedCorrespondentName ?? "").trim();
  if (updatedName !== proposedName) {
    correspondentWasOverridden = true;
  }

  // 2. Pour chaque règle "strong" qui matche, vérifier :
  //    - si le correspondant proposé est dans une catégorie interdite,
  //    - si le nom proposé matche un pattern interdit.
  for (const { rule, markers } of strongRules) {
    let conflict = false;

    if (rule.forbiddenCorrespondentPatterns && updatedName) {
      for (const re of rule.forbiddenCorrespondentPatterns) {
        if (re.test(updatedName)) {
          conflict = true;
          break;
        }
      }
    }

    if (conflict) {
      warnings.push({
        code: "category_conflict",
        ruleId: rule.id,
        markers,
        message: `Le correspondant proposé « ${updatedName} » est incompatible avec les marqueurs OCR détectés (${markers
          .slice(0, 3)
          .join(", ")}). Règle : ${rule.description}`,
      });

      // Correction : on remplace le correspondant par le nom canonique si
      // disponible. Sinon on retourne null + needs_review (via warnings).
      if (rule.canonicalName) {
        corrected.suggestedCorrespondentName = rule.canonicalName;
        correspondentWasOverridden = true;
        warnings.push({
          code: "correspondent_overridden",
          ruleId: rule.id,
          markers,
          message: `Correspondant remplacé par « ${rule.canonicalName} » suite à la règle « ${rule.id} » (preuves OCR : ${markers
            .slice(0, 3)
            .join(", ")}).`,
        });
      } else {
        corrected.suggestedCorrespondentName = null;
        correspondentWasOverridden = true;
      }
    }
  }

  // 3. Vérifier si le seul appui du correspondant proposé vient du nom de
  //    fichier alors que l'OCR ne contient aucun marqueur de la catégorie
  //    proposée.
  if (proposedName && fname && !correspondentWasOverridden) {
    const proposedLower = proposedName.toLowerCase();
    const fnameLower = fname.toLowerCase();
    const ocrLower = ocr.toLowerCase();
    if (
      fnameLower.includes(proposedLower) &&
      !ocrLower.includes(proposedLower) &&
      proposedLower.length >= 3
    ) {
      warnings.push({
        code: "filename_dominated",
        message: `Le correspondant proposé « ${proposedName} » apparaît dans le nom du fichier mais pas dans le texte OCR. Vérifier avant application.`,
      });
    }
  }

  // 4. Faible confiance globale ou correspondent manquant → warning informatif.
  if (!corrected.suggestedCorrespondentName) {
    warnings.push({
      code: "low_evidence",
      message:
        "Aucun correspondant n'a pu être confirmé par les règles. Le classement automatique est désactivé.",
    });
  }

  // 5. Reconstituer la liste finale de warnings sur l'analyse (à des fins
  //    de persistance et de garde-fou côté apply route).
  if (warnings.length > 0) {
    const policyWarnings: AIAnalysisWarning[] = warnings.map((w) => ({
      code: "policy_violation",
      message: w.message,
    }));
    corrected.warnings = [...(corrected.warnings ?? []), ...policyWarnings];
    corrected.autoApplyEligible = false;
  }

  const blockedAutoApplyReason =
    warnings.length > 0
      ? `${warnings.length} règle(s) de cohérence non satisfaite(s).`
      : null;

  return {
    correctedAnalysis: corrected,
    warnings,
    blockedAutoApplyReason,
    ruleMatches,
    originalSuggestion,
  };
}

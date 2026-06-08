import "server-only";

import { readStore, writeStore } from "@/lib/engine/stores";

/* ────────────────────────────────────────────────────────────────────────
   Drapeaux fonctionnels GEDify — « Modules et automatisations ».

   Source de vérité UNIQUE pour activer/désactiver des modules. Persistés dans le
   store de réglages (table `settings` en SQLite/Postgres, JSON sinon — cf.
   SETTINGS_KEYS). Mono-instance pour l'instant (Synology mono-utilisateur) ; la
   signature accepte un `userId` optionnel pour une évolution multi-utilisateur
   future sans changer les appelants.

   ⚠️ Valeurs par défaut = TRUE → aucune installation existante n'est impactée.
   ──────────────────────────────────────────────────────────────────────── */

export type GedifyFeatureFlags = {
  /** Affiche/masque l'espace Finances (menus, widgets, accès aux routes). */
  financeSpaceEnabled: boolean;
  /** Autorise le rattachement AUTOMATIQUE des documents au budget (pipeline IA). */
  autoBudgetClassificationEnabled: boolean;
  /** Analyse IA AUTOMATIQUE à l'import (gate `tryAutoAnalyze`). L'analyse manuelle reste possible. */
  autoAiAnalysisEnabled: boolean;
  /** Synchronisation AUTOMATIQUE périodique des contacts (Google/IMAP). */
  autoContactSyncEnabled: boolean;
};

const STORE_NAME = "feature-flags";

export const DEFAULT_FEATURE_FLAGS: GedifyFeatureFlags = {
  financeSpaceEnabled: true,
  autoBudgetClassificationEnabled: true,
  autoAiAnalysisEnabled: true,
  autoContactSyncEnabled: true,
};

function pickBool(saved: unknown, fallback: boolean): boolean {
  return typeof saved === "boolean" ? saved : fallback;
}

/** Lit les drapeaux (fusionnés avec les valeurs par défaut). */
export async function getGedifyFeatureFlags(_userId?: string | number): Promise<GedifyFeatureFlags> {
  const s = await readStore<Partial<GedifyFeatureFlags>>(STORE_NAME, {});
  return {
    financeSpaceEnabled: pickBool(s.financeSpaceEnabled, DEFAULT_FEATURE_FLAGS.financeSpaceEnabled),
    autoBudgetClassificationEnabled: pickBool(s.autoBudgetClassificationEnabled, DEFAULT_FEATURE_FLAGS.autoBudgetClassificationEnabled),
    autoAiAnalysisEnabled: pickBool(s.autoAiAnalysisEnabled, DEFAULT_FEATURE_FLAGS.autoAiAnalysisEnabled),
    autoContactSyncEnabled: pickBool(s.autoContactSyncEnabled, DEFAULT_FEATURE_FLAGS.autoContactSyncEnabled),
  };
}

/** Met à jour partiellement les drapeaux. Best-effort, ne lève jamais en lecture. */
export async function saveGedifyFeatureFlags(
  patch: Partial<GedifyFeatureFlags>,
  _userId?: string | number,
): Promise<GedifyFeatureFlags> {
  const current = await getGedifyFeatureFlags(_userId);
  const next: GedifyFeatureFlags = {
    financeSpaceEnabled: pickBool(patch.financeSpaceEnabled, current.financeSpaceEnabled),
    autoBudgetClassificationEnabled: pickBool(patch.autoBudgetClassificationEnabled, current.autoBudgetClassificationEnabled),
    autoAiAnalysisEnabled: pickBool(patch.autoAiAnalysisEnabled, current.autoAiAnalysisEnabled),
    autoContactSyncEnabled: pickBool(patch.autoContactSyncEnabled, current.autoContactSyncEnabled),
  };
  await writeStore(STORE_NAME, next);
  return next;
}

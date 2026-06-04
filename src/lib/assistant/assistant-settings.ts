import "server-only";

import { readStore, writeStore } from "@/lib/engine/stores";

/* ────────────────────────────────────────────────────────────────────────
   Réglages de l'assistant, persistés dans le data-dir (engine/assistant-settings.json).
   Complètent les permissions d'environnement (cf. assistant-permissions).
   ──────────────────────────────────────────────────────────────────────── */

export type AssistantSettings = {
  /** Autorise l'assistant à proposer/exécuter des actions (false = lecture seule). */
  actionsEnabled: boolean;
  /** Exécute automatiquement les actions sûres (non sensibles, 1 document). */
  autoApplySafe: boolean;
};

const STORE_NAME = "assistant-settings";
const DEFAULTS: AssistantSettings = { actionsEnabled: true, autoApplySafe: false };

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const saved = await readStore<Partial<AssistantSettings>>(STORE_NAME, {});
  return { ...DEFAULTS, ...saved };
}

export async function saveAssistantSettings(patch: Partial<AssistantSettings>): Promise<AssistantSettings> {
  const current = await getAssistantSettings();
  const next: AssistantSettings = {
    actionsEnabled: typeof patch.actionsEnabled === "boolean" ? patch.actionsEnabled : current.actionsEnabled,
    autoApplySafe: typeof patch.autoApplySafe === "boolean" ? patch.autoApplySafe : current.autoApplySafe,
  };
  await writeStore(STORE_NAME, next);
  return next;
}

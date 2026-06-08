import "server-only";

import { syncAllContacts } from "@/lib/contacts/sync";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";

/* ────────────────────────────────────────────────────────────────────────
   Synchronisation périodique des contacts (Google + emails), amorcée au boot
   via instrumentation.ts. `getActiveGmailAccount` retombe gracieusement sur le
   compte le plus récent hors contexte requête → fonctionne en arrière-plan.

   Réglage : CONTACTS_AUTOSYNC_HOURS (défaut 6 h ; 0 = désactivé). Best-effort :
   ne lève jamais ; si aucun compte / People API KO, on logge sans bloquer.
   ──────────────────────────────────────────────────────────────────────── */

let started = false;

function intervalHours(): number {
  const n = Number(process.env.CONTACTS_AUTOSYNC_HOURS);
  return Number.isFinite(n) && n >= 0 ? n : 6;
}

async function runOnce(): Promise<void> {
  try {
    // Garde « Modules » : l'auto-sync contacts peut être coupée dans les Paramètres.
    const { autoContactSyncEnabled } = await getGedifyFeatureFlags();
    if (!autoContactSyncEnabled) {
      console.log("[contacts] auto-sync ignoré (désactivé dans les paramètres).");
      return;
    }
    const { google, email } = await syncAllContacts();
    const g = google.ok ? `${google.synced} synchronisé(s)` : `ignoré (${google.errorType})`;
    const e = email.ok ? `${email.created} créé(s)` : `ignoré (${email.errorType})`;
    console.log(`[contacts] auto-sync : Google ${g} · Emails ${e}`);
  } catch (err) {
    console.error("[contacts] auto-sync échec :", err instanceof Error ? err.message : err);
  }
}

export function startContactsAutoSync(): void {
  if (started) return;
  const h = intervalHours();
  if (h <= 0) {
    console.log("[contacts] auto-sync désactivé (CONTACTS_AUTOSYNC_HOURS=0).");
    return;
  }
  started = true;
  console.log(`[contacts] auto-sync activé (toutes les ${h} h).`);
  // 1er passage différé (laisse le serveur finir de démarrer), puis périodique.
  const first = setTimeout(() => void runOnce(), 90_000);
  first.unref?.();
  const timer = setInterval(() => void runOnce(), h * 3_600_000);
  timer.unref?.();
}

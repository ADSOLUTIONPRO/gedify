/* Point d'entrée d'instrumentation Next.js : exécuté une fois au démarrage du
   serveur. Sert à amorcer les tâches de fond (sauvegarde automatique). */

export async function register() {
  // Uniquement dans le runtime Node (jamais edge / build).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Diagnostic de persistance au démarrage (chemin base, taille, utilisateurs,
  // secrets présents) — visible dans `docker logs`, sans aucune valeur secrète.
  try {
    const { logStorageDiagnostic } = await import("@/lib/startup/storage-diagnostic");
    await logStorageDiagnostic();
  } catch (e) {
    console.error("[instrumentation] diagnostic stockage échoué :", e instanceof Error ? e.message : e);
  }

  try {
    const { startAutoBackup } = await import("@/lib/transfer/auto-backup");
    startAutoBackup();
  } catch (e) {
    console.error("[instrumentation] amorçage sauvegarde auto échoué :", e instanceof Error ? e.message : e);
  }

  try {
    const { startJobWorker } = await import("@/lib/jobs/job-worker");
    startJobWorker();
  } catch (e) {
    console.error("[instrumentation] amorçage worker pipeline échoué :", e instanceof Error ? e.message : e);
  }

  try {
    const { startContactsAutoSync } = await import("@/lib/contacts/auto-sync");
    startContactsAutoSync();
  } catch (e) {
    console.error("[instrumentation] amorçage auto-sync contacts échoué :", e instanceof Error ? e.message : e);
  }
}

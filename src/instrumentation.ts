/* Point d'entrée d'instrumentation Next.js : exécuté une fois au démarrage du
   serveur. Sert à amorcer les tâches de fond (sauvegarde automatique). */

export async function register() {
  // Uniquement dans le runtime Node (jamais edge / build).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startAutoBackup } = await import("@/lib/transfer/auto-backup");
    startAutoBackup();
  } catch (e) {
    console.error("[instrumentation] amorçage sauvegarde auto échoué :", e instanceof Error ? e.message : e);
  }
}

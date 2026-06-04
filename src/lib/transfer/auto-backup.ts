import "server-only";

import { createServerBackup, listServerBackups } from "@/lib/transfer/backup";

/* ────────────────────────────────────────────────────────────────────────
   Sauvegarde AUTOMATIQUE (Chantier 5 bis) — planificateur in-process.

   Activé par GEDIFY_AUTO_BACKUP=1. Intervalle réglable
   (GEDIFY_AUTO_BACKUP_INTERVAL_HOURS, défaut 24). Démarré une seule fois au
   boot du serveur Node via instrumentation.ts. Rétention appliquée par
   createServerBackup (GEDIFY_BACKUP_RETENTION). Conçu pour un déploiement
   mono-instance (serveur long-vivant Coolify) ; idempotent au redémarrage
   (ne relance pas si une sauvegarde récente existe déjà).
   ──────────────────────────────────────────────────────────────────────── */

let started = false;
let running = false;

function enabled(): boolean {
  const v = process.env.GEDIFY_AUTO_BACKUP?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function intervalMs(): number {
  const h = Number(process.env.GEDIFY_AUTO_BACKUP_INTERVAL_HOURS);
  const hours = Number.isFinite(h) && h > 0 ? h : 24;
  return Math.max(1, hours) * 3600 * 1000;
}

async function runOnce(reason: string): Promise<void> {
  if (running) return;
  running = true;
  try {
    const report = await createServerBackup({ includeFiles: true });
    console.log(
      `[AUTO-BACKUP] ${reason} → ${report.filename} (${report.bytes} octets, ${report.counts.documents} docs)` +
        (report.errors.length ? ` — ${report.errors.length} avertissement(s)` : ""),
    );
  } catch (e) {
    console.error("[AUTO-BACKUP] échec :", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

/** Démarre le planificateur (no-op si désactivé ou déjà démarré). */
export function startAutoBackup(): void {
  if (started || !enabled()) return;
  started = true;
  const period = intervalMs();
  console.log(`[AUTO-BACKUP] activé — intervalle ${period / 3600000}h.`);

  // Au démarrage : ne lancer que si la dernière sauvegarde est plus ancienne que
  // l'intervalle (évite une sauvegarde à chaque redémarrage).
  void (async () => {
    try {
      const backups = await listServerBackups();
      const last = backups[0];
      const stale = !last || Date.now() - new Date(last.createdAt).getTime() >= period;
      if (stale) {
        setTimeout(() => void runOnce("démarrage"), 60_000).unref?.();
      }
    } catch {
      /* ignore */
    }
  })();

  // Puis périodiquement.
  const timer = setInterval(() => void runOnce("planifié"), period);
  timer.unref?.();
}

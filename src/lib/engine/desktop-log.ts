import "server-only";

/* Logs de diagnostic du pipeline vignettes/aperçus — UNIQUEMENT en app de
   bureau (Electron : process.versions.electron). Aucun bruit côté serveur web. */

const IS_DESKTOP = Boolean((process as { versions?: { electron?: string } }).versions?.electron);

export function dlog(...args: unknown[]): void {
  if (IS_DESKTOP) console.log("[desktop/thumbnails]", ...args);
}

import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Timeouts par étape du pipeline documentaire.

   Le worker traite les jobs UN PAR UN (concurrence 1). Sans garde-fou, une étape
   qui « traîne » (PDF malformé qui fige pdf.js, OCR interminable, IA bloquée…)
   gèlerait toute la file → tous les autres documents attendraient.

   `withTimeout` fait courir l'étape contre un délai : au dépassement, on lève une
   `StepTimeoutError` (retryable) → le job repasse en attente (ou échoue après
   `maxAttempts`) et le worker passe AU DOCUMENT SUIVANT. Le travail sous-jacent
   (thread Tesseract) peut continuer en fond, mais la FILE n'est jamais bloquée.
   ──────────────────────────────────────────────────────────────────────── */

export class StepTimeoutError extends Error {
  /** Marqueur : erreur temporaire → on retente (≠ document corrompu). */
  readonly retryable = true;
  constructor(label: string, ms: number) {
    super(`Timeout ${label} après ${Math.round(ms / 1000)} s`);
    this.name = "StepTimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!(ms > 0)) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(label, ms)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/** Lit une durée en SECONDES depuis l'env (fallback `def`), renvoie des ms. */
function secs(envKey: string, def: number): number {
  const n = Number(process.env[envKey]);
  return (Number.isFinite(n) && n > 0 ? n : def) * 1000;
}

/* Timeouts par étape (ms), configurables en SECONDES via variables d'env.
   Valeurs par défaut alignées sur le cahier des charges import. */
export const STEP_TIMEOUTS = {
  /**
   * FILET de sécurité ABSOLU autour de l'extraction d'un document : l'OCR gère en
   * interne ses propres échéances (par page = OCR_PAGE_TIMEOUT_SECONDS, document =
   * OCR_DOCUMENT_TIMEOUT_SECONDS) et renvoie un texte PARTIEL au dépassement. Ce
   * filet est volontairement PLUS LONG que l'échéance document (+60 s de marge)
   * pour laisser la sortie partielle se produire — il ne se déclenche qu'en cas de
   * blocage dur passé au travers des bornes par page.
   */
  ocr: () => secs("OCR_DOCUMENT_TIMEOUT_SECONDS", 900) + 60_000,
  /** Génération de la miniature (rendu 1ʳᵉ page PDF / resize image). */
  thumbnail: () => secs("THUMBNAIL_TIMEOUT_SECONDS", 90),
  /** Génération de l'aperçu. */
  preview: () => secs("PREVIEW_TIMEOUT_SECONDS", 90),
  /** Analyse IA (filet de sécurité au-dessus des timeouts internes du provider). */
  ai: () => secs("AI_JOB_TIMEOUT_SECONDS", 240),
} as const;

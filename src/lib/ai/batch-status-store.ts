import "server-only";

/**
 * Suivi en mémoire (process) du dernier batch d'analyse IA. Volontairement
 * simple : le batch est synchrone et borné, ce store permet à l'UI de
 * connaître l'état du dernier lot lancé (progression / résultat).
 *
 * Non persistant (réinitialisé au redémarrage du serveur) — suffisant pour un
 * usage mono-utilisateur. Aucune donnée sensible (uniquement des compteurs).
 */
export type BatchState = {
  id: string;
  running: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  autoValidated: number;
  startedAt: string;
  finishedAt: string | null;
  lastError: string | null;
};

let current: BatchState | null = null;

export function startBatch(total: number): BatchState {
  current = {
    id: `batch-${Date.now()}`,
    running: true,
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    autoValidated: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
  };
  return current;
}

export function recordResult(kind: "ok" | "skipped" | "failed", autoValidated = false, error?: string) {
  if (!current) return;
  current.processed += 1;
  if (kind === "ok") current.succeeded += 1;
  else if (kind === "skipped") current.skipped += 1;
  else {
    current.failed += 1;
    if (error) current.lastError = error;
  }
  if (autoValidated) current.autoValidated += 1;
}

export function finishBatch() {
  if (!current) return;
  current.running = false;
  current.finishedAt = new Date().toISOString();
}

export function getBatchState(): BatchState | null {
  return current;
}

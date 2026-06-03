import "server-only";

/**
 * In-memory per-document analysis lock.
 *
 * Prevents concurrent Ollama calls for the same document when multiple
 * clients or requests trigger analysis simultaneously. The lock is process-
 * local: it works in single-process deployments (dev, Docker single-container).
 * For multi-replica setups, a Redis-backed lock would be needed.
 */

const running = new Set<number>();

export type LockResult<T> =
  | { acquired: true; result: T }
  | { acquired: false; error: "already_running" };

/**
 * Runs `fn` only if no analysis is currently running for `documentId`.
 * Returns `{ acquired: false }` immediately if the lock is held.
 */
export async function withDocumentAnalysisLock<T>(
  documentId: number,
  fn: () => Promise<T>
): Promise<LockResult<T>> {
  if (running.has(documentId)) {
    return { acquired: false, error: "already_running" };
  }
  running.add(documentId);
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    running.delete(documentId);
  }
}

export function isAnalysisRunning(documentId: number): boolean {
  return running.has(documentId);
}

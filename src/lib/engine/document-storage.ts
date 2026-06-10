import "server-only";

import { readStore, readOriginal, STORE, type EngineDocument } from "./stores";

/* ────────────────────────────────────────────────────────────────────────
   Service CENTRAL d'accès au document + à son fichier original pour les jobs
   du pipeline.

   Pourquoi : juste après un import, un job (OCR / miniature / aperçu) peut être
   réclamé AVANT que la fiche document ou le binaire ne soient visibles du store
   (latence d'écriture JSON/SQLite/Postgres, propagation, rename atomique). Le
   handler levait alors « document introuvable » / « fichier original introuvable »
   et le document restait sans miniature ni OCR.

   Ces accesseurs accordent une courte GRÂCE (ré-essais espacés) avant d'abandonner,
   et lèvent une erreur RETRYABLE pour que le worker reprogramme le job au lieu de
   l'échouer définitivement.
   ──────────────────────────────────────────────────────────────────────── */

/** Erreur « pas encore prêt » : temporaire → le job sera repris (≠ corrompu). */
export class DocumentNotReadyError extends Error {
  readonly retryable = true;
  readonly code: "document_not_found" | "original_not_found";
  constructor(code: "document_not_found" | "original_not_found", message: string) {
    super(message);
    this.name = "DocumentNotReadyError";
    this.code = code;
  }
}

const GRACE_MS = (() => {
  const n = Number(process.env.GEDIFY_JOB_GRACE_MS);
  return Number.isFinite(n) && n >= 0 ? n : 4000;
})();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findDoc(documentId: number): Promise<EngineDocument | null> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.find((d) => d.id === documentId && !d.deleted) ?? null;
}

/**
 * Charge un document par id, en tolérant la course import→job : si la fiche n'est
 * pas (encore) visible, on ré-essaie pendant `graceMs` puis on lève une erreur
 * retryable. Renvoie toujours un document non supprimé.
 */
export async function getDocumentForJob(documentId: number, graceMs = GRACE_MS): Promise<EngineDocument> {
  const deadline = Date.now() + Math.max(0, graceMs);
  for (;;) {
    const doc = await findDoc(documentId);
    if (doc) return doc;
    if (Date.now() >= deadline) {
      throw new DocumentNotReadyError("document_not_found", "document introuvable");
    }
    await sleep(250);
  }
}

/**
 * Charge le binaire original d'un document, avec la même grâce (le fichier peut
 * arriver quelques ms après la fiche). Lève une erreur retryable si absent.
 */
export async function getOriginalForJob(doc: EngineDocument, graceMs = GRACE_MS): Promise<Buffer> {
  const deadline = Date.now() + Math.max(0, graceMs);
  for (;;) {
    const buf = await readOriginal(doc.storedFilename);
    if (buf && buf.length > 0) return buf;
    if (Date.now() >= deadline) {
      throw new DocumentNotReadyError("original_not_found", "fichier original introuvable");
    }
    await sleep(250);
  }
}

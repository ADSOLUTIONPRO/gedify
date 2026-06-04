import "server-only";

import path from "node:path";
import {
  mutateList,
  readStore,
  readOriginal,
  saveThumbnail,
  savePreview,
  STORE,
  type EngineDocument,
} from "@/lib/engine/stores";
import { extractText } from "@/lib/engine/ocr";
import { ocrMetaFields } from "@/lib/engine/ocr-meta";
import { makeThumbnail } from "@/lib/engine/thumbnails";
import { makePreview } from "@/lib/engine/previews";
import { indexDocument } from "@/lib/engine/search";
import { loadNameMaps, mimeFromExt } from "@/lib/engine/helpers";
import { enqueueJob, type PipelineJob } from "@/lib/jobs/job-store";

/** Analyse IA automatique après OCR : activée par GEDIFY_AI_AUTO=1 (coût OpenAI). */
function aiAutoEnabled(): boolean {
  const v = process.env.GEDIFY_AI_AUTO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

/* Handlers du pipeline : réutilisent les fonctions moteur existantes. Chaque
   handler agit sur un documentId et met à jour le document de façon ciblée. */

async function loadDoc(documentId: number): Promise<EngineDocument | null> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.find((d) => d.id === documentId && !d.deleted) ?? null;
}

function extOf(doc: EngineDocument): string {
  return path.extname(doc.storedFilename || doc.original_file_name || "");
}
function mimeOf(doc: EngineDocument): string {
  return doc.mime_type || mimeFromExt(extOf(doc));
}

async function patchDoc(documentId: number, patch: Partial<EngineDocument>): Promise<void> {
  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => (d.id === documentId ? { ...d, ...patch, modified: new Date().toISOString() } : d)),
  );
}

/** Re-OCR RÉEL d'un document (corrige le no-op historique). */
async function runOcr(documentId: number, fromImport = false): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  const orig = await readOriginal(doc.storedFilename);
  if (!orig) throw new Error("fichier original introuvable");

  const startedIso = new Date().toISOString();
  await patchDoc(documentId, { ocr_status: "processing", ocr_started_at: startedIso });
  const r = await extractText(orig, mimeOf(doc), extOf(doc));
  const text = r.text;
  const ocrStatus: EngineDocument["ocr_status"] = text.trim() ? "ready" : "skipped";
  await patchDoc(documentId, {
    content: text,
    page_count: r.pageCount ?? doc.page_count ?? null,
    ocr_status: ocrStatus,
    ...ocrMetaFields(r, startedIso),
    ocr_attempts: (doc.ocr_attempts ?? 0) + 1,
    index_status: "processing",
  });

  // Réindexation du nouveau texte.
  const updated = await loadDoc(documentId);
  if (updated) {
    const maps = await loadNameMaps();
    await indexDocument(updated, maps.correspondents, maps.document_types, maps.tags).catch(() => {});
    await patchDoc(documentId, { index_status: "ready" });
  }

  // Import asynchrone : appliquer les règles automatiques une fois l'OCR prêt
  // (les conditions « contenu contient … » nécessitent le texte OCR).
  if (fromImport) {
    try {
      const { runWorkflowsForDocument } = await import("@/lib/automation/workflow-engine");
      await runWorkflowsForDocument(documentId);
    } catch {
      /* moteur de règles indisponible → ignoré */
    }
    // Chaîne OCR → IA (si activée) : analyse en arrière-plan après l'OCR.
    if (ocrStatus === "ready" && aiAutoEnabled()) {
      await enqueueJob("ai", documentId, { priority: 70 }).catch(() => null);
    }
  }
}

/** Analyse IA d'un document via le service existant (lock + auto-apply sûr). */
async function runAi(documentId: number): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  await patchDoc(documentId, { ai_status: "processing" });

  const { runDocumentAnalysis } = await import("@/lib/ai/run-document-analysis");
  const { withDocumentAnalysisLock } = await import("@/lib/ai/analysis-lock");
  const lock = await withDocumentAnalysisLock(documentId, () =>
    runDocumentAnalysis(documentId, { force: false, createFinancialItems: true, autoApply: true }),
  );
  if (!lock.acquired) {
    await patchDoc(documentId, { ai_status: "pending" }); // déjà en cours ailleurs
    return;
  }
  const outcome = lock.result;
  if (outcome.status === "no-ocr") {
    await patchDoc(documentId, { ai_status: "pending" }); // attendra un OCR
    return;
  }
  if (outcome.status === "error") {
    await patchDoc(documentId, { ai_status: "failed" });
    throw new Error(outcome.message);
  }
  // Succès : confiance IA + statut de classement + raison de vérification.
  const analysis = ("analysis" in outcome ? outcome.analysis : null) as
    | { globalConfidenceScore?: number; warnings?: unknown[]; needsReview?: boolean }
    | null;
  const aiConf =
    analysis && typeof analysis.globalConfidenceScore === "number"
      ? Math.round(analysis.globalConfidenceScore * 100)
      : null;
  const needsReview = Boolean(analysis?.needsReview) || (analysis?.warnings?.length ?? 0) > 0;
  const after = await loadDoc(documentId);
  const classified = Boolean(after && after.correspondent != null && after.document_type != null);
  await patchDoc(documentId, {
    ai_status: "ready",
    ai_confidence: aiConf,
    classification_confidence: aiConf,
    classification_status: classified ? "ready" : "pending",
    needs_review_reason: needsReview ? "Suggestions IA à vérifier" : null,
  });
}

async function runThumbnail(documentId: number): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  const orig = await readOriginal(doc.storedFilename);
  if (!orig) throw new Error("fichier original introuvable");
  const thumb = await makeThumbnail(orig, mimeOf(doc), extOf(doc));
  await saveThumbnail(documentId, thumb);
  await patchDoc(documentId, { thumbnail_status: "ready" });
}

async function runPreview(documentId: number): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  const orig = await readOriginal(doc.storedFilename);
  if (!orig) throw new Error("fichier original introuvable");
  const preview = await makePreview(orig, mimeOf(doc), extOf(doc));
  if (preview) {
    await savePreview(documentId, preview);
    await patchDoc(documentId, { preview_status: "ready" });
  } else {
    await patchDoc(documentId, { preview_status: "skipped" });
  }
}

async function runIndex(documentId: number): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  await patchDoc(documentId, { index_status: "processing" });
  const maps = await loadNameMaps();
  await indexDocument(doc, maps.correspondents, maps.document_types, maps.tags);
  await patchDoc(documentId, { index_status: "ready" });
}

async function dispatchJob(job: PipelineJob): Promise<void> {
  switch (job.type) {
    case "ocr":
      return runOcr(job.documentId, job.payload?.fromImport === true);
    case "thumbnail":
      return runThumbnail(job.documentId);
    case "preview":
      return runPreview(job.documentId);
    case "index":
      return runIndex(job.documentId);
    case "ai":
      return runAi(job.documentId);
    default:
      throw new Error(`type de job inconnu : ${job.type}`);
  }
}

/** Exécute un job + persiste last_processed_at / last_error sur le document. */
export async function runJob(job: PipelineJob): Promise<void> {
  try {
    await dispatchJob(job);
    await patchDoc(job.documentId, { last_processed_at: new Date().toISOString(), last_error: null }).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patchDoc(job.documentId, { last_processed_at: new Date().toISOString(), last_error: msg.slice(0, 300) }).catch(() => {});
    throw e;
  }
}

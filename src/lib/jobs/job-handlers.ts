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
import { makeThumbnail } from "@/lib/engine/thumbnails";
import { makePreview } from "@/lib/engine/previews";
import { indexDocument } from "@/lib/engine/search";
import { loadNameMaps, mimeFromExt } from "@/lib/engine/helpers";
import type { PipelineJob } from "@/lib/jobs/job-store";

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
async function runOcr(documentId: number): Promise<void> {
  const doc = await loadDoc(documentId);
  if (!doc) throw new Error("document introuvable");
  const orig = await readOriginal(doc.storedFilename);
  if (!orig) throw new Error("fichier original introuvable");

  await patchDoc(documentId, { ocr_status: "processing" });
  const { text, pageCount } = await extractText(orig, mimeOf(doc), extOf(doc));
  const ocrStatus: EngineDocument["ocr_status"] = text.trim() ? "ready" : "skipped";
  await patchDoc(documentId, {
    content: text,
    page_count: pageCount ?? doc.page_count ?? null,
    ocr_status: ocrStatus,
    index_status: "processing",
  });

  // Réindexation du nouveau texte.
  const updated = await loadDoc(documentId);
  if (updated) {
    const maps = await loadNameMaps();
    await indexDocument(updated, maps.correspondents, maps.document_types, maps.tags).catch(() => {});
    await patchDoc(documentId, { index_status: "ready" });
  }
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

/** Exécute un job selon son type. Lève en cas d'échec (géré par le worker). */
export async function runJob(job: PipelineJob): Promise<void> {
  switch (job.type) {
    case "ocr":
      return runOcr(job.documentId);
    case "thumbnail":
      return runThumbnail(job.documentId);
    case "preview":
      return runPreview(job.documentId);
    case "index":
      return runIndex(job.documentId);
    case "ai":
      // Analyse IA : branchée ultérieurement (coût OpenAI). Job ignoré pour l'instant.
      throw new Error("type de job 'ai' non encore branché");
    default:
      throw new Error(`type de job inconnu : ${job.type}`);
  }
}

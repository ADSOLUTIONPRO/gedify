import "server-only";

import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  checksum,
  mutateList,
  nextId,
  readStore,
  saveOriginal,
  savePreview,
  saveThumbnail,
  thumbnailsDir,
  STORE,
  type EngineDocument,
} from "./stores";
import { extractText } from "./ocr";
import { normalizeOcrText } from "./normalize-ocr-text";
import { ocrMetaFields } from "./ocr-meta";
import { makeThumbnail } from "./thumbnails";
import { makePreview } from "./previews";
import { takePdfRenderError } from "./pdf";
import { dlog } from "./desktop-log";
import { indexDocument } from "./search";
import { baseName, loadNameMaps, mimeFromExt } from "./helpers";
import type { PaperlessTask } from "@/lib/paperless-types";

/* ────────────────────────────────────────────────────────────────────────
   Ingestion d'un fichier (remplace le « consumer » Paperless).
   Traitement SYNCHRONE (serveur Node persistant) : la tâche renvoyée est déjà
   SUCCESS/FAILURE, ce que le polling Gedify (/api/tasks/) lit immédiatement.
   ──────────────────────────────────────────────────────────────────────── */

export type ConsumeInput = {
  buffer: Buffer;
  filename: string;
  mime: string;
  title?: string | null;
  correspondent?: number | null;
  document_type?: number | null;
  tags?: number[];
  created?: string | null;
  custom_fields?: { field: number; value: unknown }[];
};

const MAX_TASKS = 500;

async function persistTask(task: PaperlessTask): Promise<void> {
  await mutateList<PaperlessTask>(STORE.tasks, (list) => [task, ...list.filter((t) => t.task_id !== task.task_id)].slice(0, MAX_TASKS));
}

function makeTask(
  taskId: string,
  filename: string,
  status: PaperlessTask["status"],
  result: string | null,
  relatedDocument: number | null,
): PaperlessTask {
  const now = new Date().toISOString();
  return {
    id: taskId,
    task_id: taskId,
    task_file_name: filename,
    date_created: now,
    date_done: status === "PENDING" || status === "STARTED" ? null : now,
    type: "file",
    status,
    result,
    acknowledged: false,
    related_document: relatedDocument,
  };
}

/**
 * Import asynchrone (miniature/aperçu/OCR/index/IA différés au worker) :
 * comportement PAR DÉFAUT désormais → l'import répond dès que le fichier est
 * écrit et le document créé ; tout l'enrichissement se fait en arrière-plan,
 * un job par document (un doc lent/en erreur ne bloque jamais les autres).
 *
 * Repli SYNCHRONE (historique) seulement si :
 *   - le worker est désactivé (GEDIFY_JOBS_WORKER=0), ou
 *   - on force GEDIFY_ASYNC_IMPORT=0/false/off.
 */
function asyncImportEnabled(): boolean {
  if (process.env.GEDIFY_JOBS_WORKER?.trim() === "0") return false;
  const v = process.env.GEDIFY_ASYNC_IMPORT?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

/** Analyse IA automatique après l'import (coût OpenAI). GEDIFY_AI_AUTO=1. */
function aiAutoEnabled(): boolean {
  const v = process.env.GEDIFY_AI_AUTO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

export async function consume(input: ConsumeInput): Promise<PaperlessTask> {
  const taskId = randomUUID();
  try {
    // Dédoublonnage par empreinte (comme Paperless refuse les doublons stricts).
    const sum = checksum(input.buffer);
    const existing = await readStore<EngineDocument[]>(STORE.documents, []);
    const dup = existing.find((d) => d.checksum === sum && !d.deleted);
    if (dup) {
      const task = makeTask(taskId, input.filename, "SUCCESS", `Document déjà présent (#${dup.id}).`, dup.id);
      await persistTask(task);
      return task;
    }

    // Accès SaaS : refuse si tenant suspendu / abonnement bloquant (no-op hors
    // multi-tenant). Puis quota documents + stockage. Les erreurs sont capturées
    // par le catch → tâche FAILURE avec message propre.
    if (process.env.MULTI_TENANT) {
      const { getActiveTenantId } = await import("@/lib/tenant/get-current-tenant");
      const tid = await getActiveTenantId();
      if (tid) {
        const { assertTenantCanUseSaas } = await import("@/lib/saas/subscriptions");
        await assertTenantCanUseSaas(tid);
      }
    }
    const { enforceDocumentQuota } = await import("@/lib/saas/quota");
    await enforceDocumentQuota(input.buffer.length);

    const id = await nextId("documents");
    const ext = path.extname(input.filename) || (input.mime ? extFromMimeSafe(input.mime) : "");
    const mime = input.mime || mimeFromExt(ext);
    const storedFilename = await saveOriginal(id, ext, input.buffer);

    // Mode PAR DÉFAUT : asynchrone (réponse immédiate, enrichissement en jobs).
    const asyncMode = asyncImportEnabled();

    // Statuts initiaux. En async : tout « en attente » → le worker complète.
    // En sync (worker off) : miniature/aperçu/OCR calculés inline (historique).
    let thumbnailStatus: EngineDocument["thumbnail_status"] = asyncMode ? "pending" : "failed";
    let thumbnailError: string | null = null;
    let previewStatus: EngineDocument["preview_status"] = asyncMode ? "pending" : "failed";
    const ocrStartIso = new Date().toISOString();
    let text = "";
    let pageCount: number | null = null;
    let ocrMeta: Partial<EngineDocument> = {};

    if (!asyncMode) {
      // Miniature (visuel immédiat).
      try {
        dlog(`import documentId=${id} source=${mime || ext}`);
        const thumb = await makeThumbnail(input.buffer, mime, ext);
        thumbnailError = takePdfRenderError(); // null si rendu OK ; code si placeholder
        dlog(`write thumbnail path=${path.join(thumbnailsDir(), `${id}.webp`)}`);
        await saveThumbnail(id, thumb);
        dlog(`write ok documentId=${id}${thumbnailError ? ` (placeholder, error=${thumbnailError})` : ""}`);
        thumbnailStatus = "ready";
      } catch (e) {
        thumbnailError = "thumbnail_write_failed";
        dlog(`error=thumbnail_write_failed ${e instanceof Error ? e.message : e}`);
      }
      // Aperçu (best-effort).
      try {
        const preview = await makePreview(input.buffer, mime, ext);
        if (preview) {
          await savePreview(id, preview);
          previewStatus = "ready";
        } else {
          previewStatus = "skipped";
        }
      } catch {
        /* aperçu best-effort */
      }
      // OCR inline (la seule étape lourde — bloque la réponse, mode legacy).
      const r = await extractText(input.buffer, mime, ext);
      text = normalizeOcrText(r.text);
      pageCount = r.pageCount;
      ocrMeta = ocrMetaFields(r, ocrStartIso);
    }

    const nowIso = new Date().toISOString();
    const created = input.created && input.created.trim() ? input.created : nowIso;
    const doc: EngineDocument = {
      id,
      title: input.title?.trim() || baseName(input.filename),
      content: text,
      created,
      created_date: created.slice(0, 10),
      added: nowIso,
      modified: nowIso,
      correspondent: input.correspondent ?? null,
      document_type: input.document_type ?? null,
      storage_path: null,
      tags: input.tags ?? [],
      archive_serial_number: null,
      original_file_name: input.filename,
      mime_type: mime,
      page_count: pageCount,
      notes: [],
      owner: 1,
      custom_fields: input.custom_fields ?? [],
      storedFilename,
      checksum: sum,
      archiveSize: input.buffer.length,
      deleted: false,
      deletedAt: null,
      import_status: "ready",
      thumbnail_status: thumbnailStatus,
      preview_status: previewStatus,
      thumbnail_error: thumbnailError,
      pages_status: "pending",
      ocr_status: asyncMode ? "pending" : text.trim() ? "ready" : "skipped",
      ai_status: "pending",
      index_status: "pending",
      classification_status:
        (input.correspondent ?? null) != null && (input.document_type ?? null) != null ? "ready" : "pending",
      archive_status: "skipped",
      ...ocrMeta,
      ocr_attempts: asyncMode ? 0 : 1,
      last_processed_at: nowIso,
    };
    await mutateList<EngineDocument>(STORE.documents, (list) => [doc, ...list]);

    if (asyncMode) {
      // Le document apparaît IMMÉDIATEMENT ; un job ISOLÉ par étape complète
      // ensuite en arrière-plan (un doc lent/en échec ne bloque pas les autres).
      // Priorités : miniature/aperçu (visuel rapide) → OCR (lourd) → index
      // (déclenché par le handler OCR) → IA (si GEDIFY_AI_AUTO, après l'OCR).
      try {
        const { enqueueJob } = await import("@/lib/jobs/job-store");
        const { kickJobWorker } = await import("@/lib/jobs/job-worker");
        await enqueueJob("thumbnail", id, { priority: 30 });
        await enqueueJob("preview", id, { priority: 35 });
        await enqueueJob("ocr", id, { priority: 40, payload: { fromImport: true } });
        kickJobWorker();
      } catch {
        /* worker indisponible → étapes relançables via Santé GED */
      }
    } else {
      const maps = await loadNameMaps();
      await indexDocument(doc, maps.correspondents, maps.document_types, maps.tags);
      // L'indexation vient de réussir → refléter le statut sur le document stocké.
      doc.index_status = "ready";
      await mutateList<EngineDocument>(STORE.documents, (list) =>
        list.map((d) => (d.id === id ? { ...d, index_status: "ready" } : d)),
      );

      // Règles automatiques (workflows) — best-effort, n'interrompt jamais l'import.
      try {
        const { runWorkflowsForDocument } = await import("@/lib/automation/workflow-engine");
        await runWorkflowsForDocument(id);
      } catch {
        /* moteur de règles indisponible → ignoré */
      }

      // Chaîne OCR → IA (si activée) : analyse en arrière-plan via la file de jobs.
      if (text.trim() && aiAutoEnabled()) {
        try {
          const { enqueueJob } = await import("@/lib/jobs/job-store");
          const { kickJobWorker } = await import("@/lib/jobs/job-worker");
          await enqueueJob("ai", id, { priority: 70 });
          kickJobWorker();
        } catch {
          /* worker indisponible → analyse relançable via Santé GED */
        }
      }
    }

    const task = makeTask(taskId, input.filename, "SUCCESS", `Nouveau document #${id} : ${doc.title}`, id);
    await persistTask(task);
    return task;
  } catch (e) {
    const task = makeTask(taskId, input.filename, "FAILURE", e instanceof Error ? e.message : String(e), null);
    await persistTask(task);
    return task;
  }
}

function extFromMimeSafe(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/tiff": ".tif",
    "text/plain": ".txt",
  };
  return map[mime] ?? "";
}

import "server-only";

import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  checksum,
  mutateList,
  nextId,
  readStore,
  saveOriginal,
  saveThumbnail,
  STORE,
  type EngineDocument,
} from "./stores";
import { extractText } from "./ocr";
import { makeThumbnail } from "./thumbnails";
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

    const id = await nextId("documents");
    const ext = path.extname(input.filename) || (input.mime ? extFromMimeSafe(input.mime) : "");
    const mime = input.mime || mimeFromExt(ext);
    const storedFilename = await saveOriginal(id, ext, input.buffer);

    const { text, pageCount } = await extractText(input.buffer, mime, ext);

    try {
      const thumb = await makeThumbnail(input.buffer, mime, ext);
      await saveThumbnail(id, thumb);
    } catch {
      /* miniature best-effort */
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
      deleted: false,
      deletedAt: null,
    };
    await mutateList<EngineDocument>(STORE.documents, (list) => [doc, ...list]);

    const maps = await loadNameMaps();
    await indexDocument(doc, maps.correspondents, maps.document_types, maps.tags);

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

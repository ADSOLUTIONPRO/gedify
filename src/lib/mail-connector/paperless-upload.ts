import "server-only";

import { paperlessFetchRaw } from "@/lib/paperless";

export type PaperlessUploadOptions = {
  title?: string;
  correspondent?: number | null;
  documentType?: number | null;
  tags?: number[];
  created?: string | null;
  archiveSerialNumber?: string | null;
};

export type PaperlessUploadResult = {
  ok: boolean;
  taskId: string | null;
  message: string;
};

export async function uploadAttachmentToPaperless(
  filename: string,
  contentType: string,
  content: ArrayBuffer | Uint8Array | Buffer,
  options: PaperlessUploadOptions = {},
): Promise<PaperlessUploadResult> {
  const form = new FormData();
  const buffer = Buffer.isBuffer(content)
    ? content
    : content instanceof Uint8Array
      ? Buffer.from(content)
      : Buffer.from(new Uint8Array(content));
  const blob = new Blob([new Uint8Array(buffer)], {
    type: contentType || "application/octet-stream",
  });
  form.append("document", blob, filename);

  if (options.title) form.append("title", options.title);
  if (options.correspondent !== undefined && options.correspondent !== null) {
    form.append("correspondent", String(options.correspondent));
  }
  if (options.documentType !== undefined && options.documentType !== null) {
    form.append("document_type", String(options.documentType));
  }
  if (options.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      form.append("tags", String(tag));
    }
  }
  if (options.created) form.append("created", options.created);
  if (options.archiveSerialNumber) {
    form.append("archive_serial_number", options.archiveSerialNumber);
  }

  try {
    const response = await paperlessFetchRaw("/api/documents/post_document/", {
      method: "POST",
      body: form,
    });
    // Le moteur renvoie désormais la tâche complète (objet JSON) ; on reste
    // compatible avec l'ancien format (chaîne UUID JSON) en lisant prudemment.
    const raw = (await response.text()).trim();
    let taskId: string | null = null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const t = parsed as { task_id?: unknown; id?: unknown };
        taskId = (typeof t.task_id === "string" ? t.task_id : typeof t.id === "string" ? t.id : null);
      } else if (typeof parsed === "string") {
        taskId = parsed;
      }
    } catch {
      taskId = raw.length > 0 ? raw.replace(/^"|"$/g, "") : null;
    }
    return {
      ok: true,
      taskId,
      message: "Document envoyé à Paperless.",
    };
  } catch (error) {
    return {
      ok: false,
      taskId: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

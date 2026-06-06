import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaperlessTaskResponse = {
  id?: string | number;
  uuid?: string;
  task_id?: string;
  task_file_name?: string;
  status?: string;
  result?: string;
  date_done?: string;
  related_document?: number | null;
};

/**
 * POST /api/documents/import
 *
 * Proxy d'import vers la GED + informations enrichies.
 * - Reçoit un FormData avec un champ `document` (fichier).
 * - Envoie au endpoint Gedify `/api/documents/post_document/`.
 * - Retourne le task_id Gedify + URL de consultation.
 * - PAPERLESS_TOKEN n'est jamais exposé côté client.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("document");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Aucun fichier reçu (champ `document`)." }, { status: 400 });
    }

    const paperlessFormData = new FormData();
    const fileName = file instanceof File ? file.name : "document";
    paperlessFormData.append("document", file, fileName);

    const task = await paperlessFetch<PaperlessTaskResponse>(
      "/api/documents/post_document/",
      { method: "POST", body: paperlessFormData },
    );

    const taskId = task?.task_id ?? task?.uuid ?? (typeof task?.id === "string" ? task.id : null);
    const documentId = typeof task?.related_document === "number" ? task.related_document : null;
    const failed = task?.status === "FAILURE";
    const aiEnabled = Boolean(process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "mock");

    // L'import répond DÈS que le fichier est écrit + le document créé. L'OCR,
    // l'indexation et l'IA se font en arrière-plan (file de jobs, un par document).
    return NextResponse.json({
      ok: !failed,
      taskId,
      documentId,
      fileName,
      status: failed ? "failed" : "imported",
      aiEnabled,
      message: failed
        ? (task?.result ?? "Import refusé par le moteur.")
        : "Fichier importé — traitement en arrière-plan.",
      error: failed ? (task?.result ?? "Import refusé.") : undefined,
      links: {
        documents: "/documents",
        ia: "/ia",
        aTraiter: "/a-traiter",
      },
    });
  } catch (error) {
    return jsonError("Import impossible — vérifiez la connexion Gedify.", error);
  }
}

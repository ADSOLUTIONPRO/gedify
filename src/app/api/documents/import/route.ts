import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";
import { linkProjectDocuments } from "@/lib/projects/project-store";
import { applyProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";

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
    // Contexte d'import : dossier Organiser cible (facultatif) + provenance.
    const folderId = (() => {
      const raw = formData.get("folderId");
      return typeof raw === "string" && raw.trim() ? raw.trim() : null;
    })();

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

    // Association au dossier Organiser — MÊME opération logique que l'import.
    // Le document n'est considéré « rangé » que si le lien est réellement écrit
    // (sinon on le signale au client : import OK mais classement à refaire).
    let folderLinked: boolean | null = folderId ? false : null;
    let folderName: string | null = null;
    let folderError: string | null = null;
    if (folderId && !failed && documentId != null) {
      try {
        const project = await linkProjectDocuments(folderId, [documentId]);
        if (project) {
          folderLinked = true;
          folderName = project.name;
          if (project.syncWithPaperlessTag) {
            await applyProjectPaperlessTag(project, [documentId]).catch(() => null);
          }
        } else {
          folderError = "Dossier introuvable — document importé mais non classé.";
        }
      } catch (e) {
        folderError = e instanceof Error ? e.message : "Association au dossier impossible.";
      }
    } else if (folderId && !failed && documentId == null) {
      folderError = "Document importé mais identifiant indisponible — classement à refaire.";
    }

    // L'import répond DÈS que le fichier est écrit + le document créé. L'OCR,
    // l'indexation et l'IA se font en arrière-plan (file de jobs, un par document).
    return NextResponse.json({
      ok: !failed,
      taskId,
      documentId,
      fileName,
      folderId,
      folderName,
      folderLinked,
      folderError: folderError ?? undefined,
      status: failed ? "failed" : "imported",
      aiEnabled,
      message: failed
        ? (task?.result ?? "Import refusé par le moteur.")
        : folderName
          ? `Importé dans « ${folderName} » — traitement en arrière-plan.`
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

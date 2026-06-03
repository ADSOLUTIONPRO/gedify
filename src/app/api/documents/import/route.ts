import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaperlessTaskResponse = {
  id?: string | number;
  uuid?: string;
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

    const taskId = task?.id ?? task?.uuid ?? null;
    const aiEnabled = Boolean(process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "mock");

    return NextResponse.json({
      ok: true,
      taskId,
      fileName,
      status: "imported",
      aiEnabled,
      message: "Document envoyé à Gedify. OCR et indexation en cours.",
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

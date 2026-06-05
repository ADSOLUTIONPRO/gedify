import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listJobs } from "@/lib/jobs/job-store";

/* État des jobs pipeline d'un document (lecture seule). Permet à la grille de
   savoir quand une régénération (miniature/aperçu) est terminée pour rafraîchir
   la vignette immédiatement. Auth assurée par le proxy de session global. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const docId = Number(id);
    if (!Number.isFinite(docId)) {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    const jobs = (await listJobs())
      .filter((j) => j.documentId === docId)
      .map((j) => ({ id: j.id, type: j.type, status: j.status, lastError: j.lastError, finishedAt: j.finishedAt }));
    return NextResponse.json({ jobs });
  } catch (error) {
    return jsonError("Impossible de lister les jobs du document", error);
  }
}

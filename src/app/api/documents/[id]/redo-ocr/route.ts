import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Relance l'OCR d'un document via l'opération groupée Gedify `redo_ocr`.
 * Le retraitement est asynchrone côté Gedify (file de tâches) — on renvoie
 * un statut « queued ». L'analyse IA pourra ensuite être relancée sur le nouvel OCR.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) {
    return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
  }

  try {
    await paperlessFetch(`/api/documents/bulk_edit/`, {
      method: "POST",
      body: { documents: [docId], method: "redo_ocr", parameters: {} },
    });
    return NextResponse.json({
      ok: true,
      status: "queued",
      message: "OCR relancé — le retraitement peut prendre quelques minutes.",
    });
  } catch (error) {
    return jsonError("Relance de l'OCR impossible", error);
  }
}

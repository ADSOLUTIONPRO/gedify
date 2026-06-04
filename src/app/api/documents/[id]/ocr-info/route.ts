import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Détails OCR d'un document (moteur, langue, longueur, confiance, qualité…). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const { id } = await params;
  const docId = Number(id);
  try {
    const docs = await readStore<EngineDocument[]>(STORE.documents, []);
    const d = docs.find((x) => x.id === docId && !x.deleted);
    if (!d) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    return NextResponse.json({
      ocr_status: d.ocr_status ?? null,
      ocr_source: d.ocr_source ?? null,
      ocr_engine: d.ocr_engine ?? null,
      ocr_language: d.ocr_language ?? null,
      ocr_confidence: d.ocr_confidence ?? null,
      ocr_quality: d.ocr_quality ?? null,
      ocr_text_length: d.ocr_text_length ?? (d.content ?? "").trim().length,
      ocr_pages_count: d.ocr_pages_count ?? d.page_count ?? null,
      ocr_finished_at: d.ocr_finished_at ?? null,
      ocr_attempts: d.ocr_attempts ?? null,
      index_status: d.index_status ?? null,
    });
  } catch (error) {
    return jsonError("Impossible de lire les détails OCR", error);
  }
}

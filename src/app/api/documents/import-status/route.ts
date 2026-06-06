import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────────
   GET /api/documents/import-status?ids=12,13,14

   Statut de traitement de plusieurs documents en un appel (suivi d'import côté
   frontend). Lit les statuts FINS déjà persistés sur chaque document par les
   handlers du pipeline (ocr/thumbnail/preview/index/ai). Aucun secret renvoyé.
   ──────────────────────────────────────────────────────────────────────── */

type Step =
  | "queued"
  | "processing"
  | "ocr_processing"
  | "indexing"
  | "ai_processing"
  | "completed"
  | "completed_with_warnings"
  | "failed";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Déduit l'étape courante + l'achèvement à partir des statuts du document.
 *  L'IA est OPTIONNELLE : un document est « terminé » dès l'OCR + l'index prêts,
 *  même si l'analyse IA a échoué (elle ne fait jamais échouer l'import). */
function deriveStep(d: EngineDocument): { step: Step; done: boolean } {
  const ocr = s(d.ocr_status);
  const ai = s(d.ai_status);
  const idx = s(d.index_status);
  const th = s(d.thumbnail_status);
  const pv = s(d.preview_status);

  // Échec dur d'une étape non-IA → document en erreur (relançable).
  if (ocr === "failed") return { step: "failed", done: true };

  // Étapes en cours (ordre de la chaîne).
  if (ocr === "processing") return { step: "ocr_processing", done: false };
  if (idx === "processing") return { step: "indexing", done: false };
  if (ai === "processing") return { step: "ai_processing", done: false };
  if (th === "pending" || th === "processing" || pv === "pending" || pv === "processing")
    return { step: "processing", done: false };

  // En attente (jobs pas encore démarrés).
  if (ocr === "pending" || ocr === "" || idx === "pending") return { step: "queued", done: false };

  // OCR + index aboutis → terminé (avec avertissement si miniature en placeholder).
  if (d.thumbnail_error) return { step: "completed_with_warnings", done: true };
  return { step: "completed", done: true };
}

const LABELS: Record<Step, string> = {
  queued: "Traitement en attente",
  processing: "Traitement en cours",
  ocr_processing: "OCR en cours",
  indexing: "Indexation en cours",
  ai_processing: "Analyse IA en cours",
  completed: "Terminé",
  completed_with_warnings: "Terminé (avertissements)",
  failed: "Traitement échoué",
};

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));

  if (ids.length === 0) return NextResponse.json({ ok: true, documents: [] });

  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const byId = new Map(docs.map((d) => [d.id, d]));

  const documents = ids.map((id) => {
    const d = byId.get(id);
    if (!d || d.deleted) return { id, found: false as const };
    const { step, done } = deriveStep(d);
    return {
      id,
      found: true as const,
      filename: d.original_file_name ?? d.title ?? null,
      uploadStatus: s(d.import_status) || "ready",
      thumbnailStatus: d.thumbnail_status ?? null,
      ocrStatus: d.ocr_status ?? null,
      indexStatus: d.index_status ?? null,
      aiStatus: d.ai_status ?? null,
      classificationStatus: d.classification_status ?? null,
      currentStep: step,
      label: LABELS[step],
      done,
      error: step === "failed" ? (d.last_error ?? "Traitement échoué.") : null,
      createdAt: d.added ?? null,
      updatedAt: d.modified ?? null,
    };
  });

  return NextResponse.json({ ok: true, documents });
}

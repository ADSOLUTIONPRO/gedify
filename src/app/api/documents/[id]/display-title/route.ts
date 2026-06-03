import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteTitleOverride,
  getTitleOverride,
  setTitleOverride,
} from "@/lib/documents/document-title-store";
import {
  buildDisplayMetadata,
} from "@/lib/documents/document-title-utils";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { getDocument } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const docId = parseId(id);
    if (!docId) return jsonError("Identifiant invalide", new Error("id"));

    const [doc, override, analysis] = await Promise.all([
      getDocument(docId),
      getTitleOverride(docId),
      getLatestAnalysisForDocument(docId),
    ]);

    const metadata = buildDisplayMetadata({ document: doc, override, analysis });
    return NextResponse.json(metadata);
  } catch (error) {
    return jsonError("Lecture du titre impossible", error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const docId = parseId(id);
    if (!docId) return jsonError("Identifiant invalide", new Error("id"));

    const body = (await req.json()) as { displayTitle?: unknown };
    const raw = typeof body.displayTitle === "string" ? body.displayTitle.trim() : "";
    if (raw.length < 1) {
      return jsonError("Le titre doit contenir au moins 1 caractère", new Error("displayTitle"));
    }
    if (raw.length > 240) {
      return jsonError("Le titre ne peut pas dépasser 240 caractères", new Error("displayTitle"));
    }

    const override = await setTitleOverride(docId, raw, "user", null, true);
    return NextResponse.json({ override });
  } catch (error) {
    return jsonError("Mise à jour du titre impossible", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const docId = parseId(id);
    if (!docId) return jsonError("Identifiant invalide", new Error("id"));

    await deleteTitleOverride(docId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Réinitialisation impossible", error);
  }
}

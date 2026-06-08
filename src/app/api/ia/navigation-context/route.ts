import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getReviewNavigation } from "@/lib/ai/ai-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ia/navigation-context?documentId=123
 * Contexte de navigation de la file de revue IA (précédent / suivant /
 * position / restants). Évite de transporter une liste d'identifiants dans
 * l'URL : la file est recalculée côté serveur à partir des analyses.
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("documentId");
    const documentId = raw ? Number(raw) : NaN;
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }
    const nav = await getReviewNavigation(documentId);
    return NextResponse.json(nav);
  } catch (error) {
    return jsonError("Contexte de navigation indisponible.", error);
  }
}

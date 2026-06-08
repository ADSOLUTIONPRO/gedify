import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { listLearningHistory, learningStats, type LearningField } from "@/lib/ai/learning-history-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/learning-history?documentId=&field=&corrected=1&stats=1
 * Historique d'apprentissage (valeur IA vs valeur validée par champ).
 */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get("stats") === "1") {
      return NextResponse.json({ stats: await learningStats() });
    }
    const documentId = sp.get("documentId") ? Number(sp.get("documentId")) : undefined;
    const field = (sp.get("field") as LearningField | null) ?? undefined;
    const events = await listLearningHistory({
      documentId: Number.isFinite(documentId) ? documentId : undefined,
      field,
      correctedOnly: sp.get("corrected") === "1",
      limit: Number(sp.get("limit") ?? "200") || 200,
    });
    return NextResponse.json({ events });
  } catch (error) {
    return jsonError("Historique d'apprentissage indisponible.", error);
  }
}

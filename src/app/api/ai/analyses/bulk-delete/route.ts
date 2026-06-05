import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAudit } from "@/lib/audit/audit-store";
import { deleteAnalysis } from "@/lib/ai/ai-analysis-store";
import { listDetectedInfos, deleteDetectedInfo } from "@/lib/ai/detected-info-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { ids?: string[] };
  try {
    body = (await request.json()) as { ids?: string[] };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requis (tableau non vide)." }, { status: 400 });
  }

  let deletedAnalyses = 0;
  let deletedInfos = 0;

  for (const id of ids) {
    const ok = await deleteAnalysis(id);
    if (ok) {
      deletedAnalyses++;
      // Supprimer aussi les detected infos liées à cette analyse
      const infos = await listDetectedInfos({ analysisId: id });
      for (const info of infos) {
        await deleteDetectedInfo(info.id);
        deletedInfos++;
      }
    }
  }

  await recordAudit({
    action: "ai.analyses.bulk_delete",
    target: `${deletedAnalyses} analyse(s)`,
    details: `${deletedAnalyses} analyse(s) + ${deletedInfos} info(s) détectée(s) supprimées`,
  });

  return NextResponse.json({ ok: true, deletedAnalyses, deletedInfos });
}

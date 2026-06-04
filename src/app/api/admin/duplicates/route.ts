import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import { findDuplicateGroups } from "@/lib/documents/duplicate-detection";
import { mergeDuplicates } from "@/lib/documents/duplicate-merge";

/* GET : liste des groupes de doublons (lecture seule).
   POST : fusion (conserve un maître, envoie les autres à la corbeille). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;
  try {
    const groups = await findDuplicateGroups();
    return NextResponse.json({ count: groups.length, groups });
  } catch (error) {
    return jsonError("Impossible de détecter les doublons", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requirePermission(request, "documents.delete");
  if (deny) return deny;
  try {
    const body = (await request.json()) as { keepId?: number; mergeIds?: number[] };
    const keepId = Number(body.keepId);
    const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds.map(Number).filter(Number.isFinite) : [];
    if (!Number.isFinite(keepId) || mergeIds.length === 0) {
      return jsonError("Paramètres invalides", "keepId / mergeIds requis", 400);
    }
    const result = await mergeDuplicates(keepId, mergeIds);
    if (result.ok) {
      await recordAudit({
        action: "duplicates.merge",
        target: `document#${keepId}`,
        details: `${result.mergedIds.length} fusionné(s) → corbeille`,
      });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return jsonError("Fusion des doublons impossible", error);
  }
}

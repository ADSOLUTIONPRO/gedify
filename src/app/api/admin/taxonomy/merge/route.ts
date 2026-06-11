import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import { mergeTaxonomy, type TaxonomyResource } from "@/lib/engine/taxonomy-merge";

/* Fusion de tags / correspondants / types : garde un maître, re-référence les
   documents, supprime les entrées fusionnées. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID = new Set<TaxonomyResource>(["tags", "correspondents", "document_types"]);

export async function POST(request: NextRequest) {
  const deny = await requirePermission(request, "documents.edit");
  if (deny) return deny;
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("taxonomy-merge"); if (g) return g;
  try {
    const body = (await request.json()) as { resource?: string; keepId?: number; mergeIds?: number[] };
    const resource = body.resource as TaxonomyResource;
    if (!VALID.has(resource)) return jsonError("Ressource invalide", `resource=${body.resource}`, 400);
    const keepId = Number(body.keepId);
    const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds.map(Number).filter(Number.isFinite) : [];
    if (!Number.isFinite(keepId) || mergeIds.length === 0) {
      return jsonError("Paramètres invalides", "keepId / mergeIds requis", 400);
    }
    const result = await mergeTaxonomy(resource, keepId, mergeIds);
    if (result.ok) {
      await recordAudit({
        action: `taxonomy.merge.${resource}`,
        target: `#${keepId}`,
        details: `${result.mergedIds.length} fusionné(s), ${result.affectedDocuments} doc(s)`,
      });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return jsonError("Fusion impossible", error);
  }
}

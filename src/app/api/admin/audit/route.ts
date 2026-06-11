import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import { listAudit } from "@/lib/audit/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;
  // Journal d'audit GLOBAL : superuser uniquement en multi-tenant (anti-fuite cross-tenant).
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("audit-global"); if (g) return g;
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 200;
    return NextResponse.json({ entries: await listAudit(limit) });
  } catch (error) {
    return jsonError("Impossible de lister le journal d'audit", error);
  }
}

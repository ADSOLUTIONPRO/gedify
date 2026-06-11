import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import { listUsers, publicUser } from "@/lib/engine/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "users.manage");
  if (deny) return deny;
  // Liste GLOBALE des comptes : superuser uniquement en multi-tenant.
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("users-global"); if (g) return g;
  try {
    const users = (await listUsers()).map(publicUser);
    return NextResponse.json({ users });
  } catch (error) {
    return jsonError("Impossible de lister les utilisateurs", error);
  }
}

import type { NextRequest } from "next/server";
import { proxyCollectionGet, proxyCollectionPost } from "@/lib/paperless-route-handlers";
import { userQuotaGate } from "@/lib/saas/quota";

const endpoint = "/api/users/";
const label = "les utilisateurs";

export async function GET(request: NextRequest) {
  // Liste GLOBALE des comptes moteur : superuser uniquement en multi-tenant.
  // Les owners clients voient leurs membres via la page (memberships), pas cet endpoint.
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("users-global"); if (g) return g;
  return proxyCollectionGet(request, endpoint, { label });
}

export async function POST(request: NextRequest) {
  // Quota SaaS : nombre d'utilisateurs du tenant courant (no-op hors multi-tenant).
  const denied = await userQuotaGate();
  if (denied) return denied;
  return proxyCollectionPost(request, endpoint, { label });
}

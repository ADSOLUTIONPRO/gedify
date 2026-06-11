import type { NextRequest } from "next/server";
import { proxyCollectionGet, proxyCollectionPost } from "@/lib/paperless-route-handlers";
import { userQuotaGate } from "@/lib/saas/quota";

const endpoint = "/api/users/";
const label = "les utilisateurs";

export async function GET(request: NextRequest) {
  return proxyCollectionGet(request, endpoint, { label });
}

export async function POST(request: NextRequest) {
  // Quota SaaS : nombre d'utilisateurs du tenant courant (no-op hors multi-tenant).
  const denied = await userQuotaGate();
  if (denied) return denied;
  return proxyCollectionPost(request, endpoint, { label });
}

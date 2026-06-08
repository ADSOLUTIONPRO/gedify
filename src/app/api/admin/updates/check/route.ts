import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkForUpdate } from "@/lib/admin/update-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/updates/check — vérifie GHCR/manifeste (sans rien installer). */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const state = await checkForUpdate();
    return NextResponse.json({ state });
  } catch (error) {
    return jsonError("Vérification des mises à jour impossible.", error);
  }
}

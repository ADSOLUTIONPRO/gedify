import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listFavoriteIds } from "@/lib/documents/favorites-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/documents/favorites — ids des documents favoris de l'utilisateur. */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const ids = await listFavoriteIds(user ? String(user.id) : "local");
    return NextResponse.json({ ids });
  } catch (error) {
    return jsonError("Favoris indisponibles.", error);
  }
}

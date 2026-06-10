import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPinnedIds } from "@/lib/documents/pins-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/documents/pins — ids des documents épinglés de l'utilisateur. */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const ids = await listPinnedIds(user ? String(user.id) : "local");
    return NextResponse.json({ ids });
  } catch (error) {
    return jsonError("Documents épinglés indisponibles.", error);
  }
}

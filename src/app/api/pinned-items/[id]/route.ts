import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { removePin } from "@/lib/dashboard/pinned-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/pinned-items/:id — retire une épingle. `id` peut être l'id de
 * l'épingle OU l'id du dossier (entityId) pour simplifier le « dé-épinglage »
 * depuis l'en-tête d'un dossier.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const uid = user ? String(user.id) : "local";
    const { id } = await params;
    const ok = await removePin(uid, { id }) || await removePin(uid, { entityType: "folder", entityId: id }) || await removePin(uid, { entityType: "project", entityId: id });
    return NextResponse.json({ ok });
  } catch (error) {
    return jsonError("Retrait de l'épingle impossible.", error);
  }
}

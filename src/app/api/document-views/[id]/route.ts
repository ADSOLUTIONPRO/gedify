import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteView, updateView } from "@/lib/documents/saved-views-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function uid(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

/** PATCH /api/document-views/:id — renommer / épingler / mettre à jour les filtres. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const { id } = await params;
    const patch = (await req.json().catch(() => ({}))) as { name?: string; description?: string; query?: string; isPinned?: boolean };
    const view = await updateView(u, id, patch);
    if (!view) return NextResponse.json({ error: "Vue introuvable." }, { status: 404 });
    return NextResponse.json({ view });
  } catch (error) {
    return jsonError("Mise à jour impossible.", error);
  }
}

/** DELETE /api/document-views/:id */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const { id } = await params;
    const ok = await deleteView(u, id);
    if (!ok) return NextResponse.json({ error: "Vue introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression impossible.", error);
  }
}

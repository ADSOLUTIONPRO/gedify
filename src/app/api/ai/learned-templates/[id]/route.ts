import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { removeLearnedTemplate, updateLearnedTemplate } from "@/lib/ai/learned-templates-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { active?: boolean; label?: string };
    const patch: { active?: boolean; label?: string } = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
    const item = await updateLearnedTemplate(id, patch);
    if (!item) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Modification du modèle impossible", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const ok = await removeLearnedTemplate(id);
    if (!ok) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression du modèle impossible", error);
  }
}

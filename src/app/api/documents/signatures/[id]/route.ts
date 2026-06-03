import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { removeSavedSignature } from "@/lib/documents/saved-signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const ok = await removeSavedSignature(id);
    if (!ok) return NextResponse.json({ error: "Signature introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression de la signature impossible", error);
  }
}

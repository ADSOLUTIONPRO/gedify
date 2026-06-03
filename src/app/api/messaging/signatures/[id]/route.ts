import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { deleteSignature, updateSignature } from "@/lib/messaging/email-signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const body = (await request.json()) as { name?: string; html?: string; mailbox?: string | null; isDefault?: boolean };
    const updated = await updateSignature(id, body);
    if (!updated) return NextResponse.json({ error: "Signature introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true, signature: updated });
  } catch (error) {
    return jsonError("Mise à jour de la signature impossible", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    await deleteSignature(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression de la signature impossible", error);
  }
}

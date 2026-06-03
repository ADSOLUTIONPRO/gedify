import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { cancelScheduledEmail } from "@/lib/messaging/scheduled-email-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const ok = await cancelScheduledEmail(id);
    if (!ok) return NextResponse.json({ error: "Envoi programmé introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Annulation de l'envoi programmé impossible", error);
  }
}

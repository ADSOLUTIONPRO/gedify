import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { createSignature, listSignatures } from "@/lib/messaging/email-signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json({ signatures: await listSignatures() });
  } catch (error) {
    return jsonError("Lecture des signatures impossible", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const body = (await request.json()) as { name?: string; html?: string; mailbox?: string | null; isDefault?: boolean };
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Nom de signature requis." }, { status: 400 });
    }
    const sig = await createSignature({
      name: body.name,
      html: body.html ?? "",
      mailbox: body.mailbox ?? null,
      isDefault: body.isDefault,
    });
    return NextResponse.json({ ok: true, signature: sig });
  } catch (error) {
    return jsonError("Création de la signature impossible", error);
  }
}

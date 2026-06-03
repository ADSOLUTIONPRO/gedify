import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { createSavedSignature, listSavedSignatures, type SavedSignatureKind } from "@/lib/documents/saved-signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const signatures = await listSavedSignatures();
    return NextResponse.json({ signatures });
  } catch (error) {
    return jsonError("Liste des signatures impossible", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const body = (await request.json()) as { kind?: SavedSignatureKind; name?: string; dataUrl?: string };
    if (!body.dataUrl) {
      return NextResponse.json({ error: "dataUrl manquant." }, { status: 400 });
    }
    const signature = await createSavedSignature({ kind: body.kind ?? "signature", name: body.name, dataUrl: body.dataUrl });
    return NextResponse.json({ signature }, { status: 201 });
  } catch (error) {
    return jsonError("Enregistrement de la signature impossible", error);
  }
}

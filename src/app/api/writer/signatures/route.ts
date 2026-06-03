import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  createSignature,
  listSignatures,
} from "@/lib/writer/signature-store";
import type { WriterSignatureInput } from "@/lib/writer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const signatures = await listSignatures();
    return NextResponse.json({ signatures });
  } catch (error) {
    return jsonError("Impossible de lister les signatures", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WriterSignatureInput;
    if (!body.dataUrl) {
      return NextResponse.json({ error: "dataUrl manquant" }, { status: 400 });
    }
    const signature = await createSignature(body);
    return NextResponse.json({ signature }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible d'enregistrer la signature", error);
  }
}

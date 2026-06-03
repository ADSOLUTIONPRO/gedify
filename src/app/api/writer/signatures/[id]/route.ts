import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteSignature,
  getSignature,
  readSignatureFile,
  setDefaultSignature,
} from "@/lib/writer/signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const signature = await getSignature(id);
    if (!signature) {
      return NextResponse.json({ error: "Signature introuvable" }, { status: 404 });
    }
    if (request.nextUrl.searchParams.get("download") === "1") {
      const buffer = await readSignatureFile(id);
      if (!buffer) {
        return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
      }
      return new Response(buffer as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": signature.contentType,
          "Content-Disposition": `inline; filename="${signature.fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.json({ signature });
  } catch (error) {
    return jsonError("Impossible de récupérer la signature", error);
  }
}

export async function PATCH(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const updated = await setDefaultSignature(id);
    if (!updated) {
      return NextResponse.json({ error: "Signature introuvable" }, { status: 404 });
    }
    return NextResponse.json({ signature: updated });
  } catch (error) {
    return jsonError("Impossible de définir la signature par défaut", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteSignature(id);
    if (!ok) {
      return NextResponse.json({ error: "Signature introuvable" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer la signature", error);
  }
}

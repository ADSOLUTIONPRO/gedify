import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  buildEditorConfig,
  getOnlyOfficeServerUrl,
  isOnlyOfficeConfigured,
} from "@/lib/writer/onlyoffice-config";
import { getWriterDocument } from "@/lib/writer/writer-store";
import { featureGate } from "@/lib/saas/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const denied = await featureGate("onlyoffice");
    if (denied) return denied;
    const { id } = await ctx.params;
    const document = await getWriterDocument(id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    if (!isOnlyOfficeConfigured()) {
      return NextResponse.json(
        {
          error: "ONLYOFFICE non configuré",
          message:
            "Définissez ONLYOFFICE_DOCUMENT_SERVER_URL côté serveur pour activer l'édition en ligne.",
        },
        { status: 503 },
      );
    }

    const mode = request.nextUrl.searchParams.get("mode") === "view" ? "view" : "edit";
    const config = await buildEditorConfig(document, { mode });

    return NextResponse.json({
      serverUrl: getOnlyOfficeServerUrl(),
      config,
    });
  } catch (error) {
    return jsonError("Impossible de générer la configuration ONLYOFFICE", error);
  }
}

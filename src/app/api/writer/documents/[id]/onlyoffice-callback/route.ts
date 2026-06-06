import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getOnlyOfficeJwtSecret,
  verifyDocAccessToken,
  verifyOnlyOfficeToken,
} from "@/lib/writer/onlyoffice-config";
import {
  getWriterDocument,
  replaceWriterDocumentContent,
} from "@/lib/writer/writer-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ONLYOFFICE callback status codes
// 0: editing not started / no document found
// 1: document is being edited
// 2: document is ready for saving (no users)
// 3: document saving error has occurred
// 4: document is closed with no changes
// 6: document is being edited, but the current version is saved
// 7: error has occurred while force saving

type CallbackPayload = {
  key?: string;
  status?: number;
  url?: string;
  token?: string;
  forcesavetype?: number;
  users?: string[];
};

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    // Jeton d'accès serveur (oo_token) : ONLYOFFICE n'a pas de session navigateur.
    const ooToken = request.nextUrl.searchParams.get("oo_token");
    if (ooToken && !(await verifyDocAccessToken(ooToken, id, "callback"))) {
      console.warn(`[ONLYOFFICE] callback docId=${id} : oo_token invalide → 401`);
      return NextResponse.json({ error: 1, message: "Jeton d'accès invalide" }, { status: 401 });
    }

    const document = await getWriterDocument(id);
    if (!document) {
      console.warn(`[ONLYOFFICE] callback docId=${id} : document introuvable → 404`);
      return NextResponse.json({ error: 1 }, { status: 404 });
    }

    const payload = (await request.json()) as CallbackPayload;
    console.log(`[ONLYOFFICE] callback docId=${id} status=${payload.status ?? "?"}`);

    // Verify JWT when ONLYOFFICE_JWT_SECRET is set.
    if (getOnlyOfficeJwtSecret()) {
      const token =
        payload.token ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) {
        return NextResponse.json({ error: 1, message: "JWT manquant" }, { status: 401 });
      }
      try {
        await verifyOnlyOfficeToken(token);
      } catch {
        return NextResponse.json({ error: 1, message: "JWT invalide" }, { status: 401 });
      }
    }

    const status = payload.status ?? 0;

    // Save when ready (status 2) or forced save (status 6).
    if ((status === 2 || status === 6) && payload.url) {
      try {
        const fileResponse = await fetch(payload.url);
        if (!fileResponse.ok) {
          return NextResponse.json(
            { error: 1, message: `Téléchargement du document modifié impossible (HTTP ${fileResponse.status})` },
            { status: 200 },
          );
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        await replaceWriterDocumentContent(id, Buffer.from(arrayBuffer));
      } catch (error) {
        return NextResponse.json(
          { error: 1, message: error instanceof Error ? error.message : "Sauvegarde impossible" },
          { status: 200 },
        );
      }
    }

    // ONLYOFFICE expects { error: 0 } as success.
    return NextResponse.json({ error: 0 });
  } catch (error) {
    return jsonError("Callback ONLYOFFICE impossible", error);
  }
}

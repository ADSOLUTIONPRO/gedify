import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { loadAttachments, type AttachmentOrigin } from "@/lib/messaging/load-attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liste paginée des pièces jointes d'un onglet (reçues / envoyées), pour le
 * « Voir plus » indépendant par onglet de la page « Pièces jointes ».
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const origin: AttachmentOrigin = url.searchParams.get("origin") === "sent" ? "sent" : "inbox";
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25, 50);
    const pageToken = url.searchParams.get("pageToken") ?? undefined;

    const result = await loadAttachments(origin, limit, pageToken);
    if (!result.connected) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Gmail connecté." },
        { status: 412 },
      );
    }

    return NextResponse.json({
      origin,
      rows: result.rows,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    return jsonError("Lecture des pièces jointes impossible", error);
  }
}

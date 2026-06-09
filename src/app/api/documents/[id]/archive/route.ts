import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { recordAudit } from "@/lib/audit/audit-store";
import { setArchived, isArchived } from "@/lib/documents/archived-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Archive / désarchive un document (statut GEDify). Body: { archived: boolean }. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { archived?: boolean };
    const archived = body.archived !== false; // défaut : archiver
    await setArchived(documentId, archived);
    await recordAudit({ action: archived ? "document.archive" : "document.unarchive", target: `#${documentId}` }).catch(() => {});
    return NextResponse.json({ success: true, documentId, archived });
  } catch (error) {
    return jsonError("Archivage impossible", error);
  }
}

/** État d'archive d'un document. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const documentId = Number(id);
    return NextResponse.json({ documentId, archived: await isArchived(documentId) });
  } catch (error) {
    return jsonError("Lecture du statut d'archive impossible", error);
  }
}

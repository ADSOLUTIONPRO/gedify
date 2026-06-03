import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { syncDeletedPaperlessDocuments } from "@/lib/documents/sync-deleted-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const report = await syncDeletedPaperlessDocuments();
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return jsonError("Erreur lors de la synchronisation des suppressions Gedify", error);
  }
}

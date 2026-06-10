import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessListResponse } from "@/lib/paperless-types";
import { cleanupDocumentData } from "@/lib/documents/cleanup-document-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_CONFIRM = "EMPTY_TRASH";

type TrashItem = { id: number; title?: string };

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { confirm?: string };
  try {
    body = (await request.json()) as { confirm?: string };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (body.confirm !== EXPECTED_CONFIRM) {
    return NextResponse.json(
      { error: `Confirmation manquante. Envoyez { "confirm": "${EXPECTED_CONFIRM}" }.` },
      { status: 400 },
    );
  }

  try {
    // 1. Récupérer tous les éléments de la corbeille
    const trashData = await paperlessFetch<PaperlessListResponse<TrashItem>>("/api/trash/", {
      searchParams: { page_size: 500 },
    });
    const items = trashData.results ?? [];
    const ids = items.map((item) => item.id);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, emptied: 0, cleanup: null });
    }

    // 2. Vider la corbeille côté Gedify
    await paperlessFetch<unknown>("/api/trash/", {
      method: "POST",
      body: { action: "empty", documents: ids },
    });

    // 3. Nettoyer les données liées dans Gedify
    const cleanupTotals = { aiAnalyses: 0, detectedInfos: 0, financialItems: 0, actions: 0, reminders: 0 };
    for (const id of ids) {
      const cleanup = await cleanupDocumentData(Number(id), { forceDeleteValidated: true });
      cleanupTotals.aiAnalyses += cleanup.aiAnalysesDeleted;
      cleanupTotals.detectedInfos += cleanup.detectedInfosDeleted;
      cleanupTotals.financialItems += cleanup.financialItemsDeleted + cleanup.financialItemsDetached;
      cleanupTotals.actions += cleanup.actionsDeleted + cleanup.actionsDetached;
      cleanupTotals.reminders += cleanup.remindersDeleted + cleanup.remindersDetached;
    }

    return NextResponse.json({ ok: true, emptied: ids.length, cleanup: cleanupTotals });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Impossible de vider la corbeille Gedify", details: msg }, { status: 502 });
  }
}

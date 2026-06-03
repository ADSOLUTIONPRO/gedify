import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { paperlessFetch } from "@/lib/paperless";
import { cleanupDocumentData } from "@/lib/documents/cleanup-document-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_CONFIRM = "DELETE_PERMANENTLY";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { documentIds?: number[]; confirm?: string };
  try {
    body = (await request.json()) as { documentIds?: number[]; confirm?: string };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (body.confirm !== EXPECTED_CONFIRM) {
    return NextResponse.json(
      { error: `Confirmation manquante. Envoyez { "confirm": "${EXPECTED_CONFIRM}" }.` },
      { status: 400 },
    );
  }

  const documentIds = body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json(
      { error: "documentIds requis (tableau non vide)." },
      { status: 400 },
    );
  }

  const results: { id: number; ok: boolean; error?: string }[] = [];
  const cleanupTotals = { aiAnalyses: 0, detectedInfos: 0, financialItems: 0, actions: 0, reminders: 0 };

  for (const id of documentIds) {
    try {
      await paperlessFetch<unknown>("/api/trash/", {
        method: "POST",
        body: { action: "empty", documents: [Number(id)] },
      });
      // Nettoyage des données liées dans la surcouche
      const cleanup = await cleanupDocumentData(Number(id), { forceDeleteValidated: true });
      cleanupTotals.aiAnalyses += cleanup.aiAnalysesDeleted;
      cleanupTotals.detectedInfos += cleanup.detectedInfosDeleted;
      cleanupTotals.financialItems += cleanup.financialItemsDeleted + cleanup.financialItemsDetached;
      cleanupTotals.actions += cleanup.actionsDeleted + cleanup.actionsDetached;
      cleanupTotals.reminders += cleanup.remindersDeleted + cleanup.remindersDetached;
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ ok: failed === 0, succeeded, failed, results, cleanup: cleanupTotals });
}

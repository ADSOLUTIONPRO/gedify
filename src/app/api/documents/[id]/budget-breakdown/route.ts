import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { paperlessProxyError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { readSession } from "@/lib/auth/session";
import { resolveClassification } from "@/lib/ai/resolve-classification";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { createFinancialItem } from "@/lib/budget/financial-item-store";
import { toBudgetMonth } from "@/lib/budget/budget-periods";
import { KIND_TO_DIRECTION, type FinancialItem, type FinancialItemStatus, type FinancialKind } from "@/lib/budget/financial-item-types";
import { getDocument, getPaperlessPublicUrl } from "@/lib/paperless";
import { appendGedLog } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Une ligne de la « Répartition des montants » envoyée par la Fiche IA. */
type BreakdownLine = {
  label?: string;
  amount?: number;
  currency?: string;
  kind?: FinancialKind;
  status?: FinancialItemStatus;
  date?: string | null;
  correspondentName?: string | null;
  /** Inclure cette ligne au budget (les lignes non incluses sont ignorées). */
  include?: boolean;
};

/**
 * Crée une entrée budget (`FinancialItem`) par ligne « incluse » de la
 * répartition des montants. Résout le correspondant par nom (anti-doublon),
 * relie l'item au document + à l'analyse, journalise. Ne modifie jamais
 * l'original ; les items sont marqués `needs_review` pour validation.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { lines?: BreakdownLine[] };
    const lines = (body.lines ?? []).filter((l) => l.include && typeof l.amount === "number" && l.amount !== 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "no_lines", message: "Aucune ligne à inclure au budget." }, { status: 400 });
    }

    const [doc, analysis] = await Promise.all([
      getDocument(documentId).catch(() => null),
      getLatestAnalysisForDocument(documentId),
    ]);
    const baseUrl = getPaperlessPublicUrl();
    const docTitle = doc?.title ?? `Document ${documentId}`;

    // Résolution des correspondants par nom (cache pour éviter les appels répétés).
    const corrCache = new Map<string, number | null>();
    async function resolveCorr(name: string | null | undefined): Promise<number | null> {
      const key = (name ?? "").trim();
      if (!key) return null;
      if (corrCache.has(key)) return corrCache.get(key) ?? null;
      const resolved = await resolveClassification({ correspondentName: key }).catch(() => null);
      const cid = resolved?.correspondent?.id ?? null;
      corrCache.set(key, cid);
      return cid;
    }

    const created: FinancialItem[] = [];
    for (const line of lines) {
      const kind = (line.kind ?? "other") as FinancialKind;
      const status = (line.status ?? "to_review") as FinancialItemStatus;
      const date = line.date ?? null;
      const correspondentId = await resolveCorr(line.correspondentName);
      const isDue = status === "unpaid" || status === "overdue" || status === "scheduled";

      const item = await createFinancialItem({
        sourceDocumentId: documentId,
        sourceDocumentTitle: docTitle,
        sourcePaperlessUrl: baseUrl ? `${baseUrl}/documents/${documentId}` : null,
        sourceAnalysisId: analysis?.id ?? null,
        kind,
        direction: KIND_TO_DIRECTION[kind] ?? "neutral",
        label: line.label?.trim() || docTitle,
        amount: line.amount as number,
        currency: line.currency || "EUR",
        documentDate: date,
        dueDate: isDue ? date : null,
        budgetMonth: toBudgetMonth(date) ?? toBudgetMonth(new Date()),
        correspondentId,
        correspondentName: line.correspondentName?.trim() || null,
        status,
        validationStatus: "needs_review",
        isAiDetected: true,
        aiProvider: analysis?.provider ?? null,
      });
      created.push(item);
    }

    const session = await readSession();
    await appendGedLog({
      level: "success",
      source: "GED",
      documentId,
      user: session?.username ?? null,
      message: `Répartition des montants créée — ${session?.username ?? "système"} — ${created.length} ligne(s) au budget`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    return paperlessProxyError("Création des lignes de budget impossible", error);
  }
}

import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { listFinancialItems, updateFinancialItem } from "@/lib/budget/financial-item-store";
import { aggregateFinances, resolveFinanceBucket } from "@/lib/budget/finance-bucket";
import type { FinancialItem } from "@/lib/budget/financial-item-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Anomaly = { id: string; label: string; type: string; detail: string };

/** Détecte les incohérences financières (§22). Catégorie exclusive garantie par
 *  resolveFinanceBucket ; on cherche surtout les statuts/dates contradictoires. */
function analyze(items: FinancialItem[]): Anomaly[] {
  const now = Date.now();
  const out: Anomaly[] = [];
  for (const i of items) {
    const remaining = i.amountRemaining ?? Math.max(0, i.amount - (i.amountPaid ?? 0));
    if (i.status === "paid" && remaining > 0.01) {
      out.push({ id: i.id, label: i.label, type: "paid_with_remaining", detail: `Payé mais restant dû ${remaining.toFixed(2)}` });
    }
    const dueTime = i.dueDate ? new Date(i.dueDate).getTime() : null;
    if (i.paymentStatus === "overdue" && (dueTime === null || dueTime >= now)) {
      out.push({ id: i.id, label: i.label, type: "overdue_without_past_due", detail: "Statut en retard sans échéance dépassée" });
    }
    if (i.dueDate && i.documentDate && new Date(i.dueDate).getTime() < new Date(i.documentDate).getTime() - 86_400_000) {
      out.push({ id: i.id, label: i.label, type: "due_before_document", detail: "Échéance antérieure à la date du document" });
    }
    if (resolveFinanceBucket(i, now) === null && i.status !== "cancelled" && i.status !== "ignored" && i.validationStatus !== "rejected" && i.validationStatus !== "ignored") {
      out.push({ id: i.id, label: i.label, type: "no_bucket", detail: "Ligne active sans catégorie" });
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const items = await listFinancialItems();
    const anomalies = analyze(items);
    return NextResponse.json({
      analyzed: items.length,
      anomalies,
      aggregates: aggregateFinances(items),
    });
  } catch (error) {
    return jsonError("Diagnostic financier impossible", error);
  }
}

/** Réparation conservatrice : les lignes ambiguës passent « À contrôler »
 *  (validationStatus=needs_review) plutôt que classées arbitrairement (§7, §22). */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const items = await listFinancialItems();
    const anomalies = analyze(items);
    const toFix = new Set(anomalies.filter((a) => a.type !== "due_before_document").map((a) => a.id));
    let repaired = 0;
    for (const id of toFix) {
      const updated = await updateFinancialItem(id, { validationStatus: "needs_review", status: "to_review" });
      if (updated) repaired += 1;
    }
    const after = await listFinancialItems();
    return NextResponse.json({
      repaired,
      remainingAnomalies: analyze(after).length,
      aggregates: aggregateFinances(after),
    });
  } catch (error) {
    return jsonError("Réparation financière impossible", error);
  }
}

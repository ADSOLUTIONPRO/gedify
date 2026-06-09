import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAudit } from "@/lib/audit/audit-store";
import { getFinancialItem, deleteFinancialItem, listFinancialItems } from "@/lib/budget/financial-item-store";
import { aggregateFinances } from "@/lib/budget/finance-bucket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { ids?: string[] };
  try {
    body = (await request.json()) as { ids?: string[] };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requis (tableau non vide)." }, { status: 400 });
  }

  let deleted = 0;
  let skipped = 0;

  for (const id of ids) {
    const item = await getFinancialItem(id);
    if (!item) { skipped++; continue; }
    // Ne jamais supprimer une ligne validée / payée via cette route
    const isValidated =
      item.validationStatus === "validated" ||
      item.status === "paid" ||
      item.status === "partially_paid";
    if (isValidated) { skipped++; continue; }
    await deleteFinancialItem(id);
    deleted++;
  }

  await recordAudit({
    action: "budget.bulk_delete",
    target: `${deleted} ligne(s)`,
    details: `${deleted} supprimée(s), ${skipped} ignorée(s) (validées/payées préservées)`,
  });

  // Agrégats recalculés (catégories exclusives) pour mise à jour immédiate (§9).
  const aggregates = aggregateFinances(await listFinancialItems());
  return NextResponse.json({ ok: true, deleted, skipped, aggregates });
}

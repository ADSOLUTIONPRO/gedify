import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { CorrespondentFinanceSummary } from "@/components/finances/correspondent-finance-summary";
import { getAllCorrespondentsFinancialSummary } from "@/lib/budget/budget-calculations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Correspondants — Finances" };

export default async function FinancesCorrespondantsPage() {
  const rows = await getAllCorrespondentsFinancialSummary();
  return (
    <SpaceLayout spaceId="finances">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Sommes dues, payées et restantes par correspondant, avec montant en retard et prochaine échéance.
      </p>
      <CorrespondentFinanceSummary rows={rows} />
    </SpaceLayout>
  );
}

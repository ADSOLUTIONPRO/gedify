import type { Metadata } from "next";
import Link from "next/link";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { listFinancialItems } from "@/lib/budget/financial-item-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents financiers — Finances" };

type Search = Promise<{ filtre?: string }>;

export default async function FinancesDocumentsPage({ searchParams }: { searchParams: Search }) {
  const { filtre } = await searchParams;
  const all = await listFinancialItems();
  const aiItems = all.filter((i) => i.isAiDetected);

  const items =
    filtre === "valides"
      ? aiItems.filter((i) => i.validationStatus === "validated")
      : filtre === "rejetes"
      ? aiItems.filter((i) => i.validationStatus === "rejected" || i.validationStatus === "ignored")
      : filtre === "controler"
      ? aiItems.filter((i) => i.validationStatus === "needs_review" || i.status === "to_review")
      : aiItems;

  const tabs = [
    { k: "", label: "Tous" },
    { k: "controler", label: "À contrôler" },
    { k: "valides", label: "Validés" },
    { k: "rejetes", label: "Rejetés" },
  ];

  const total = items.reduce((s, i) => s + (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)), 0);

  return (
    <SpaceLayout spaceId="finances">
      <FinancePageHeader title="Documents financiers" description="Lignes détectées par l'IA — contrôlez et validez celles qui demandent une vérification." count={items.length} countNoun="ligne" total={total} totalLabel="à traiter" />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = (filtre ?? "") === t.k;
          return (
            <Link
              key={t.k}
              href={t.k ? `/finances/documents?filtre=${t.k}` : "/finances/documents"}
              className="h-8 rounded-lg border px-3 text-[12.5px] font-semibold leading-8 transition"
              style={active ? { background: "rgba(124,58,237,0.10)", borderColor: "#7C3AED", color: "#6D28D9" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        Lignes financières détectées par l&apos;IA. Seules les détections peu fiables sont marquées « À contrôler » ; validez-les pour les classer définitivement.
      </p>
      <FinancialItemsTable items={items} emptyLabel="Aucun document financier détecté." allowPayment />
    </SpaceLayout>
  );
}

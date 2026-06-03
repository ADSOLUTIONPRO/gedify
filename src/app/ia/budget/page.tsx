import type { Metadata } from "next";
import Link from "next/link";
import { SpaceLayout } from "@/components/layout/space-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Coins } from "lucide-react";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Budget détecté — Analyse IA" };

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const KIND_LABEL: Record<string, string> = {
  income: "Revenu",
  expense: "Dépense",
  debt: "Dette",
  due: "Échéance",
  refund: "Remboursement",
  invoice: "Facture",
  subscription: "Abonnement",
  tax: "Impôt",
  allowance: "Prestation",
  benefit: "Prestation",
};

export default async function IABudgetPage() {
  const withFinancial = (await listAnalyses()).filter((a) => a.financialImpact.length > 0);

  return (
    <SpaceLayout spaceId="ia">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          Impacts financiers détectés par l&apos;IA. Chaque proposition est créée en statut « à contrôler » dans Finances.
        </p>
        <Link href="/budget" className="shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "#16A34A" }}>
          Ouvrir Finances
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {withFinancial.length === 0 ? (
        <EmptyState icon={Coins} title="Aucun impact financier détecté" description="Les factures, échéances et dettes détectées apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {withFinancial.map((a) => (
            <Link
              key={a.id}
              href={`/ia/document/${a.documentId}`}
              className="block rounded-xl border bg-white p-3 transition hover:-translate-y-0.5"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 shrink-0" style={{ color: "#16A34A" }} strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
                  {a.suggestedTitle?.trim() || `Document #${a.documentId}`}
                </span>
                <span className="ml-auto shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(a.updatedAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {a.financialImpact.slice(0, 4).map((f, i) => (
                  <span key={i} className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: "rgba(22,163,74,0.10)", color: "#15803D" }}>
                    {KIND_LABEL[f.kind] ?? f.kind} · {formatAmount(f.amount, f.currency)}
                    {f.dueDate ? ` · éch. ${formatDate(f.dueDate)}` : ""}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </SpaceLayout>
  );
}

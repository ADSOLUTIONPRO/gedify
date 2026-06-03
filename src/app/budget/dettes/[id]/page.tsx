import Link from "next/link";
import { CalendarClock, Coins, FileText, History } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getDebt } from "@/lib/budget/budget-store";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DebtDetailPage({ params }: Props) {
  const { id } = await params;
  const debt = await getDebt(id);

  if (!debt) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/budget/dettes", label: "Dettes" }}
          eyebrow="Dette"
          title="Dette introuvable"
        />
        <ErrorState message="Aucune dette avec cet identifiant." />
      </main>
    );
  }

  const progress =
    debt.initialAmount > 0
      ? Math.round(((debt.initialAmount - debt.remainingAmount) / debt.initialAmount) * 100)
      : 0;

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/budget/dettes", label: "Dettes" }}
        eyebrow="Dette"
        title={debt.label}
        description={`Créancier : ${debt.creditor || "non renseigné"}`}
      />

      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reste à payer</p>
            <p className="text-3xl font-extrabold text-amber-700">
              {debt.remainingAmount.toFixed(2)} {debt.currency}
            </p>
            <p className="text-xs text-slate-500">
              sur {debt.initialAmount.toFixed(2)} {debt.currency} initial
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progression</p>
            <p className="text-3xl font-extrabold text-emerald-700">{progress}%</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={Coins} title="Informations">
          <MetadataGrid
            items={[
              { label: "Statut", value: debt.status },
              { label: "Priorité", value: debt.priority },
              { label: "Échéance", value: debt.dueDate ? new Date(debt.dueDate).toLocaleDateString("fr-FR") : "—" },
              { label: "Début", value: debt.startDate ? new Date(debt.startDate).toLocaleDateString("fr-FR") : "—" },
              { label: "Fin", value: debt.endDate ? new Date(debt.endDate).toLocaleDateString("fr-FR") : "—" },
              { label: "Mensualité", value: debt.monthlyPayment ? `${debt.monthlyPayment.toFixed(2)} ${debt.currency}` : "—" },
            ]}
          />
        </SectionCard>

        <SectionCard icon={FileText} title="Documents liés">
          {debt.documentIds.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun document lié.</p>
          ) : (
            <ul className="space-y-1">
              {debt.documentIds.map((docId) => (
                <li key={docId}>
                  <Link
                    href={`/documents/${docId}`}
                    className="text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Document #{docId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={History} title={`Historique paiements (${debt.payments.length})`}>
          {debt.payments.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun paiement enregistré. Ajoutez-en via POST /api/budget/debts/{debt.id}/payments.</p>
          ) : (
            <ul className="space-y-2">
              {debt.payments.map((payment) => (
                <li key={payment.id} className="rounded-xl border border-slate-200/60 bg-white/70 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {payment.amount.toFixed(2)} {debt.currency}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(payment.date).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {payment.notes ? <p className="text-xs text-slate-500">{payment.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={CalendarClock} title="Notes">
          {debt.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{debt.notes}</p>
          ) : (
            <p className="text-sm text-slate-500">Aucune note.</p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

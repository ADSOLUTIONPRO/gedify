import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvoice } from "@/lib/saas/billing/invoice-service";
import { issueInvoiceAction, markPaidAction, voidInvoiceAction, createCreditNoteAction } from "./actions";

export const dynamic = "force-dynamic";

function money(c: unknown, cur = "EUR"): string { return `${(Number(c ?? 0) / 100).toFixed(2)} ${cur}`; }
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ invoiceId: string }>; searchParams: Promise<{ error?: string; updated?: string; created?: string }> }) {
  const { invoiceId } = await params;
  const { error, updated, created } = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/billing/invoices", label: "Factures" },
    { label: invoiceId.slice(0, 8) },
  ];

  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Facture" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const data = await getInvoice(invoiceId).catch(() => null);
  if (!data) return <PageShell><PageHeader breadcrumb={breadcrumb} title="Facture introuvable" /><SectionCard title="Introuvable"><p className="text-sm text-slate-600">Aucune facture.</p></SectionCard></PageShell>;

  const inv = data.invoice;
  const cur = (inv.currency as string) ?? "EUR";
  const status = String(inv.status ?? "draft");
  const isDraft = status === "draft";
  const isCredit = inv.type === "credit_note";

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={`${isCredit ? "Avoir" : "Facture"} ${(inv.invoice_number as string) ?? "(brouillon)"}`} description={`Tenant ${inv.tenant_id} · statut ${status}`} />
      {created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Créée.</div> : null}
      {updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Mise à jour.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">{error}</div> : null}

      <SectionCard icon={FileText} title="Détails">
        <MetadataGrid columns={3} items={[
          { label: "Numéro", value: <code className="font-mono text-[12px]">{(inv.invoice_number as string) ?? "(brouillon)"}</code> },
          { label: "Type", value: String(inv.type ?? "invoice") },
          { label: "Statut", value: status },
          { label: "Émise le", value: date(inv.issue_date) },
          { label: "Échéance", value: date(inv.due_date) },
          { label: "Client", value: String(inv.buyer_name ?? inv.tenant_id) },
          { label: "Total HT", value: money(inv.subtotal_ht_cents, cur) },
          { label: "TVA", value: money(inv.tax_cents, cur) },
          { label: "Total TTC", value: money(inv.total_ttc_cents, cur) },
        ]} />
      </SectionCard>

      <SectionCard icon={FileText} title="Lignes" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
              <th className="px-4 py-2">Désignation</th><th className="px-4 py-2 text-right">Qté</th><th className="px-4 py-2 text-right">PU HT</th><th className="px-4 py-2 text-right">TVA</th><th className="px-4 py-2 text-right">Total HT</th>
            </tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={String(l.id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2">{String(l.description ?? "")}</td>
                  <td className="px-4 py-2 text-right">{String(l.quantity)}</td>
                  <td className="px-4 py-2 text-right">{money(l.unit_price_ht_cents, cur)}</td>
                  <td className="px-4 py-2 text-right">{l.vat_rate != null ? `${l.vat_rate}%` : "—"}</td>
                  <td className="px-4 py-2 text-right">{money(l.total_ht_cents, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="Actions">
        <div className="flex flex-wrap items-center gap-2">
          {inv.invoice_number ? (
            <>
              <Link href={`/admin/saas/billing/invoices/${invoiceId}/html`} target="_blank" className="h-9 rounded-lg border px-3 text-[12px] font-semibold leading-9" style={{ borderColor: "var(--border)" }}>Voir HTML</Link>
              <Link href={`/admin/saas/billing/invoices/${invoiceId}/pdf`} target="_blank" className="h-9 rounded-lg border px-3 text-[12px] font-semibold leading-9" style={{ borderColor: "var(--border)" }}>Télécharger PDF</Link>
            </>
          ) : null}
          {isDraft ? (
            <form action={issueInvoiceAction}><input type="hidden" name="id" value={invoiceId} /><button className="h-9 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Émettre</button></form>
          ) : null}
          {!isDraft && status !== "paid" && !isCredit ? (
            <form action={markPaidAction}><input type="hidden" name="id" value={invoiceId} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "#86EFAC", color: "#15803D" }}>Marquer payée</button></form>
          ) : null}
          {!isDraft && !isCredit ? (
            <form action={createCreditNoteAction}><input type="hidden" name="id" value={invoiceId} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Créer un avoir</button></form>
          ) : null}
          {status !== "void" ? (
            <form action={voidInvoiceAction}><input type="hidden" name="id" value={invoiceId} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Annuler</button></form>
          ) : null}
        </div>
      </SectionCard>
    </PageShell>
  );
}

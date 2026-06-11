import { AlertTriangle, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listInvoices } from "@/lib/saas/subscriptions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Facturation" },
];

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2)} ${currency ?? "EUR"}`;
}

export default async function SaasBillingPage() {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Facturation" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }

  const invoices = await listInvoices().catch(() => []);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Facturation" description="Factures et paiements. Alimenté par Stripe une fois branché." />
      <SectionCard icon={Receipt} title={`Factures (${invoices.length})`} bodyClassName={invoices.length ? "p-0" : "p-5"}>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune facture pour l&apos;instant. Les factures apparaîtront ici une fois Stripe branché (ou via facturation manuelle).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-2.5">Tenant</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5 text-right">Dû</th>
                  <th className="px-4 py-2.5 text-right">Payé</th>
                  <th className="px-4 py-2.5">Provider</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2.5 font-mono text-[12px]">{inv.tenantId}</td>
                    <td className="px-4 py-2.5">{inv.status ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{money(inv.amountDue, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-right">{money(inv.amountPaid, inv.currency)}</td>
                    <td className="px-4 py-2.5">{inv.provider}</td>
                    <td className="px-4 py-2.5">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("fr-FR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

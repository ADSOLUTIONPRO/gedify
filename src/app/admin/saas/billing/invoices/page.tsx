import Link from "next/link";
import { FilePlus2, FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SuperAdminHero } from "@/components/admin-ui";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listInvoices } from "@/lib/saas/billing/invoice-service";
import { listTenants } from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Factures" },
];

function money(c: unknown, cur = "EUR"): string { return `${(Number(c ?? 0) / 100).toFixed(2)} ${cur}`; }
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Brouillon", bg: "#F1F5F9", fg: "#475569" },
  issued: { label: "Émise", bg: "#DBEAFE", fg: "#1D4ED8" },
  paid: { label: "Payée", bg: "#DCFCE7", fg: "#15803D" },
  void: { label: "Annulée", bg: "#FEE2E2", fg: "#B91C1C" },
  unpaid: { label: "Impayée", bg: "#FEF3C7", fg: "#B45309" },
};

export default async function InvoicesListPage() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Factures" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const [invoices, tenants] = await Promise.all([listInvoices().catch(() => []), listTenants().catch(() => [])]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));

  return (
    <PageShell>
      <SuperAdminHero
        breadcrumb={breadcrumb}
        eyebrow="Administration SaaS"
        title="Factures"
        subtitle="Factures et avoirs émis pour les clients."
        icon={<FileText className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />}
        actions={<Link href="/admin/saas/billing/invoices/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><FilePlus2 className="h-4 w-4" />Nouvelle facture</Link>}
      />

      <SectionCard icon={FileText} title={`${invoices.length} document(s)`} bodyClassName="p-0">
        {invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune facture pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Numéro</th><th className="px-4 py-2">Client</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Émise</th><th className="px-4 py-2 text-right">Total TTC</th><th className="px-4 py-2">Statut</th>
              </tr></thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = STATUS[String(inv.status ?? "draft")] ?? STATUS.draft;
                  return (
                    <tr key={String(inv.id)} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-4 py-2">
                        <Link href={`/admin/saas/billing/invoices/${inv.id}`} className="font-mono text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>
                          {(inv.invoice_number as string) ?? "(brouillon)"}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{tName.get(String(inv.tenant_id)) ?? String(inv.tenant_id)}</td>
                      <td className="px-4 py-2">{inv.type === "credit_note" ? "Avoir" : "Facture"}</td>
                      <td className="px-4 py-2">{date(inv.issue_date)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{money(inv.total_ttc_cents, (inv.currency as string) ?? "EUR")}</td>
                      <td className="px-4 py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

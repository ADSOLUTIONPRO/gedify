import Link from "next/link";
import { AlertTriangle, Building2, FilePlus2, FileText, LayoutTemplate, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { AdminNavGrid, AdminNavTile } from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listInvoices } from "@/lib/saas/billing/invoice-service";
import { getDefaultBillingProfile, billingProfileIssues } from "@/lib/saas/billing/profile-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Facturation" },
];

function money(c: unknown, cur = "EUR"): string { return `${(Number(c ?? 0) / 100).toFixed(2)} ${cur}`; }
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

const LINKS = [
  { href: "/admin/saas/billing/profile", icon: Building2, title: "Profil émetteur", desc: "Coordonnées et mentions légales de l'entreprise.", tone: "navy" as const },
  { href: "/admin/saas/billing/invoices", icon: FileText, title: "Factures", desc: "Liste des factures et avoirs.", tone: "navy" as const },
  { href: "/admin/saas/billing/invoices/new", icon: FilePlus2, title: "Nouvelle facture", desc: "Créer une facture manuelle.", tone: "pink" as const },
  { href: "/admin/saas/billing/templates", icon: LayoutTemplate, title: "Modèles", desc: "Gabarits de mise en page.", tone: "navy" as const },
];

export default async function SaasBillingPage() {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Facturation" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Facturation" />
        <SectionCard icon={AlertTriangle} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard>
      </PageShell>
    );
  }

  const [invoices, profile] = await Promise.all([listInvoices().catch(() => []), getDefaultBillingProfile().catch(() => null)]);
  const issues = billingProfileIssues(profile);
  const recent = invoices.slice(0, 8);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Facturation" description="Factures, avoirs et mentions légales (génération HTML/PDF)." />

      {issues.length > 0 ? (
        <Link href="/admin/saas/billing/profile" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <span>Profil émetteur incomplet : {issues.join(" ")} — cliquez pour compléter.</span>
        </Link>
      ) : null}

      <AdminNavGrid columns={4}>
        {LINKS.map((l) => (
          <AdminNavTile key={l.href} href={l.href} icon={l.icon} title={l.title} desc={l.desc} tone={l.tone} />
        ))}
      </AdminNavGrid>

      <SectionCard icon={Receipt} title={`Factures récentes (${invoices.length})`} bodyClassName={recent.length ? "p-0" : "p-5"}>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune facture pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Numéro</th><th className="px-4 py-2">Tenant</th><th className="px-4 py-2">Émise</th><th className="px-4 py-2 text-right">Total TTC</th><th className="px-4 py-2">Statut</th>
              </tr></thead>
              <tbody>
                {recent.map((inv) => (
                  <tr key={String(inv.id)} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2"><Link href={`/admin/saas/billing/invoices/${inv.id}`} className="font-mono text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>{(inv.invoice_number as string) ?? "(brouillon)"}</Link></td>
                    <td className="px-4 py-2 font-mono text-[12px]">{String(inv.tenant_id)}</td>
                    <td className="px-4 py-2">{date(inv.issue_date)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{money(inv.total_ttc_cents, (inv.currency as string) ?? "EUR")}</td>
                    <td className="px-4 py-2">{String(inv.status ?? "draft")}</td>
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

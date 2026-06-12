import Link from "next/link";
import { Receipt } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { requireTenantMember } from "@/lib/auth/guards";
import { listInvoices } from "@/lib/saas/billing/invoice-service";
import { SettingsSubPage } from "@/components/settings/settings-ui";

export const dynamic = "force-dynamic";

function money(c: unknown, cur = "EUR"): string { return `${(Number(c ?? 0) / 100).toFixed(2)} ${cur}`; }
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function SettingsBillingPage() {
  const ctx = await requireTenantMember();
  // Cloisonné : uniquement les factures de CE tenant.
  const invoices = await listInvoices(ctx.tenantId).catch(() => []);

  return (
    <SettingsSubPage title="Mes factures" subtitle="Factures émises pour votre espace.">
      <SectionCard icon={Receipt} title={`${invoices.length} facture(s)`} bodyClassName="p-0">
        {invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune facture pour le moment. <Link href="/settings/myplan" style={{ color: "var(--accent)" }}>Voir mon offre</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Numéro</th><th className="px-4 py-2">Émise</th><th className="px-4 py-2 text-right">Total TTC</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={String(inv.id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2 font-mono text-[12px]">{(inv.invoice_number as string) ?? "(brouillon)"}</td>
                    <td className="px-4 py-2">{date(inv.issue_date)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{money(inv.total_ttc_cents, (inv.currency as string) ?? "EUR")}</td>
                    <td className="px-4 py-2">{String(inv.status ?? "draft")}</td>
                    <td className="px-4 py-2 text-right">
                      {inv.invoice_number ? <a href={`/admin/saas/billing/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>PDF ↗</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <p className="text-[12px] text-slate-500">Le téléchargement PDF/HTML est sécurisé : seul le propriétaire de l&apos;espace y accède.</p>
    </SettingsSubPage>
  );
}

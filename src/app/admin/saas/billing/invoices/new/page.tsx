import { AlertTriangle, FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { listTenants } from "@/lib/tenant/tenant-store";
import { getDefaultBillingProfile } from "@/lib/saas/billing/profile-store";
import { createInvoiceFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/billing/invoices", label: "Factures" },
  { label: "Nouvelle" },
];
const cls = "h-9 w-full rounded-lg border px-2 text-[13px]";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [tenants, profile] = await Promise.all([listTenants().catch(() => []), getDefaultBillingProfile()]);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Nouvelle facture" description="Facture manuelle (brouillon). L'émission fige le numéro et génère HTML/PDF." />
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">{error}</div> : null}
      {!profile ? <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Configurez d&apos;abord le profil émetteur.</span></div> : null}

      <SectionCard icon={FilePlus2} title="Facture manuelle">
        <form action={createInvoiceFormAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-[12px] sm:col-span-2">
              <span className="font-semibold" style={{ color: "var(--text-main)" }}>Client</span>
              <select name="tenantId" required className={cls} style={{ borderColor: "var(--border)" }}>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.id} ({t.slug})</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">TVA (%)</span><input name="vatRate" type="number" defaultValue={profile?.defaultVatRate ?? 20} className={cls} style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Remise (€)</span><input name="discount" className={cls} placeholder="0" style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Période début</span><input name="periodStart" type="date" className={cls} style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Période fin</span><input name="periodEnd" type="date" className={cls} style={{ borderColor: "var(--border)" }} /></label>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-bold" style={{ color: "var(--text-main)" }}>Lignes (description · quantité · PU HT €)</div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_120px] gap-2">
                <input name={`line${i}_desc`} placeholder={`Désignation ${i + 1}`} className={cls} style={{ borderColor: "var(--border)" }} />
                <input name={`line${i}_qty`} placeholder="1" className={cls} style={{ borderColor: "var(--border)" }} />
                <input name={`line${i}_pu`} placeholder="0,00" className={cls} style={{ borderColor: "var(--border)" }} />
              </div>
            ))}
          </div>

          <button type="submit" className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Créer le brouillon</button>
        </form>
      </SectionCard>
    </PageShell>
  );
}

import Link from "next/link";
import { LayoutTemplate, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SuperAdminHero } from "@/components/admin-ui";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listInvoiceTemplates } from "@/lib/saas/billing/invoice-template-store";
import { setDefaultTemplateAction, duplicateTemplateAction, deleteTemplateAction, seedDefaultTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/billing", label: "Facturation" },
  { label: "Modèles" },
];

export default async function InvoiceTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Modèles" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const templates = await listInvoiceTemplates();

  return (
    <PageShell>
      <SuperAdminHero
        breadcrumb={breadcrumb}
        eyebrow="Administration SaaS"
        title="Modèles de facture"
        subtitle="Gabarits de mise en page des factures PDF/HTML (couleurs, logo, en-tête, pied de page)."
        icon={<LayoutTemplate className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />}
        actions={<Link href="/admin/saas/billing/templates/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><Plus className="h-4 w-4" />Nouveau modèle</Link>}
      />
      {sp.ok || sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Modèles mis à jour.</div> : null}

      {templates.length === 0 ? (
        <SectionCard icon={LayoutTemplate} title="Aucun modèle">
          <p className="text-sm text-slate-600">Un gabarit intégré est appliqué par défaut. Créez un modèle pour le personnaliser.</p>
          <form action={seedDefaultTemplateAction} className="mt-3"><button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Créer le modèle standard</button></form>
        </SectionCard>
      ) : (
        <SectionCard icon={LayoutTemplate} title={`${templates.length} modèle(s)`} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Nom</th><th className="px-4 py-2">Défaut</th><th className="px-4 py-2">Langue</th><th className="px-4 py-2">Devise</th><th className="px-4 py-2">Couleur</th><th className="px-4 py-2">Logo</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2"><Link href={`/admin/saas/billing/templates/${t.id}`} className="font-semibold" style={{ color: "var(--blue-600)" }}>{t.name}</Link></td>
                    <td className="px-4 py-2">{t.isDefault ? "★" : "—"}</td>
                    <td className="px-4 py-2">{t.locale}</td>
                    <td className="px-4 py-2">{t.currency}</td>
                    <td className="px-4 py-2"><span className="inline-block h-4 w-4 rounded" style={{ background: t.primaryColor ?? "#0E7490" }} /></td>
                    <td className="px-4 py-2">{t.showLogo ? "Oui" : "Non"}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link href={`/admin/saas/billing/templates/${t.id}`} className="h-7 rounded border px-2 text-[11px] font-semibold leading-7" style={{ borderColor: "var(--border)" }}>Éditer</Link>
                        {!t.isDefault ? <form action={setDefaultTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Défaut</button></form> : null}
                        <form action={duplicateTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Dupliquer</button></form>
                        {!t.isDefault ? <form action={deleteTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Suppr.</button></form> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <p className="text-[12px] text-slate-500">Les factures déjà émises conservent leur mise en page (snapshot) : modifier un modèle n&apos;altère pas les factures passées.</p>
    </PageShell>
  );
}

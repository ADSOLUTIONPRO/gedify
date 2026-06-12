import Link from "next/link";
import { LayoutTemplate, ShieldCheck, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvoiceTemplate } from "@/lib/saas/billing/invoice-template-store";
import { updateTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const inp = "h-9 w-full rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const VARS = [
  "invoice.number", "invoice.issue_date", "invoice.due_date", "seller.company_name", "seller.siret", "seller.vat_number",
  "seller.iban", "buyer.name", "buyer.vat_number", "lines", "totals.subtotal_ht", "totals.tax", "totals.total_ttc",
  "legal.payment_terms", "legal.vat_mention", "legal.footer",
];

function Bool({ name, def, label }: { name: string; def: boolean; label: string }) {
  return <label className="space-y-1 text-[12px]"><span className="font-semibold">{label}</span><select name={name} defaultValue={def ? "1" : "0"} className={inp} style={bd}><option value="1">Oui</option><option value="0">Non</option></select></label>;
}

export default async function EditInvoiceTemplatePage({ params, searchParams }: { params: Promise<{ templateId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { templateId } = await params;
  const sp = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/billing/templates", label: "Modèles" },
    { label: templateId.slice(0, 8) },
  ];
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Modèle" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const t = await getInvoiceTemplate(templateId);
  if (!t) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Introuvable" /><SectionCard icon={LayoutTemplate} title="Introuvable"><p className="text-sm text-slate-600">Modèle inexistant.</p></SectionCard></PageShell>;
  }

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={`Modèle — ${t.name}`} description="Personnalisation de la facture. Aperçu avec données fictives (sans numéro)." />
      {sp.saved || sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Modèle enregistré.</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={LayoutTemplate} title="Réglages">
          <form action={updateTemplateAction} className="space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[12px] sm:col-span-2"><span className="font-semibold">Nom</span><input name="name" defaultValue={t.name} className={inp} style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Langue</span><input name="locale" defaultValue={t.locale} className={inp} style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Devise</span><input name="currency" defaultValue={t.currency} className={inp} style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Couleur principale</span><input name="primaryColor" type="color" defaultValue={t.primaryColor ?? "#0E7490"} className="h-9 w-full rounded-lg border" style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Couleur secondaire</span><input name="secondaryColor" type="color" defaultValue={t.secondaryColor ?? "#64748b"} className="h-9 w-full rounded-lg border" style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Police</span><input name="fontFamily" defaultValue={t.fontFamily ?? ""} placeholder="Arial, Helvetica" className={inp} style={bd} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Position logo</span><select name="logoPosition" defaultValue={t.logoPosition ?? "left"} className={inp} style={bd}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
              <Bool name="showLogo" def={t.showLogo} label="Afficher logo" />
              <Bool name="showPaymentDetails" def={t.showPaymentDetails} label="Afficher IBAN/BIC" />
              <Bool name="showLegalFooter" def={t.showLegalFooter} label="Pied de page légal" />
              <Bool name="showQrCode" def={t.showQrCode} label="QR code" />
            </div>
            <label className="block space-y-1 text-[12px]"><span className="font-semibold">En-tête HTML (optionnel, sans JS)</span><textarea name="headerHtml" defaultValue={t.headerHtml ?? ""} rows={2} className="w-full rounded-lg border p-2 text-[12px] font-mono" style={bd} /></label>
            <label className="block space-y-1 text-[12px]"><span className="font-semibold">Pied de page HTML (optionnel)</span><textarea name="footerHtml" defaultValue={t.footerHtml ?? ""} rows={2} className="w-full rounded-lg border p-2 text-[12px] font-mono" style={bd} /></label>
            <label className="block space-y-1 text-[12px]"><span className="font-semibold">CSS personnalisé (optionnel)</span><textarea name="customCss" defaultValue={t.customCss ?? ""} rows={3} className="w-full rounded-lg border p-2 text-[12px] font-mono" style={bd} /></label>
            <div className="flex flex-wrap gap-2">
              <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Enregistrer</button>
              <Link href={`/admin/saas/billing/templates/${t.id}/preview`} target="_blank" className="h-9 rounded-xl border px-4 text-[13px] font-semibold leading-9" style={bd}>Aperçu plein écran</Link>
              <Link href={`/admin/saas/billing/templates/${t.id}/preview?format=pdf`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold" style={bd}><FileText className="h-4 w-4" />PDF test</Link>
            </div>
            <p className="text-[11px] text-slate-500">Le HTML/CSS est nettoyé (scripts et <code className="font-mono">javascript:</code> supprimés). Enregistrez pour rafraîchir l&apos;aperçu.</p>
          </form>

          <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
            <div className="mb-1.5 text-[11px] font-bold uppercase text-slate-500">Variables disponibles</div>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => <code key={v} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{`{{${v}}}`}</code>)}
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={FileText} title="Aperçu (données fictives)" bodyClassName="p-0">
          <iframe src={`/admin/saas/billing/templates/${t.id}/preview`} title="Aperçu modèle" sandbox="" className="h-[680px] w-full rounded-b-2xl" style={{ border: "0" }} />
        </SectionCard>
      </div>
    </PageShell>
  );
}

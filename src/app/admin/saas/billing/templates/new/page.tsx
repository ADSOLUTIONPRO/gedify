import { LayoutTemplate, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas/billing/templates", label: "Modèles" },
  { label: "Nouveau" },
];
const inp = "h-9 w-full rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };

export default async function NewInvoiceTemplatePage() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Nouveau modèle" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Nouveau modèle de facture" description="Créez un gabarit, puis personnalisez-le (couleurs, en-tête, CSS) et prévisualisez." />
      <SectionCard icon={LayoutTemplate} title="Nouveau modèle">
        <form action={createTemplateAction} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[12px] sm:col-span-2"><span className="font-semibold">Nom</span><input name="name" required className={inp} style={bd} placeholder="Mon modèle" /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Langue</span><input name="locale" defaultValue="fr-FR" className={inp} style={bd} /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Devise</span><input name="currency" defaultValue="EUR" className={inp} style={bd} /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Couleur principale</span><input name="primaryColor" type="color" defaultValue="#0E7490" className="h-9 w-full rounded-lg border" style={bd} /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Afficher logo</span><select name="showLogo" defaultValue="1" className={inp} style={bd}><option value="1">Oui</option><option value="0">Non</option></select></label>
          <div className="sm:col-span-2"><button className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Créer et personnaliser</button></div>
        </form>
      </SectionCard>
    </PageShell>
  );
}

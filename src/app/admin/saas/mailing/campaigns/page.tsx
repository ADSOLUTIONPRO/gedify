import { Megaphone, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SuperAdminHero } from "@/components/admin-ui";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCampaigns } from "@/lib/saas/mailing/campaigns";
import { listTemplates } from "@/lib/saas/mailing/template-store";
import { createCampaignAction, sendCampaignAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/mailing", label: "Mailing" },
  { label: "Campagnes" },
];

const cls = "h-9 w-full rounded-lg border px-2 text-[13px]";
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Campagnes" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const [campaigns, templates] = await Promise.all([listCampaigns(), listTemplates()]);
  const marketingTemplates = templates.filter((t) => t.category === "marketing" || t.isMarketing);

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Campagnes d'emailing" subtitle="Envoi groupé aux espaces clients (owner de chaque tenant)." icon={<Megaphone className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />
      {sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Campagne créée.</div> : null}
      {sp.sent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.sent} email(s) mis en file.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <SectionCard icon={Plus} title="Nouvelle campagne">
        <form action={createCampaignAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Nom</span><input name="name" required className={cls} style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]">
              <span className="font-semibold">Modèle (marketing)</span>
              <select name="templateKey" className={cls} style={{ borderColor: "var(--border)" }}>
                <option value="">— contenu libre —</option>
                {marketingTemplates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[12px]">
              <span className="font-semibold">Audience</span>
              <select name="scope" className={cls} style={{ borderColor: "var(--border)" }}>
                <option value="all">Tous les clients</option>
                <option value="plan">Par plan</option>
                <option value="status">Par statut</option>
              </select>
            </label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Valeur (plan/statut)</span><input name="audienceValue" placeholder="free, pro, active…" className={cls} style={{ borderColor: "var(--border)" }} /></label>
          </div>
          <label className="block space-y-1 text-[12px]"><span className="font-semibold">Objet (si contenu libre)</span><input name="subject" className={cls} style={{ borderColor: "var(--border)" }} /></label>
          <label className="block space-y-1 text-[12px]"><span className="font-semibold">Contenu HTML (si contenu libre)</span><textarea name="htmlBody" rows={4} className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} /></label>
          <button className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Créer (brouillon)</button>
        </form>
      </SectionCard>

      <SectionCard icon={Megaphone} title={`Campagnes (${campaigns.length})`} bodyClassName="p-0">
        {campaigns.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune campagne.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Nom</th><th className="px-4 py-2">Audience</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 text-right">Envoyés</th><th className="px-4 py-2">Créée</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2 font-semibold">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600">{c.audience?.scope}{c.audience?.value ? `: ${c.audience.value}` : ""}</td>
                    <td className="px-4 py-2">{c.status}</td>
                    <td className="px-4 py-2 text-right">{c.sentCount}</td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{date(c.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {c.status === "draft" ? (
                        <form action={sendCampaignAction}><input type="hidden" name="id" value={c.id} /><button className="h-8 rounded-lg px-2.5 text-[11px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Envoyer</button></form>
                      ) : null}
                    </td>
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

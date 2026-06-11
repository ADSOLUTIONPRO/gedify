import { Clock, MessageSquareText, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listSlaPolicies } from "@/lib/saas/support/sla";
import { listCannedReplies } from "@/lib/saas/support/canned";
import { seedSlaAction, createCannedAction, deleteCannedAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/support", label: "Support" },
  { label: "Réglages" },
];
const cls = "h-9 w-full rounded-lg border px-2 text-[13px]";

function mins(n: number): string {
  if (n >= 1440) return `${Math.round(n / 1440)} j`;
  if (n >= 60) return `${Math.round(n / 60)} h`;
  return `${n} min`;
}

export default async function SupportSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Réglages support" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const [sla, canned] = await Promise.all([listSlaPolicies(), listCannedReplies()]);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Réglages support" description="Politiques SLA et réponses types." />
      {sp.sla ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.sla} politique(s) SLA ajoutée(s).</div> : null}
      {sp.canned ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Réponses types mises à jour.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <SectionCard
        icon={Clock}
        title={`Politiques SLA (${sla.length})`}
        bodyClassName="p-0"
        actions={sla.length === 0 ? <form action={seedSlaAction}><button className="h-8 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Initialiser</button></form> : undefined}
      >
        {sla.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune politique. Cliquez sur « Initialiser ».</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Priorité</th><th className="px-4 py-2">Nom</th><th className="px-4 py-2">1re réponse</th><th className="px-4 py-2">Résolution</th>
              </tr></thead>
              <tbody>
                {sla.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2 font-mono text-[12px]">{p.priority}</td>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{mins(p.firstResponseMins)}</td>
                    <td className="px-4 py-2">{mins(p.resolutionMins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Plus} title="Nouvelle réponse type">
        <form action={createCannedAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Titre</span><input name="title" required className={cls} style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Catégorie</span><input name="category" className={cls} style={{ borderColor: "var(--border)" }} /></label>
          </div>
          <label className="block space-y-1 text-[12px]"><span className="font-semibold">Contenu</span><textarea name="body" required rows={3} className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} /></label>
          <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Ajouter</button>
        </form>
      </SectionCard>

      <SectionCard icon={MessageSquareText} title={`Réponses types (${canned.length})`} bodyClassName="p-0">
        {canned.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune réponse type.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
            {canned.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold">{r.title} {r.category ? <span className="text-[11px] text-slate-400">· {r.category}</span> : null}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-slate-600">{r.body}</p>
                </div>
                <form action={deleteCannedAction}><input type="hidden" name="id" value={r.id} /><button className="h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Supprimer</button></form>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

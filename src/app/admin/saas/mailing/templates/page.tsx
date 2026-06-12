import Link from "next/link";
import { LayoutTemplate, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listTemplates } from "@/lib/saas/mailing/template-store";
import { DEFAULT_TEMPLATES } from "@/lib/saas/mailing/templates";
import { seedTemplatesAction, toggleTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/mailing", label: "Mailing" },
  { label: "Modèles" },
];

const CAT_LABEL: Record<string, string> = {
  account: "Compte", billing: "Facturation", subscription: "Abonnement",
  support: "Support", system: "Système", marketing: "Marketing",
};

export default async function MailTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Modèles" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const dbTemplates = await listTemplates();
  // Fusionne base + catalogue par défaut (les non-encore-seedés apparaissent aussi).
  const byKey = new Map(dbTemplates.map((t) => [t.key, t]));
  const merged = DEFAULT_TEMPLATES.map((d) => {
    const db = byKey.get(d.key);
    return db ?? { id: `default:${d.key}`, key: d.key, name: d.name, category: d.category, subject: d.subject, enabled: true, inDb: false } as const;
  });
  const grouped = new Map<string, typeof merged>();
  for (const t of merged) {
    const arr = grouped.get(t.category) ?? [];
    arr.push(t);
    grouped.set(t.category, arr);
  }
  const seededCount = dbTemplates.length;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Modèles d'emails"
        description={`${DEFAULT_TEMPLATES.length} modèles disponibles · ${seededCount} personnalisés en base.`}
        actions={<form action={seedTemplatesAction}><button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Initialiser les modèles</button></form>}
      />
      {sp.seeded ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.seeded} modèle(s) ajouté(s) en base.</div> : null}
      {sp.updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Modèle mis à jour.</div> : null}

      {[...grouped.entries()].map(([cat, items]) => (
        <SectionCard key={cat} icon={LayoutTemplate} title={CAT_LABEL[cat] ?? cat} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Clé</th><th className="px-4 py-2">Nom</th><th className="px-4 py-2">Objet</th><th className="px-4 py-2">État</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.key} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2"><code className="font-mono text-[11px]">{t.key}</code></td>
                    <td className="px-4 py-2">{t.name}</td>
                    <td className="px-4 py-2 text-slate-600">{t.subject}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={t.enabled ? { background: "#DCFCE7", color: "#15803D" } : { background: "#FEE2E2", color: "#B91C1C" }}>
                        {t.enabled ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/admin/saas/mailing/templates/${encodeURIComponent(t.key)}`} className="h-8 rounded-lg border px-2.5 text-[11px] font-semibold leading-8" style={{ borderColor: "var(--border)" }}>Éditer</Link>
                        <form action={toggleTemplateAction}>
                          <input type="hidden" name="key" value={t.key} />
                          <input type="hidden" name="enabled" value={t.enabled ? "0" : "1"} />
                          <button className="h-8 rounded-lg border px-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>{t.enabled ? "Désactiver" : "Activer"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}
    </PageShell>
  );
}

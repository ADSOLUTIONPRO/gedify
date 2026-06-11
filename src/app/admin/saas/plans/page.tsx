import { Sliders } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { PLAN_IDS, PLANS } from "@/lib/saas/plans";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Plans & offres" },
];

function lim(v: number | null): string {
  return v == null ? "∞" : String(v);
}
function yn(v: boolean): string {
  return v ? "✓" : "—";
}

export default function SaasPlansPage() {
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Plans & offres" description="Limites et fonctionnalités par offre (src/lib/saas/plans.ts)." />
      <SectionCard icon={Sliders} title="Offres" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5 text-right">Users</th>
                <th className="px-4 py-2.5 text-right">Documents</th>
                <th className="px-4 py-2.5 text-right">Stockage (Mo)</th>
                <th className="px-4 py-2.5 text-center">IA</th>
                <th className="px-4 py-2.5 text-center">OCR</th>
                <th className="px-4 py-2.5 text-center">Email</th>
                <th className="px-4 py-2.5 text-center">OnlyOffice</th>
                <th className="px-4 py-2.5">Support</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_IDS.map((id) => {
                const p = PLANS[id];
                return (
                  <tr key={id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{p.label}</div>
                      <div className="text-[11px] text-slate-500">{p.description}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">{lim(p.maxUsers)}</td>
                    <td className="px-4 py-2.5 text-right">{lim(p.maxDocuments)}</td>
                    <td className="px-4 py-2.5 text-right">{lim(p.maxStorageMb)}</td>
                    <td className="px-4 py-2.5 text-center">{yn(p.aiEnabled)}</td>
                    <td className="px-4 py-2.5 text-center">{yn(p.ocrEnabled)}</td>
                    <td className="px-4 py-2.5 text-center">{yn(p.emailImportEnabled)}</td>
                    <td className="px-4 py-2.5 text-center">{yn(p.onlyofficeEnabled)}</td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{p.supportLevel}</code></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <p className="text-[12px] text-slate-500">
        Édition par tenant : appliquez un plan ou surchargez les limites depuis la fiche d&apos;un client (Clients / Espaces → Détails).
      </p>
    </PageShell>
  );
}

import { AlertTriangle, Sliders } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listPlanDefinitions, type PlanDefinition } from "@/lib/saas/plan-store";
import { FEATURE_CATEGORIES } from "@/lib/saas/features";
import { upsertPlanFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Plans & offres" },
];
const inputCls = "h-9 w-full rounded-lg border px-2 text-[13px]";

function PlanForm({ plan }: { plan: PlanDefinition | null }) {
  const p = plan;
  return (
    <form action={upsertPlanFormAction} className="space-y-4">
      <input type="hidden" name="code" value={p?.code ?? ""} />
      <div className="grid gap-3 sm:grid-cols-3">
        {!p ? <input name="code" required placeholder="code (ex. custom_x)" className={inputCls} style={{ borderColor: "var(--border)" }} /> : <div className="self-center font-mono text-[13px] font-bold">{p.code}</div>}
        <input name="name" defaultValue={p?.name ?? ""} placeholder="Nom" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} placeholder="ordre" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="maxUsers" type="number" min={0} defaultValue={p?.maxUsers ?? ""} placeholder="max users (∞)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="maxDocuments" type="number" min={0} defaultValue={p?.maxDocuments ?? ""} placeholder="max docs (∞)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="maxStorageMb" type="number" min={0} defaultValue={p?.maxStorageMb ?? ""} placeholder="max Mo (∞)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="monthlyPriceCents" type="number" min={0} defaultValue={p?.monthlyPriceCents ?? ""} placeholder="prix mensuel (cents)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="yearlyPriceCents" type="number" min={0} defaultValue={p?.yearlyPriceCents ?? ""} placeholder="prix annuel (cents)" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <input name="supportLevel" defaultValue={p?.supportLevel ?? ""} placeholder="support" className={inputCls} style={{ borderColor: "var(--border)" }} />
      </div>
      <div className="flex flex-wrap gap-4 text-[13px]">
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Actif</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked={p?.isPublic ?? false} /> Public</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={p?.isDefault ?? false} /> Par défaut</label>
      </div>
      <details className="rounded-xl border p-3" style={{ borderColor: "var(--border-soft)" }}>
        <summary className="cursor-pointer text-[13px] font-bold">Fonctionnalités ({FEATURE_CATEGORIES.reduce((n, c) => n + c.features.length, 0)})</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FEATURE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-soft)" }}>
              <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-main)" }}>{cat.label}</div>
              <div className="flex flex-col gap-0.5">
                {cat.features.map((f) => (
                  <label key={f.key} className="inline-flex items-center gap-2 text-[12px]">
                    <input type="checkbox" name={`feature_${f.key}`} defaultChecked={p ? p.features[f.key] : true} /> {f.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      <button type="submit" className="h-9 rounded-lg px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>
        {p ? "Enregistrer le plan" : "Créer le plan"}
      </button>
    </form>
  );
}

export default async function SaasPlansPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Plans & offres" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }
  const { error, updated } = await searchParams;
  const plans = await listPlanDefinitions().catch(() => []);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Plans & offres" description="Plans administrables (table saas_plans, fallback config). Limites + fonctionnalités par offre." />
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">{error}</div> : null}
      {updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Plan enregistré.</div> : null}

      {plans.map((p) => (
        <SectionCard key={p.code} icon={Sliders} title={`${p.name} (${p.code})`} description={`${p.source === "db" ? "table" : "config par défaut"} · ${p.isActive ? "actif" : "inactif"}${p.isPublic ? " · public" : ""}`}>
          <PlanForm plan={p} />
        </SectionCard>
      ))}

      <SectionCard icon={Sliders} title="Créer un plan personnalisé">
        <PlanForm plan={null} />
      </SectionCard>
    </PageShell>
  );
}

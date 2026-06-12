import { AlertTriangle, Sliders } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import {
  AdminCard, AdminAlert, AdminBadge, AdminField, AdminInput, AdminCheckbox,
  AdminButton, AdminFormSection, SuperAdminHero,
} from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listPlanDefinitions, type PlanDefinition } from "@/lib/saas/plan-store";
import { FEATURE_CATEGORIES } from "@/lib/saas/features";
import { isStripeEnabled, getStripeMode } from "@/lib/saas/stripe/config";
import { upsertPlanFormAction, syncPlanStripeFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Plans & offres" },
];
const FEATURE_COUNT = FEATURE_CATEGORIES.reduce((n, c) => n + c.features.length, 0);

function PlanForm({ plan }: { plan: PlanDefinition | null }) {
  const p = plan;
  return (
    <form action={upsertPlanFormAction} className="space-y-5">
      <input type="hidden" name="code" value={p?.code ?? ""} />
      <AdminFormSection columns={3}>
        {p ? (
          <AdminField label="Code">
            <div className="flex min-h-[44px] items-center font-mono text-[14px] font-bold" style={{ color: "var(--au-navy, #0B1028)" }}>{p.code}</div>
          </AdminField>
        ) : (
          <AdminInput name="code" label="Code" required placeholder="ex. custom_x" />
        )}
        <AdminInput name="name" label="Nom" defaultValue={p?.name ?? ""} placeholder="Nom du plan" />
        <AdminInput name="sortOrder" type="number" label="Position" defaultValue={p?.sortOrder ?? 0} />
        <AdminInput name="monthlyPriceCents" type="number" min={0} label="Prix mensuel (cents)" defaultValue={p?.monthlyPriceCents ?? ""} placeholder="0" />
        <AdminInput name="yearlyPriceCents" type="number" min={0} label="Prix annuel (cents)" defaultValue={p?.yearlyPriceCents ?? ""} placeholder="0" />
        <AdminInput name="supportLevel" label="Quota / support par défaut" defaultValue={p?.supportLevel ?? ""} placeholder="ex. standard" />
        <AdminInput name="maxUsers" type="number" min={0} label="Max utilisateurs" hint="vide = illimité" defaultValue={p?.maxUsers ?? ""} placeholder="∞" />
        <AdminInput name="maxDocuments" type="number" min={0} label="Max documents" hint="vide = illimité" defaultValue={p?.maxDocuments ?? ""} placeholder="∞" />
        <AdminInput name="maxStorageMb" type="number" min={0} label="Max stockage (Mo)" hint="vide = illimité" defaultValue={p?.maxStorageMb ?? ""} placeholder="∞" />
      </AdminFormSection>

      <div className="au-plan-checks">
        <AdminCheckbox name="isActive" defaultChecked={p?.isActive ?? true} label="Actif" />
        <AdminCheckbox name="isPublic" defaultChecked={p?.isPublic ?? false} label="Public" />
        <AdminCheckbox name="isDefault" defaultChecked={p?.isDefault ?? false} label="Par défaut" />
      </div>

      <details className="au-plan-features">
        <summary>Fonctionnalités ({FEATURE_COUNT})</summary>
        <div className="au-plan-features__grid">
          {FEATURE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="au-plan-features__cat">
              <div className="au-plan-features__cat-title">{cat.label}</div>
              <div className="flex flex-col gap-1.5">
                {cat.features.map((f) => (
                  <AdminCheckbox key={f.key} name={`feature_${f.key}`} defaultChecked={p ? p.features[f.key] : true} label={<span className="text-[13px]">{f.label}</span>} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div>
        <AdminButton type="submit" variant="primary">{p ? "Enregistrer le plan" : "Créer le plan"}</AdminButton>
      </div>
    </form>
  );
}

export default async function SaasPlansPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Plans & offres" />
        <AdminCard icon={AlertTriangle} title="Mode mono-tenant">
          <p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p>
        </AdminCard>
      </PageShell>
    );
  }
  const { error, updated } = await searchParams;
  const plans = await listPlanDefinitions().catch(() => []);
  const stripeOn = isStripeEnabled();

  return (
    <PageShell>
      <SuperAdminHero
        breadcrumb={breadcrumb}
        eyebrow="Administration SaaS"
        title="Plans & offres"
        subtitle="Plans administrables (table saas_plans, fallback config). Limites + fonctionnalités par offre."
        icon={<Sliders className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />}
        actions={<a href="#custom-plan" className="au-btn au-btn--primary">Créer un plan</a>}
      />
      {error ? <AdminAlert tone="danger">{error}</AdminAlert> : null}
      {updated ? <AdminAlert tone="success">Plan enregistré.</AdminAlert> : null}

      {plans.map((p) => (
        <AdminCard
          key={p.code}
          icon={Sliders}
          title={`${p.name} (${p.code})`}
          subtitle={p.source === "db" ? "table saas_plans" : "config par défaut"}
          actions={
            <>
              {p.isActive ? <AdminBadge tone="success">Actif</AdminBadge> : <AdminBadge tone="neutral">Inactif</AdminBadge>}
              {p.isPublic ? <AdminBadge tone="info">Public</AdminBadge> : null}
              {p.isDefault ? <AdminBadge tone="accent">Par défaut</AdminBadge> : null}
            </>
          }
        >
          <PlanForm plan={p} />
          <div className="au-stripe-row">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-bold" style={{ color: "var(--au-navy, #0B1028)" }}>Stripe ({getStripeMode()})</span>
              {p.stripeProductId ? <AdminBadge tone="success">synchronisé</AdminBadge> : <AdminBadge tone="neutral">non synchronisé</AdminBadge>}
            </div>
            <div className="au-stripe-meta">product={p.stripeProductId ?? "—"} · monthly={p.stripeMonthlyPriceId ?? "—"} · yearly={p.stripeYearlyPriceId ?? "—"}</div>
            <form action={syncPlanStripeFormAction} className="mt-3">
              <input type="hidden" name="code" value={p.code} />
              <AdminButton type="submit" variant="secondary" sm disabled={!stripeOn}>
                {stripeOn ? "Synchroniser avec Stripe" : "Stripe désactivé"}
              </AdminButton>
            </form>
          </div>
        </AdminCard>
      ))}

      <AdminCard id="custom-plan" accent icon={Sliders} title="Créer un plan personnalisé" subtitle="Plan sur-mesure — définissez une offre adaptée à vos besoins.">
        <PlanForm plan={null} />
      </AdminCard>
    </PageShell>
  );
}

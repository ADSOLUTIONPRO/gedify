import { AlertTriangle, Building2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { TENANT_PLANS, TENANT_STATUSES } from "@/lib/tenant/tenant-admin";
import { createTenantFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas/tenants", label: "Tenants SaaS" },
  { label: "Créer un tenant" },
];

const inputCls =
  "h-10 w-full rounded-xl border px-3 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelCls = "block text-[12.5px] font-semibold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls} style={{ color: "var(--text-main)" }}>{label}</label>
      {children}
    </div>
  );
}

export default async function CreateTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Créer un tenant" description="Accès réservé aux superusers." />
        <SectionCard icon={ShieldCheck} title="Accès refusé">
          <p className="text-sm text-slate-600">Seul un superuser peut créer un tenant.</p>
        </SectionCard>
      </PageShell>
    );
  }
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Créer un tenant" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant">
          <p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p>
        </SectionCard>
      </PageShell>
    );
  }

  const { error } = await searchParams;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Créer un tenant" description="Onboarding contrôlé d'un client (superuser)." />

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <SectionCard icon={Building2} title="Nouvelle organisation">
        <form action={createTenantFormAction} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'organisation">
              <input name="name" required className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="Client Démo" />
            </Field>
            <Field label="Slug (a-z, 0-9, tirets)">
              <input name="slug" required pattern="[a-z0-9][a-z0-9-]{0,38}[a-z0-9]" className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="client-demo" />
            </Field>
            <Field label="E-mail du propriétaire">
              <input name="ownerEmail" type="email" required className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="owner@exemple.com" />
            </Field>
            <Field label="Identifiant du propriétaire">
              <input name="ownerUsername" required minLength={3} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="owner" />
            </Field>
            <Field label="Mot de passe temporaire (si nouveau compte)">
              <input name="ownerPassword" type="text" minLength={8} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="≥ 8 caractères" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plan">
                <select name="plan" defaultValue="free" className={inputCls} style={{ borderColor: "var(--border)" }}>
                  {TENANT_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Statut">
                <select name="status" defaultValue="trial" className={inputCls} style={{ borderColor: "var(--border)" }}>
                  {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
            <h3 className="mb-3 text-[13px] font-bold" style={{ color: "var(--text-main)" }}>Limites & fonctionnalités</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max utilisateurs (vide = illimité)">
                <input name="maxUsers" type="number" min={0} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
              </Field>
              <Field label="Max documents">
                <input name="maxDocuments" type="number" min={0} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
              </Field>
              <Field label="Max stockage (Mo)">
                <input name="maxStorageMb" type="number" min={0} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[13px]" style={{ color: "var(--text-main)" }}>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="aiEnabled" defaultChecked /> IA</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="ocrEnabled" defaultChecked /> OCR</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="emailImportEnabled" /> Import email</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="onlyofficeEnabled" defaultChecked /> OnlyOffice</label>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-bold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            Créer le tenant
          </button>
        </form>
      </SectionCard>
    </PageShell>
  );
}

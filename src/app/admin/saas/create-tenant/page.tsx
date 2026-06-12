import { AlertTriangle, Building2, ShieldCheck, UserPlus, Sliders, ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { TENANT_PLANS, TENANT_STATUSES } from "@/lib/tenant/tenant-admin";
import { AdminCard, AdminAlert, AdminInput, AdminSelect, AdminCheckbox, AdminButton, AdminFormSection } from "@/components/admin-ui";
import { createTenantFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas/tenants", label: "Clients / Espaces" },
  { label: "Créer un client" },
];

export default async function CreateTenantPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Créer un client" description="Accès réservé aux superusers." />
        <AdminCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Seul un superuser peut créer un client.</p></AdminCard>
      </PageShell>
    );
  }
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Créer un client" />
        <AdminCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></AdminCard>
      </PageShell>
    );
  }
  const { error } = await searchParams;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Créer un client" description="Onboarding contrôlé d'un client (superuser)." />

      <form action={createTenantFormAction} className="space-y-4">
        {error ? <AdminAlert tone="danger">{error}</AdminAlert> : null}

        <AdminCard icon={Building2} title="Organisation" subtitle="Identité de l'espace client.">
          <AdminFormSection columns={2}>
            <AdminInput id="name" name="name" label="Nom de l'organisation" required placeholder="Client Démo" />
            <AdminInput id="slug" name="slug" label="Slug" required pattern="[a-z0-9][a-z0-9-]{0,38}[a-z0-9]" placeholder="client-demo" hint="Minuscules, chiffres et tirets (identifiant d'URL)." />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={UserPlus} title="Propriétaire" subtitle="Compte owner de l'espace (réutilisé s'il existe déjà).">
          <AdminFormSection columns={2}>
            <AdminInput id="ownerEmail" name="ownerEmail" type="email" label="E-mail du propriétaire" required placeholder="owner@exemple.com" />
            <AdminInput id="ownerUsername" name="ownerUsername" label="Identifiant du propriétaire" required minLength={3} placeholder="owner" />
            <AdminInput id="ownerPassword" name="ownerPassword" type="text" label="Mot de passe temporaire" minLength={8} placeholder="≥ 8 caractères" hint="Requis uniquement si le compte n'existe pas encore." />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={Sliders} title="Plan & statut">
          <AdminFormSection columns={2}>
            <AdminSelect id="plan" name="plan" label="Plan" defaultValue="free">
              {TENANT_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </AdminSelect>
            <AdminSelect id="status" name="status" label="Statut" defaultValue="trial">
              {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </AdminSelect>
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={Sliders} title="Limites" subtitle="Laisser vide pour illimité.">
          <AdminFormSection columns={3}>
            <AdminInput id="maxUsers" name="maxUsers" type="number" min={0} label="Max utilisateurs" placeholder="∞" />
            <AdminInput id="maxDocuments" name="maxDocuments" type="number" min={0} label="Max documents" placeholder="∞" />
            <AdminInput id="maxStorageMb" name="maxStorageMb" type="number" min={0} label="Max stockage (Mo)" placeholder="∞" />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={ToggleRight} title="Fonctionnalités">
          <div className="flex flex-wrap gap-5">
            <AdminCheckbox name="aiEnabled" defaultChecked label="IA" />
            <AdminCheckbox name="ocrEnabled" defaultChecked label="OCR" />
            <AdminCheckbox name="emailImportEnabled" label="Import email" />
            <AdminCheckbox name="onlyofficeEnabled" defaultChecked label="OnlyOffice" />
          </div>
        </AdminCard>

        <div className="flex justify-end">
          <AdminButton type="submit" variant="primary">Créer le client</AdminButton>
        </div>
      </form>
    </PageShell>
  );
}

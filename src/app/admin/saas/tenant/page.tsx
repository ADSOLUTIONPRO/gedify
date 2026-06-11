import { AlertTriangle, Building2, CheckCircle2, Database, Gauge, ShieldCheck, Stethoscope, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentRole } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentTenant, getTenantDebug } from "@/lib/tenant/get-current-tenant";
import { getTenantCounts, type TenantCounts } from "@/lib/tenant/tenant-store";
import type { TenantContext } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px]">{children}</code>;
}

function Bool({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Activé
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Désactivé
    </span>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Oui
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-rose-700">
      <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Non
    </span>
  );
}

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/administration", label: "Administration" },
  { label: "Tenant SaaS" },
];

export default async function SaasTenantPage() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Tenant SaaS" description="Accès réservé aux administrateurs." />
        <SectionCard icon={ShieldCheck} title="Accès refusé">
          <p className="text-sm text-slate-600">Cette page est réservée aux administrateurs.</p>
        </SectionCard>
      </PageShell>
    );
  }

  const multiTenant = isMultiTenantEnabled();

  // Diagnostic sûr (jamais de secret) — toujours calculé pour faciliter le support.
  const debug = await getTenantDebug();

  // Contexte tenant (tolérant aux erreurs).
  let ctx: TenantContext | null = null;
  let error: string | null = null;
  try {
    ctx = await getCurrentTenant();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const settings = ctx?.settings ?? null;

  // Couverture des données par tenant (Phase 2) — uniquement en multi-tenant.
  let counts: TenantCounts | null = null;
  if (multiTenant && ctx) {
    counts = await getTenantCounts(ctx.tenantId).catch(() => null);
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Tenant SaaS"
        description="Tenant courant, rôle et limites (tenant_settings). Socle multi-tenant — Phase 1."
      />

      {!multiTenant ? (
        <div className="flex items-start gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            Mode <strong>mono-tenant</strong> : <Mono>MULTI_TENANT</Mono> n&apos;est pas activé. Le
            tenant ci-dessous est synthétique (aucun accès base). Activez{" "}
            <Mono>MULTI_TENANT=true</Mono> sur l&apos;environnement SaaS pour la résolution réelle.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs text-rose-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            Impossible de résoudre le tenant : {error}. Voir le diagnostic ci-dessous. Vérifiez le
            schéma (<Mono>npm run db:push</Mono>) et le tenant initial
            (<Mono>npm run saas:init-tenant</Mono>).
          </span>
        </div>
      ) : null}

      {ctx ? (
        <>
          <SectionCard icon={Building2} title="Tenant courant">
            <MetadataGrid
              columns={3}
              items={[
                { label: "Nom", value: ctx.tenant.name ?? "—" },
                { label: "Slug", value: <Mono>{ctx.tenant.slug}</Mono> },
                { label: "ID", value: <Mono>{ctx.tenant.id}</Mono> },
                { label: "Plan", value: <Mono>{ctx.tenant.plan ?? "—"}</Mono> },
                { label: "Statut", value: <Mono>{ctx.tenant.status ?? "—"}</Mono> },
                { label: "Mon rôle", value: <Mono>{ctx.role}</Mono> },
                { label: "Utilisateur", value: <Mono>{ctx.username}</Mono> },
                { label: "E-mail", value: ctx.email ?? "—" },
              ]}
            />
          </SectionCard>

          <SectionCard
            icon={Gauge}
            title="Limites & fonctionnalités (tenant_settings)"
            description={settings ? undefined : "Aucune ligne tenant_settings — lancez saas:init-tenant."}
          >
            {settings ? (
              <MetadataGrid
                columns={3}
                items={[
                  { label: "Max utilisateurs", value: settings.maxUsers ?? "Illimité" },
                  { label: "Max documents", value: settings.maxDocuments ?? "Illimité" },
                  { label: "Max stockage (Mo)", value: settings.maxStorageMb ?? "Illimité" },
                  { label: "IA", value: <Bool value={settings.aiEnabled} /> },
                  { label: "OCR", value: <Bool value={settings.ocrEnabled} /> },
                  { label: "Import email", value: <Bool value={settings.emailImportEnabled} /> },
                  { label: "OnlyOffice", value: <Bool value={settings.onlyofficeEnabled} /> },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">
                {multiTenant
                  ? "Réglages non initialisés pour ce tenant."
                  : "Réglages non applicables en mode mono-tenant."}
              </p>
            )}
          </SectionCard>
        </>
      ) : null}

      {counts ? (
        <SectionCard
          icon={Database}
          title="Couverture des données (tenant courant)"
          description="Lignes rattachées à ce tenant. Lancez saas:attach-data si des données restent à 0."
        >
          <MetadataGrid
            columns={3}
            items={[
              { label: "Documents", value: counts.documents },
              { label: "Tags", value: counts.tags },
              { label: "Correspondants", value: counts.correspondents },
              { label: "Types de document", value: counts.documentTypes },
              { label: "Dossiers", value: counts.folders },
            ]}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        icon={Stethoscope}
        title="Diagnostic (résolution tenant)"
        description="Aucun secret affiché (ni mot de passe, ni token)."
      >
        <MetadataGrid
          columns={3}
          items={[
            { label: "MULTI_TENANT", value: <YesNo value={debug.multiTenant} /> },
            { label: "Session détectée", value: <YesNo value={debug.sessionDetected} /> },
            { label: "Identifiant session", value: debug.sessionIdentifier ? <Mono>{debug.sessionIdentifier}</Mono> : "—" },
            { label: "userId", value: debug.userId ?? "—" },
            { label: "username", value: debug.username ? <Mono>{debug.username}</Mono> : "—" },
            { label: "email", value: debug.email ?? "—" },
            { label: "Membership trouvé", value: <YesNo value={debug.membershipFound} /> },
            { label: "Tenant trouvé", value: <YesNo value={debug.tenantFound} /> },
            { label: "Settings trouvés", value: <YesNo value={debug.settingsFound} /> },
            { label: "Rôle", value: debug.role ? <Mono>{debug.role}</Mono> : "—" },
          ]}
        />
      </SectionCard>
    </PageShell>
  );
}

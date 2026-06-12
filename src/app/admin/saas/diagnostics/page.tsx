import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getUnscopedCounts } from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Diagnostics SaaS" },
];

export default async function SaasDiagnosticsPage() {
  const multiTenant = isMultiTenantEnabled();
  const unscoped = multiTenant ? await getUnscopedCounts().catch(() => null) : null;
  const total = unscoped
    ? unscoped.documents + unscoped.tags + unscoped.correspondents + unscoped.documentTypes + unscoped.folders + unscoped.documentCorrespondents + unscoped.documentFiles
    : 0;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Diagnostics SaaS" description="Isolation tenant, lignes sans tenant_id, cohérence — et scripts de vérification." />

      <SectionCard icon={Activity} title="Lignes sans tenant_id (global)">
        {!multiTenant ? (
          <p className="text-sm text-slate-600">Mode mono-tenant — non applicable.</p>
        ) : total > 0 ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <span>{total} ligne(s) métier sans tenant_id — lancez <code className="font-mono">npm run saas:attach-data</code>.</span>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>Aucune ligne orpheline — isolation OK.</span>
          </div>
        )}
        {unscoped ? (
          <MetadataGrid
            columns={3}
            items={[
              { label: "Documents", value: unscoped.documents },
              { label: "Tags", value: unscoped.tags },
              { label: "Correspondants", value: unscoped.correspondents },
              { label: "Types", value: unscoped.documentTypes },
              { label: "Dossiers", value: unscoped.folders },
              { label: "document_correspondents", value: unscoped.documentCorrespondents },
            ]}
          />
        ) : null}
      </SectionCard>

      <SectionCard icon={Activity} title="Scripts de vérification (terminal)">
        <ul className="space-y-2 text-[13px] text-slate-700">
          <li><code className="font-mono">npm run saas:check-isolation</code> — isolation tenant + cohérence relations (exit 0/1).</li>
          <li><code className="font-mono">npm run saas:test-two-tenants</code> — test d&apos;isolation entre deux tenants (exit 0/1).</li>
          <li><code className="font-mono">npm run saas:check-quotas</code> — usage vs limites par tenant (exit 1 si dépassement).</li>
          <li><code className="font-mono">npm run saas:attach-data</code> — rattache les données orphelines au tenant.</li>
          <li><code className="font-mono">npm run saas:check-billing</code> — profil émetteur, numérotation, intégrité factures.</li>
          <li><code className="font-mono">npm run saas:check-mailing</code> — config SMTP (sans secret) + file/modèles/campagnes.</li>
          <li><code className="font-mono">npm run saas:check-support</code> — stats support + contrôle d&apos;isolation tenant.</li>
          <li><code className="font-mono">npm run saas:check-encryption</code> — KEK/DEK + fichiers chiffrés vs en clair.</li>
          <li><code className="font-mono">npm run saas:encrypt-existing-files</code> — migre les fichiers existants vers le chiffrement (idempotent).</li>
          <li><code className="font-mono">npm run saas:check-settings</code> — cohérence des réglages globaux (sans secret).</li>
          <li><code className="font-mono">npm run saas:check-security</code> — synthèse du journal de sécurité.</li>
          <li><code className="font-mono">npm run saas:check-admin-isolation</code> — fuites d'isolation Administration (exit 1).</li>
          <li><code className="font-mono">npm run saas:check-memberships</code> — cohérence des adhésions (exit 1).</li>
          <li><code className="font-mono">npm run saas:check-invitations</code> — état des invitations.</li>
          <li><code className="font-mono">npm run saas:check-domains</code> — domaines clients (DNS/SSL).</li>
        </ul>
      </SectionCard>
    </PageShell>
  );
}

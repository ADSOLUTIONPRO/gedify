import Link from "next/link";
import { AlertTriangle, Building2, ChevronLeft, Database, FileText, Gauge, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import {
  getTenantById,
  getTenantCounts,
  getTenantSettings,
  getUnscopedCounts,
  listTenantMembersWithUser,
  getRecentDocuments,
} from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px]">{children}</code>;
}

export default async function SaasTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/tenants", label: "Tenants SaaS" },
    { label: tenantId },
  ];

  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Diagnostic tenant" description="Accès réservé aux superusers." />
        <SectionCard icon={ShieldCheck} title="Accès refusé">
          <p className="text-sm text-slate-600">Cette page est réservée aux superusers.</p>
        </SectionCard>
      </PageShell>
    );
  }

  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Diagnostic tenant" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant">
          <p className="text-sm text-slate-600"><Mono>MULTI_TENANT</Mono> n&apos;est pas activé.</p>
        </SectionCard>
      </PageShell>
    );
  }

  const tenant = await getTenantById(tenantId).catch(() => null);
  if (!tenant) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Diagnostic tenant" />
        <SectionCard icon={AlertTriangle} title="Tenant introuvable">
          <p className="text-sm text-slate-600">Aucun tenant avec l&apos;identifiant <Mono>{tenantId}</Mono>.</p>
          <Link href="/admin/saas/tenants" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Retour à la liste
          </Link>
        </SectionCard>
      </PageShell>
    );
  }

  const [settings, counts, members, unscoped, recent] = await Promise.all([
    getTenantSettings(tenantId).catch(() => null),
    getTenantCounts(tenantId).catch(() => null),
    listTenantMembersWithUser(tenantId).catch(() => []),
    getUnscopedCounts().catch(() => null),
    getRecentDocuments(tenantId, 10).catch(() => []),
  ]);
  const unscopedTotal = unscoped
    ? unscoped.documents + unscoped.tags + unscoped.correspondents + unscoped.documentTypes + unscoped.folders + unscoped.documentCorrespondents + unscoped.documentFiles
    : 0;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={tenant.name ?? tenant.id} description={`Diagnostic tenant (superuser) — ${tenant.slug}`} />

      <SectionCard icon={Building2} title="Tenant">
        <MetadataGrid
          columns={3}
          items={[
            { label: "ID", value: <Mono>{tenant.id}</Mono> },
            { label: "Slug", value: <Mono>{tenant.slug}</Mono> },
            { label: "Nom", value: tenant.name ?? "—" },
            { label: "Plan", value: <Mono>{tenant.plan ?? "—"}</Mono> },
            { label: "Statut", value: <Mono>{tenant.status ?? "—"}</Mono> },
            { label: "Créé le", value: tenant.createdAt ? new Date(tenant.createdAt).toLocaleString("fr-FR") : "—" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Users} title={`Memberships (${members.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">User ID</th>
                <th className="px-4 py-2.5">Username</th>
                <th className="px-4 py-2.5">E-mail</th>
                <th className="px-4 py-2.5">Rôle</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2.5">{m.userId}</td>
                  <td className="px-4 py-2.5"><Mono>{m.username ?? "—"}</Mono></td>
                  <td className="px-4 py-2.5">{m.email ?? "—"}</td>
                  <td className="px-4 py-2.5"><Mono>{m.role}</Mono></td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Aucun membership.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Compteurs métier & limites">
        <MetadataGrid
          columns={3}
          items={[
            { label: "Documents", value: counts?.documents ?? "—" },
            { label: "Tags", value: counts?.tags ?? "—" },
            { label: "Correspondants", value: counts?.correspondents ?? "—" },
            { label: "Types", value: counts?.documentTypes ?? "—" },
            { label: "Dossiers", value: counts?.folders ?? "—" },
            { label: "Limites", value: settings ? `users≤${settings.maxUsers ?? "∞"}, docs≤${settings.maxDocuments ?? "∞"}, ${settings.maxStorageMb ?? "∞"}Mo` : "—" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Database} title="Lignes sans tenant_id (global)" description="Diagnostic anti-fuite — doit être 0 en multi-tenant.">
        {unscopedTotal > 0 ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <span>{unscopedTotal} ligne(s) métier sans tenant_id — lancez <Mono>npm run saas:attach-data</Mono>.</span>
          </div>
        ) : null}
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

      <SectionCard icon={FileText} title="Derniers documents du tenant">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun document.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[13px]" style={{ borderColor: "var(--border-soft)" }}>
                <span className="truncate font-medium text-slate-800">{d.title || `Document #${d.id}`}</span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">#{d.id}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}

import Link from "next/link";
import { AlertTriangle, Building2, ChevronLeft, Database, FileText, Gauge, Pencil, Power, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { TENANT_PLANS, TENANT_STATUSES } from "@/lib/tenant/tenant-admin";
import {
  getTenantById,
  getTenantCounts,
  getTenantSettings,
  getUnscopedCounts,
  listTenantMembersWithUser,
  getRecentDocuments,
} from "@/lib/tenant/tenant-store";
import { getTenantPlanLimits, getTenantUsage } from "@/lib/saas/quota";
import { getTenantSubscription, listPaymentEvents, SUBSCRIPTION_STATUSES } from "@/lib/saas/subscriptions";
import { updateTenantFormAction, updateSettingsFormAction, setStatusFormAction, applyPlanFormAction } from "./actions";
import { createManualSubscriptionAction, setSubscriptionStatusAction } from "@/app/admin/saas/subscriptions/actions";
import { applyGrantFormAction, revokeGrantFormAction } from "./actions";
import { getTenantEntitlements } from "@/lib/saas/entitlements";
import { getSecurityEvents } from "@/lib/saas/security/security-events";
import { listTenantGrants, isGrantActive } from "@/lib/saas/grants";
import { FEATURE_CATEGORIES } from "@/lib/saas/features";
import { PLAN_IDS } from "@/lib/saas/plans";
import { Gift, Repeat, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const inputCls = "h-10 w-full rounded-xl border px-3 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px]">{children}</code>;
}

export default async function SaasTenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ updated?: string; created?: string; error?: string }>;
}) {
  const { tenantId } = await params;
  const { updated, created, error } = await searchParams;
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

  const [settings, counts, members, unscoped, recent, limits, usage, subscription, payments] = await Promise.all([
    getTenantSettings(tenantId).catch(() => null),
    getTenantCounts(tenantId).catch(() => null),
    listTenantMembersWithUser(tenantId).catch(() => []),
    getUnscopedCounts().catch(() => null),
    getRecentDocuments(tenantId, 10).catch(() => []),
    getTenantPlanLimits(tenantId).catch(() => null),
    getTenantUsage(tenantId).catch(() => null),
    getTenantSubscription(tenantId).catch(() => null),
    listPaymentEvents(tenantId).catch(() => []),
  ]);
  const [entitlements, grants, securityEvents] = await Promise.all([
    getTenantEntitlements(tenantId).catch(() => null),
    listTenantGrants(tenantId).catch(() => []),
    getSecurityEvents({ tenantId, limit: 8 }).catch(() => []),
  ]);
  const tenantPageUrl = `/admin/saas/tenants/${encodeURIComponent(tenantId)}`;
  const fmtLimit = (used: number | undefined, limit: number | null | undefined) =>
    `${used ?? 0} / ${limit == null ? "∞" : limit}`;
  const unscopedTotal = unscoped
    ? unscoped.documents + unscoped.tags + unscoped.correspondents + unscoped.documentTypes + unscoped.folders + unscoped.documentCorrespondents + unscoped.documentFiles
    : 0;

  const isSuspended = (tenant.status ?? "").toLowerCase() === "suspended";

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={tenant.name ?? tenant.id} description={`Tenant (superuser) — ${tenant.slug}`} />

      {created || updated ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>{created ? "Tenant créé avec succès." : "Modifications enregistrées."}</span>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

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

      <SectionCard icon={Gauge} title="Usage vs limites" description={limits ? `Plan effectif : ${limits.planId}` : undefined}>
        <MetadataGrid
          columns={3}
          items={[
            { label: "Documents", value: fmtLimit(usage?.documents, limits?.maxDocuments) },
            { label: "Utilisateurs", value: fmtLimit(usage?.users, limits?.maxUsers) },
            { label: "Stockage (Mo)", value: fmtLimit(usage?.storageMb, limits?.maxStorageMb) },
            { label: "IA", value: limits?.aiEnabled ? "Activée" : "Désactivée" },
            { label: "OCR", value: limits?.ocrEnabled ? "Activé" : "Désactivé" },
            { label: "Import email", value: limits?.emailImportEnabled ? "Activé" : "Désactivé" },
            { label: "OnlyOffice", value: limits?.onlyofficeEnabled ? "Activé" : "Désactivé" },
          ]}
        />
        <form action={applyPlanFormAction} className="mt-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
            Appliquer les limites du plan « {tenant.plan ?? "free"} »
          </button>
        </form>
      </SectionCard>

      <SectionCard icon={Gift} title="Offre manuelle / gratuité (superuser)">
        {entitlements ? (
          <p className="mb-3 text-[13px]">
            Plan effectif : <Mono>{entitlements.planCode}</Mono>{" "}
            <span className="text-slate-500">(source : {entitlements.source}
              {entitlements.grantEndsAt ? `, fin ${new Date(entitlements.grantEndsAt).toLocaleDateString("fr-FR")}` : entitlements.source === "grant" ? ", à vie" : ""})</span>
          </p>
        ) : null}
        <form action={applyGrantFormAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>Plan offert</label>
            <select name="planCode" defaultValue="pro" className={inputCls} style={{ borderColor: "var(--border)" }}>
              {PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>Durée</label>
            <input name="durationCount" type="number" min={1} defaultValue={14} className={`${inputCls} w-24`} style={{ borderColor: "var(--border)" }} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>Unité</label>
            <select name="durationUnit" defaultValue="day" className={inputCls} style={{ borderColor: "var(--border)" }}>
              <option value="day">jours</option>
              <option value="month">mois</option>
              <option value="year">années</option>
              <option value="lifetime">à vie</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>Raison</label>
            <select name="reason" defaultValue="geste commercial" className={inputCls} style={{ borderColor: "var(--border)" }}>
              <option>client test</option>
              <option>geste commercial</option>
              <option>partenaire</option>
              <option>accompagnement inclus</option>
              <option>client interne</option>
              <option>autre</option>
            </select>
          </div>
          <button type="submit" className="h-10 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Offrir</button>
        </form>

        {grants.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {grants.map((g) => {
              const active = isGrantActive(g);
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "var(--border-soft)" }}>
                  <span>
                    <Mono>{g.planCode}</Mono> · {g.durationUnit === "lifetime" ? "à vie" : `${g.durationCount} ${g.durationUnit}`}
                    {g.endsAt ? ` → ${new Date(g.endsAt).toLocaleDateString("fr-FR")}` : ""}
                    {g.reason ? ` · ${g.reason}` : ""}
                    {" · "}<span style={{ color: active ? "#15803D" : "#94A3B8", fontWeight: 700 }}>{active ? "actif" : g.isActive ? "expiré" : "révoqué"}</span>
                  </span>
                  {active ? (
                    <form action={revokeGrantFormAction}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="grantId" value={g.id} />
                      <button type="submit" className="rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Révoquer</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </SectionCard>

      {entitlements ? (
        <SectionCard icon={Sparkles} title="Fonctionnalités effectives" description={`Selon le plan effectif « ${entitlements.planCode} ».`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURE_CATEGORIES.map((cat) => {
              const on = cat.features.filter((f) => entitlements.features[f.key]).length;
              const off = cat.features.filter((f) => !entitlements.features[f.key]);
              return (
                <div key={cat.id} className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: "var(--border-soft)" }}>
                  <div className="font-semibold" style={{ color: "var(--text-main)" }}>{cat.label} <span className="text-slate-500">{on}/{cat.features.length}</span></div>
                  {off.length > 0 ? <div className="mt-0.5 text-slate-400">désactivé : {off.map((f) => f.label).join(", ")}</div> : null}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard icon={Repeat} title="Abonnement (superuser)">
        <MetadataGrid
          columns={3}
          items={[
            { label: "Statut", value: <Mono>{subscription?.status ?? "(aucun)"}</Mono> },
            { label: "Plan abo", value: <Mono>{subscription?.plan ?? "—"}</Mono> },
            { label: "Provider", value: <Mono>{subscription?.provider ?? "—"}</Mono> },
            { label: "Période fin", value: subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR") : "—" },
            { label: "Annulé le", value: subscription?.canceledAt ? new Date(subscription.canceledAt).toLocaleDateString("fr-FR") : "—" },
          ]}
        />
        <div className="mt-4">
          {subscription ? (
            <form action={setSubscriptionStatusAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="redirectTo" value={tenantPageUrl} />
              <select name="status" defaultValue={subscription.status ?? "active"} className={inputCls} style={{ borderColor: "var(--border)" }}>
                {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__resume__">▶ reprendre</option>
              </select>
              <button type="submit" className="h-10 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Mettre à jour</button>
            </form>
          ) : (
            <form action={createManualSubscriptionAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="redirectTo" value={tenantPageUrl} />
              <input type="hidden" name="plan" value={tenant.plan ?? "free"} />
              <select name="status" defaultValue="active" className={inputCls} style={{ borderColor: "var(--border)" }}>
                {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" className="h-10 rounded-xl border px-4 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>Créer un abonnement manuel</button>
            </form>
          )}
        </div>
        {payments.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">Événements paiement</h3>
            <ul className="space-y-1 text-[12px] text-slate-600">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3"><span>{p.eventType ?? "event"} · {p.provider}</span><span className="font-mono">{p.createdAt ? new Date(p.createdAt).toLocaleString("fr-FR") : ""}</span></li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      {/* ── Édition (superuser) ─────────────────────────────────────────── */}
      <SectionCard icon={Pencil} title="Plan & statut (superuser)">
        <form action={updateTenantFormAction} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Plan</label>
            <select name="plan" defaultValue={tenant.plan ?? "free"} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {TENANT_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Statut</label>
            <select name="status" defaultValue={tenant.status ?? "active"} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>
            Enregistrer
          </button>
        </form>

        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
          <form action={setStatusFormAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="status" value={isSuspended ? "active" : "suspended"} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-semibold"
              style={isSuspended
                ? { borderColor: "#86EFAC", color: "#15803D", background: "#F0FDF4" }
                : { borderColor: "#FCA5A5", color: "#B91C1C", background: "#FEF2F2" }}
            >
              <Power className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {isSuspended ? "Réactiver le tenant" : "Suspendre le tenant"}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Limites & fonctionnalités (superuser)">
        <form action={updateSettingsFormAction} className="space-y-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Max utilisateurs</label>
              <input name="maxUsers" type="number" min={0} defaultValue={settings?.maxUsers ?? ""} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Max documents</label>
              <input name="maxDocuments" type="number" min={0} defaultValue={settings?.maxDocuments ?? ""} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Max stockage (Mo)</label>
              <input name="maxStorageMb" type="number" min={0} defaultValue={settings?.maxStorageMb ?? ""} className={inputCls} style={{ borderColor: "var(--border)" }} placeholder="∞" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px]" style={{ color: "var(--text-main)" }}>
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="aiEnabled" defaultChecked={settings?.aiEnabled ?? true} /> IA</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="ocrEnabled" defaultChecked={settings?.ocrEnabled ?? true} /> OCR</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="emailImportEnabled" defaultChecked={settings?.emailImportEnabled ?? false} /> Import email</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" name="onlyofficeEnabled" defaultChecked={settings?.onlyofficeEnabled ?? true} /> OnlyOffice</label>
          </div>
          <button type="submit" className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>
            Enregistrer les limites
          </button>
        </form>
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

      <SectionCard icon={ShieldCheck} title="Sécurité (derniers événements)" bodyClassName="p-0">
        {securityEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Aucun événement de sécurité pour ce tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Date</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Gravité</th><th className="px-4 py-2">Message</th>
              </tr></thead>
              <tbody>
                {securityEvents.map((e) => (
                  <tr key={String(e.id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-500">{e.created_at ? new Date(String(e.created_at)).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-4 py-2"><code className="font-mono text-[11px]">{String(e.event_type)}</code></td>
                    <td className="px-4 py-2">{String(e.severity)}</td>
                    <td className="px-4 py-2">{String(e.message)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2"><Link href={`/admin/saas/security?tenant=${tenantId}`} className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Voir tous les événements →</Link></div>
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

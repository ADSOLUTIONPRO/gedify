import Link from "next/link";
import {
  Activity, AlertTriangle, Banknote, BriefcaseBusiness, Building2, Clock, Gauge, Gift,
  LayoutGrid, Link2, Receipt, Repeat, Send, Settings, ShieldCheck, Sliders, Tag, UserPlus, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants } from "@/lib/tenant/tenant-store";
import { getSubscriptionAlerts } from "@/lib/saas/subscriptions";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { label: "Gestion clients" }];

const LINKS: { href: string; label: string; icon: typeof Building2; soon?: boolean }[] = [
  { href: "/admin/saas/tenants", label: "Clients / Espaces", icon: LayoutGrid },
  { href: "/admin/saas/create-tenant", label: "Créer un client", icon: UserPlus },
  { href: "/admin/saas/plans", label: "Plans & offres", icon: Sliders },
  { href: "/admin/saas/promo-codes", label: "Codes promo", icon: Tag },
  { href: "/admin/saas/grants", label: "Gratuités offertes", icon: Gift },
  { href: "/admin/saas/usage", label: "Quotas & usages", icon: Gauge },
  { href: "/admin/saas/subscriptions", label: "Abonnements", icon: Repeat, soon: true },
  { href: "/admin/saas/billing", label: "Facturation", icon: Receipt, soon: true },
  { href: "/admin/saas/stripe", label: "Stripe", icon: Banknote, soon: true },
  { href: "/admin/saas/trials", label: "Périodes d'essai", icon: Clock, soon: true },
  { href: "/admin/saas/invitations", label: "Invitations", icon: Send, soon: true },
  { href: "/admin/saas/memberships", label: "Membres clients", icon: Users, soon: true },
  { href: "/admin/saas/domains", label: "Domaines", icon: Link2, soon: true },
  { href: "/admin/saas/security", label: "Sécurité clients", icon: AlertTriangle, soon: true },
  { href: "/admin/saas/diagnostics", label: "Diagnostics SaaS", icon: Activity },
  { href: "/admin/saas/settings", label: "Paramètres SaaS", icon: Settings, soon: true },
];

export default async function SaasDashboardPage() {
  const multiTenant = isMultiTenantEnabled();
  const tenants = multiTenant ? await listTenants().catch(() => []) : [];
  const active = tenants.filter((t) => (t.status ?? "").toLowerCase() === "active").length;
  const trial = tenants.filter((t) => (t.status ?? "").toLowerCase() === "trial").length;
  const suspended = tenants.filter((t) => (t.status ?? "").toLowerCase() === "suspended").length;
  const alerts = multiTenant ? await getSubscriptionAlerts().catch(() => null) : null;
  const alertItems = alerts
    ? [
        { label: "Clients sans abonnement", list: alerts.noSubscription.map((x) => x.name ?? x.id) },
        { label: "Abonnements past_due", list: alerts.pastDue.map((x) => x.name ?? x.id) },
        { label: "Essais bientôt expirés", list: alerts.trialExpiringSoon.map((x) => x.name ?? x.id) },
        { label: "Tenants suspendus", list: alerts.suspended.map((x) => x.name ?? x.id) },
      ].filter((a) => a.list.length > 0)
    : [];

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Tableau de bord SaaS" description="Vue d'ensemble de la plateforme : clients, plans, abonnements, alertes." />

      {!multiTenant ? (
        <div className="flex items-start gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé : pas de gestion SaaS sur cette instance.</span>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clients / tenants" value={tenants.length} icon={Building2} tone="blue" helper="Total" />
          <StatCard label="Actifs" value={active} icon={ShieldCheck} tone="emerald" helper="status=active" />
          <StatCard label="En essai" value={trial} icon={Clock} tone="amber" helper="status=trial" />
          <StatCard label="Suspendus" value={suspended} icon={AlertTriangle} tone="violet" helper="status=suspended" />
        </section>
      )}

      {alertItems.length > 0 ? (
        <SectionCard icon={AlertTriangle} title="Alertes">
          <ul className="space-y-1.5 text-[13px]">
            {alertItems.map((a) => (
              <li key={a.label} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>{a.list.length}</span>
                <span><strong>{a.label}</strong> — {a.list.slice(0, 8).join(", ")}{a.list.length > 8 ? "…" : ""}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard icon={BriefcaseBusiness} title="Sections">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(({ href, label, icon: Icon, soon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-md"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{label}</span>
              {soon ? (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>Bientôt</span>
              ) : null}
            </Link>
          ))}
        </div>
      </SectionCard>
    </PageShell>
  );
}

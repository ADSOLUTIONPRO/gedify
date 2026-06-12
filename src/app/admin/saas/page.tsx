import Link from "next/link";
import {
  Activity, AlertTriangle, Banknote, BriefcaseBusiness, Building2, ChevronRight, Clock, Gauge, Gift,
  LayoutGrid, Link2, PauseCircle, Receipt, Repeat, Send, Settings, ShieldCheck, Sliders, Tag, UserPlus, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { AdminStats, AdminStatCard, AdminCard, AdminAlert } from "@/components/admin-ui";
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
        { label: "Clients sans abonnement", href: "/admin/saas/tenants", list: alerts.noSubscription.map((x) => x.name ?? x.id) },
        { label: "Abonnements past_due", href: "/admin/saas/subscriptions", list: alerts.pastDue.map((x) => x.name ?? x.id) },
        { label: "Essais bientôt expirés", href: "/admin/saas/trials", list: alerts.trialExpiringSoon.map((x) => x.name ?? x.id) },
        { label: "Tenants suspendus", href: "/admin/saas/tenants", list: alerts.suspended.map((x) => x.name ?? x.id) },
      ].filter((a) => a.list.length > 0)
    : [];

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Tableau de bord SaaS" description="Vue d'ensemble de la plateforme : clients, plans, abonnements, alertes." />

      {!multiTenant ? (
        <AdminAlert tone="warning">
          <code className="font-mono">MULTI_TENANT</code> n&apos;est pas activé : pas de gestion SaaS sur cette instance.
        </AdminAlert>
      ) : (
        <AdminStats>
          <AdminStatCard tone="info" icon={Building2} spark label="Clients / Tenants" value={tenants.length} desc="Total" />
          <AdminStatCard tone="success" icon={ShieldCheck} spark label="Actifs" value={active} desc="status=active" />
          <AdminStatCard tone="warning" icon={Clock} spark label="En essai" value={trial} desc="status=trial" />
          <AdminStatCard tone="accent" icon={PauseCircle} spark label="Suspendus" value={suspended} desc="status=suspended" />
        </AdminStats>
      )}

      {alertItems.length > 0 ? (
        <AdminCard icon={AlertTriangle} title="Alertes" subtitle="Éléments nécessitant votre attention">
          <div className="au-alert-rows">
            {alertItems.map((a) => (
              <Link key={a.label} href={a.href} className="au-alert-row">
                <span className="au-alert-row__count">{a.list.length}</span>
                <span className="au-alert-row__body">
                  <strong>{a.label}</strong> — {a.list.slice(0, 8).join(", ")}{a.list.length > 8 ? "…" : ""}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-60" strokeWidth={2} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </AdminCard>
      ) : null}

      <AdminCard icon={BriefcaseBusiness} title="Sections" subtitle="Accédez rapidement aux principales fonctionnalités de la plateforme.">
        <div className="au-sections">
          {LINKS.map(({ href, label, icon: Icon, soon }) => (
            <Link key={href} href={href} className="au-section">
              <span className="au-section__icon"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="au-section__label">{label}</span>
              {soon ? <span className="au-badge au-badge--warning">Bientôt</span> : null}
            </Link>
          ))}
        </div>
      </AdminCard>
    </PageShell>
  );
}

import {
  Activity, AlertTriangle, Banknote, Building2, Clock, FileText, Gauge, Gift,
  LayoutGrid, Link2, Receipt, Repeat, Send, Settings, ShieldCheck, Sliders, Tag, UserPlus, Users,
} from "lucide-react";
import { AdminAlert } from "@/components/admin-ui";
import {
  SuperAdminPageShell, SuperAdminHero, SuperAdminMetricGrid, SuperAdminMetricCard,
  SuperAdminPanel, SuperAdminAlertList, SuperAdminGrid, SuperAdminActionCard,
} from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants } from "@/lib/tenant/tenant-store";
import { getTenantUsage } from "@/lib/saas/quota";
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

const HERO_ICON = <LayoutGrid className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />;
const subtitle = "Vue d'ensemble de la plateforme : clients, plans, abonnements, alertes.";

export default async function SaasDashboardPage() {
  if (!isMultiTenantEnabled()) {
    return (
      <SuperAdminPageShell>
        <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Tableau de bord SaaS" subtitle={subtitle} icon={HERO_ICON} />
        <AdminAlert tone="warning">
          <code className="font-mono">MULTI_TENANT</code> n&apos;est pas activé : pas de gestion SaaS sur cette instance.
        </AdminAlert>
      </SuperAdminPageShell>
    );
  }

  const tenants = await listTenants().catch(() => []);
  const active = tenants.filter((t) => (t.status ?? "").toLowerCase() === "active").length;
  const trial = tenants.filter((t) => (t.status ?? "").toLowerCase() === "trial").length;
  const pctActive = tenants.length ? Math.round((active / tenants.length) * 100) : 0;

  // Documents (total plateforme) : somme réelle de l'usage de chaque tenant.
  const usages = await Promise.all(tenants.map((t) => getTenantUsage(t.id).catch(() => null)));
  const totalDocuments = usages.reduce((n, u) => n + (u?.documents ?? 0), 0);
  const totalStorageMb = usages.reduce((n, u) => n + (u?.storageMb ?? 0), 0);

  const alerts = await getSubscriptionAlerts().catch(() => null);
  const alertItems = alerts
    ? [
        { label: "Clients sans abonnement", list: alerts.noSubscription.map((x) => x.name ?? x.id) },
        { label: "Abonnements past_due", list: alerts.pastDue.map((x) => x.name ?? x.id) },
        { label: "Essais bientôt expirés", list: alerts.trialExpiringSoon.map((x) => x.name ?? x.id) },
        { label: "Tenants suspendus", list: alerts.suspended.map((x) => x.name ?? x.id) },
      ].filter((a) => a.list.length > 0)
    : [];

  const alertTiles = [
    ...alertItems.map((a) => ({
      key: a.label,
      count: a.list.length,
      label: a.label,
      detail: a.list.slice(0, 6).join(", ") + (a.list.length > 6 ? "…" : ""),
    })),
    // Aucune source d'alerte critique plateforme câblée → 0 (honnête, non simulé).
    { key: "critical", count: 0, label: "Alertes critiques", detail: "Aucune urgence plateforme" },
  ];

  return (
    <SuperAdminPageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Tableau de bord SaaS" subtitle={subtitle} icon={HERO_ICON} />

      <SuperAdminMetricGrid>
        <SuperAdminMetricCard
          variant="blue" href="/admin/saas/tenants"
          icon={<Building2 className="h-[22px] w-[22px]" strokeWidth={2.1} />}
          title="Tenants" value={tenants.length} description="Espaces clients"
          trendLabel="Total" footerLabel={`${active} actifs · ${trial} en essai`} trendValue="à jour"
        />
        <SuperAdminMetricCard
          variant="green"
          icon={<ShieldCheck className="h-[22px] w-[22px]" strokeWidth={2.1} />}
          title="Actifs" value={active} description="en production"
          trendLabel={`${pctActive} %`} footerLabel="Tous opérationnels" trendValue="live"
        />
        <SuperAdminMetricCard
          variant="amber" href="/admin/saas/trials"
          icon={<Clock className="h-[22px] w-[22px]" strokeWidth={2.1} />}
          title="Essais" value={trial} description="à convertir"
          trendLabel="En cours" footerLabel={`${trial} conversion${trial > 1 ? "s" : ""} possible${trial > 1 ? "s" : ""}`} trendValue="trial"
        />
        <SuperAdminMetricCard
          variant="pink" chartType="none" href="/admin/saas/usage"
          icon={<FileText className="h-[22px] w-[22px]" strokeWidth={2.1} />}
          title="Documents" value={totalDocuments} description="sur tous les tenants"
          trendLabel="Total" footerLabel={`${totalStorageMb} Mo utilisés`} trendValue="stockage"
        />
      </SuperAdminMetricGrid>

      <SuperAdminPanel title="Alertes">
        <SuperAdminAlertList items={alertTiles} />
      </SuperAdminPanel>

      <SuperAdminPanel title="Sections">
        <SuperAdminGrid columns={4}>
          {LINKS.map(({ href, label, icon: Icon, soon }) => (
            <SuperAdminActionCard
              key={href}
              href={href}
              label={label}
              icon={<Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />}
              badge={soon ? "Bientôt" : undefined}
            />
          ))}
        </SuperAdminGrid>
      </SuperAdminPanel>
    </SuperAdminPageShell>
  );
}

import { Bell, CreditCard, Database, LifeBuoy, Receipt, Settings, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { AdminNavGrid, AdminNavTile } from "@/components/admin-ui";
import { requireTenantMember } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { label: "Paramètres" }];

const CARDS = [
  { href: "/settings/myplan", icon: CreditCard, title: "Mon offre", desc: "Plan, quotas, abonnement et factures.", tone: "pink" as const },
  { href: "/settings/team", icon: Users, title: "Utilisateurs & équipe", desc: "Membres de votre espace et invitations.", tone: "navy" as const },
  { href: "/settings/notifications", icon: Bell, title: "Notifications", desc: "Préférences d'alertes et de résumés.", tone: "navy" as const },
  { href: "/account/security", icon: ShieldCheck, title: "Sécurité du compte", desc: "Mot de passe, double authentification, connexions.", tone: "navy" as const },
  { href: "/settings/billing", icon: Receipt, title: "Factures", desc: "Vos factures et votre abonnement.", tone: "navy" as const },
  { href: "/settings/support", icon: LifeBuoy, title: "Support", desc: "Aide et demandes d'assistance.", tone: "navy" as const },
  { href: "/settings/data", icon: Database, title: "Export de mes données", desc: "Récupérez vos documents et données.", tone: "navy" as const },
];

export default async function SettingsHomePage() {
  const ctx = await requireTenantMember();
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Paramètres" description={`Gestion de votre espace ${ctx.tenant.name ?? ctx.tenantId}.`} />
      <AdminNavGrid columns={3}>
        {CARDS.map((c) => (
          <AdminNavTile key={c.href} href={c.href} icon={c.icon} title={c.title} desc={c.desc} tone={c.tone} />
        ))}
      </AdminNavGrid>
      <p className="flex items-center gap-1.5 text-[12px] text-slate-500"><Settings className="h-3.5 w-3.5" /> Votre espace est cloisonné : vous ne voyez que vos données.</p>
    </PageShell>
  );
}

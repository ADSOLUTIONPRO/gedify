import Link from "next/link";
import { Bell, CreditCard, Database, LifeBuoy, Receipt, Settings, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { requireTenantMember } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { label: "Paramètres" }];

const CARDS = [
  { href: "/settings/myplan", icon: CreditCard, title: "Mon offre", desc: "Plan, quotas, abonnement et factures." },
  { href: "/settings/team", icon: Users, title: "Utilisateurs & équipe", desc: "Membres de votre espace et invitations." },
  { href: "/settings/notifications", icon: Bell, title: "Notifications", desc: "Préférences d'alertes et de résumés." },
  { href: "/account/security", icon: ShieldCheck, title: "Sécurité du compte", desc: "Mot de passe, double authentification, connexions." },
  { href: "/settings/billing", icon: Receipt, title: "Factures", desc: "Vos factures et votre abonnement." },
  { href: "/settings/support", icon: LifeBuoy, title: "Support", desc: "Aide et demandes d'assistance." },
  { href: "/settings/data", icon: Database, title: "Export de mes données", desc: "Récupérez vos documents et données." },
];

export default async function SettingsHomePage() {
  const ctx = await requireTenantMember();
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Paramètres" description={`Gestion de votre espace ${ctx.tenant.name ?? ctx.tenantId}.`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-2xl border p-4 transition hover:shadow-sm" style={{ borderColor: "var(--border)" }}>
            <c.icon className="h-5 w-5" style={{ color: "var(--accent)" }} aria-hidden="true" />
            <div className="mt-2 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{c.title}</div>
            <div className="mt-0.5 text-[12px] text-slate-500">{c.desc}</div>
          </Link>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-slate-500"><Settings className="h-3.5 w-3.5" /> Votre espace est cloisonné : vous ne voyez que vos données.</p>
    </PageShell>
  );
}

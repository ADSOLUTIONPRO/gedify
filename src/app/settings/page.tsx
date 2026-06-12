import { requireTenantMember } from "@/lib/auth/guards";
import {
  SettingsShell, SettingsTopHeader, SettingsCardShell, SettingsHero,
  SettingsGrid, SettingsCard, SettingsNotice, type SettingsTileIcon,
} from "@/components/settings/settings-ui";

export const dynamic = "force-dynamic";

/* Cartes → routes EXISTANTES (aucune route en doublon créée).
   Sécurité/Support/Changer d'offre pointent vers les pages existantes
   (/account/security, /support, /pricing). */
const CARDS: { href: string; title: string; desc: string; icon: SettingsTileIcon }[] = [
  { href: "/settings/myplan", title: "Mon offre", desc: "Plan, quotas et factures", icon: "card" },
  { href: "/settings/team", title: "Utilisateurs & équipe", desc: "Membres et invitations", icon: "users" },
  { href: "/settings/notifications", title: "Notifications", desc: "Préférences d'alertes", icon: "bell" },
  { href: "/account/security", title: "Sécurité du compte", desc: "MFA et connexions", icon: "shield" },
  { href: "/settings/billing", title: "Factures", desc: "Documents de facturation", icon: "receipt" },
  { href: "/support", title: "Support", desc: "Aide et demandes", icon: "help" },
  { href: "/pricing", title: "Changer d'offre", desc: "Plans disponibles", icon: "diamond" },
];

export default async function SettingsHomePage() {
  const ctx = await requireTenantMember();
  const subtitle = `Gestion de votre espace tenant ${ctx.tenant.name ?? ctx.tenantId}.`;

  return (
    <SettingsShell>
      <SettingsTopHeader title="Paramètres" subtitle={subtitle} />
      <SettingsCardShell>
        <SettingsHero title="Paramètres" subtitle={subtitle} pill="Espace paramètres" />
        <SettingsGrid>
          {CARDS.map((c) => (
            <SettingsCard key={c.href} href={c.href} title={c.title} desc={c.desc} icon={c.icon} />
          ))}
        </SettingsGrid>
        <SettingsNotice>
          Votre espace est cloisonné : vous ne voyez que vos données. Les entrées SuperAdmin doivent être invisibles pour ce compte.
        </SettingsNotice>
      </SettingsCardShell>
    </SettingsShell>
  );
}

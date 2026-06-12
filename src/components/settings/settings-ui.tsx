import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CreditCard, Gem, HelpCircle, Lock, Receipt, ShieldCheck, Users } from "lucide-react";

/* Composants du layout PROPRE /settings (espace tenant) — cf. settings-ui.css.
   Aucune sidebar GED, aucune topbar, aucun menu SuperAdmin. */

/** Conteneur centré d'une page paramètres. */
export function SettingsShell({ children }: { children: ReactNode }) {
  return <section className="st-shell">{children}</section>;
}

/** Badge « Mode tenant · SuperAdmin masqué » (icône cadenas, pas d'emoji). */
export function SettingsBadge({ children = "Mode tenant · SuperAdmin masqué" }: { children?: ReactNode }) {
  return (
    <div className="st-badge">
      <Lock className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />
      {children}
    </div>
  );
}

/** En-tête simple de page : titre + sous-titre + badge tenant. */
export function SettingsTopHeader({ title, subtitle, badge = true }: { title: string; subtitle?: string; badge?: boolean }) {
  return (
    <div className="st-top">
      <div className="st-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {badge ? <SettingsBadge /> : null}
    </div>
  );
}

/** Bandeau sombre avec dégradé + angle rosé + pastille. */
export function SettingsHero({ title, subtitle, pill = "Espace paramètres" }: { title: string; subtitle?: string; pill?: string }) {
  return (
    <div className="st-hero">
      <div className="st-hero__main">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {pill ? <span className="st-hero__pill">{pill}</span> : null}
    </div>
  );
}

/** Grand conteneur blanc translucide (page d'accueil paramètres). */
export function SettingsCardShell({ children }: { children: ReactNode }) {
  return <div className="st-card">{children}</div>;
}

/** Grille de cartes (2 colonnes desktop, 1 sur mobile). */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className="st-grid">{children}</div>;
}

const TILE_ICON = { card: CreditCard, users: Users, bell: Bell, shield: ShieldCheck, receipt: Receipt, help: HelpCircle, diamond: Gem } as const;
export type SettingsTileIcon = keyof typeof TILE_ICON;

/** Carte de réglage cliquable (icône Lucide propre, pas d'emoji). */
export function SettingsCard({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: SettingsTileIcon }) {
  const Icon = TILE_ICON[icon];
  return (
    <Link href={href} className="st-tile">
      <span className="st-tile__icon"><Icon className="h-[23px] w-[23px]" strokeWidth={1.9} aria-hidden="true" /></span>
      <span className="st-tile__copy">
        <h3>{title}</h3>
        <p>{desc}</p>
      </span>
    </Link>
  );
}

/** Bandeau d'information de bas de page (cloisonnement). */
export function SettingsNotice({ children }: { children: ReactNode }) {
  return <div className="st-note">{children}</div>;
}

/** Lien de retour vers /settings (pages internes). */
export function SettingsBackLink({ href = "/settings", children = "Retour aux paramètres" }: { href?: string; children?: ReactNode }) {
  return (
    <Link href={href} className="st-backlink">
      <ArrowLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      {children}
    </Link>
  );
}

/** Page interne paramètres : header + retour + bandeau + contenu + cloisonnement. */
export function SettingsSubPage({ title, subtitle, backHref = "/settings", notice = true, children }: {
  title: string; subtitle?: string; backHref?: string; notice?: boolean; children: ReactNode;
}) {
  return (
    <SettingsShell>
      <SettingsTopHeader title={title} subtitle={subtitle} />
      <SettingsBackLink href={backHref} />
      <SettingsHero title={title} subtitle={subtitle} />
      <div className="st-substack">{children}</div>
      {notice ? (
        <SettingsNotice>Votre espace est cloisonné : vous ne voyez que vos données.</SettingsNotice>
      ) : null}
    </SettingsShell>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";

/* Composants du dashboard SuperAdmin Gedify — langage visuel « ticket / premium »
   (cf. superadmin-ui.css, porté de la maquette validée). Réutilisables sur les
   pages /admin/saas/* (jamais sur settings tenant). */

export type SuperAdminMetricVariant = "blue" | "green" | "amber" | "pink" | "neutral";

/** Coque de page SuperAdmin : <main> + fond premium léger (classe .sa-page). */
export function SuperAdminPageShell({ children }: { children: ReactNode }) {
  return <PageShell className="sa-page">{children}</PageShell>;
}

type Crumb = { href?: string; label: string };

/** Hero de page : fil d'Ariane optionnel, eyebrow, titre, sous-titre, orbe. */
export function SuperAdminHero({ eyebrow, title, subtitle, icon, breadcrumb }: {
  eyebrow?: string; title: string; subtitle?: string; icon?: ReactNode; breadcrumb?: Crumb[];
}) {
  return (
    <section className="sa-hero">
      <div className="sa-hero__main">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="sa-hero__crumbs" aria-label="Fil d'Ariane">
            {breadcrumb.map((c, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="inline-flex items-center gap-2">
                  {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <strong>{c.label}</strong>}
                  {!last ? <span className="sa-hero__sep">/</span> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        {eyebrow ? <span className="sa-hero__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {icon ? <div className="sa-hero__orb" aria-hidden="true">{icon}</div> : null}
    </section>
  );
}

/** Grille des cartes métriques (4 → 2 → 1 colonne). */
export function SuperAdminMetricGrid({ children }: { children: ReactNode }) {
  return <section className="sa-metric-grid">{children}</section>;
}

/** Carte métrique « ticket » : rail coloré, icône, grand chiffre, mini-chart,
    bande basse. `variant` = blue|green|amber|pink|neutral. */
export function SuperAdminMetricCard({
  title, value, description, variant = "neutral", icon, trendLabel, footerLabel, trendValue, chartType = "bars", href,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  variant?: SuperAdminMetricVariant;
  icon?: ReactNode;
  trendLabel?: string;   // pastille en haut à droite (Total / 100 % / En cours…)
  footerLabel?: string;  // texte principal de la bande basse
  trendValue?: string;   // petite mention accentuée (vs 30j…)
  chartType?: "bars" | "none";
  href?: string;
}) {
  const cls = `sa-metric sa-metric--${variant}`;
  const inner = (
    <>
      <div className="sa-metric__head">
        {icon ? <span className="sa-metric__icon" aria-hidden="true">{icon}</span> : null}
        <span className="sa-metric__title">{title}</span>
        {trendLabel ? <span className="sa-metric__chip">{trendLabel}</span> : null}
      </div>
      <div className="sa-metric__body">
        <strong>{value}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {chartType === "bars" ? (
        <span className="sa-metric__chart" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      ) : null}
      {footerLabel || trendValue ? (
        <div className="sa-metric__foot">
          <span>{footerLabel}</span>
          {trendValue ? <small>{trendValue}</small> : null}
        </div>
      ) : null}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <article className={cls}>{inner}</article>;
}

/** Panneau (carte large) avec en-tête optionnel (titre + actions). */
export function SuperAdminPanel({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="sa-panel">
      {title || actions ? (
        <div className="sa-panel__head">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="sa-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** En-tête de section autonome (réutilisable hors panneau). */
export function SuperAdminSectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="sa-panel__head">
      <h2>{title}</h2>
      {actions ? <div className="sa-panel__actions">{actions}</div> : null}
    </div>
  );
}

/** Grille générique responsive (2/3/4 colonnes). */
export function SuperAdminGrid({ columns = 4, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return <div className={`sa-grid sa-grid--${columns}`}>{children}</div>;
}

/** Carte d'action / accès rapide (badge + libellé + chip optionnel). */
export function SuperAdminActionCard({ href, label, icon, badge }: { href: string; label: string; icon?: ReactNode; badge?: string }) {
  return (
    <Link href={href} className="sa-quick__link">
      <span className="sa-quick__badge" aria-hidden="true">{icon ?? "→"}</span>
      <span className="sa-quick__label">{label}</span>
      {badge ? <span className="sa-quick__chip">{badge}</span> : null}
    </Link>
  );
}

/** Liste d'alertes (compteur + libellé + détail). */
export function SuperAdminAlertList({ items }: { items: { key?: string; count: ReactNode; label: string; detail?: string }[] }) {
  return (
    <div className="sa-alerts">
      {items.map((it, i) => (
        <div key={it.key ?? `${it.label}-${i}`} className="sa-alerts__item">
          <b className="sa-alerts__count">{it.count}</b>
          <span className="sa-alerts__label">{it.label}</span>
          {it.detail ? <em className="sa-alerts__detail">{it.detail}</em> : null}
        </div>
      ))}
    </div>
  );
}

/** Carte enveloppant un tableau (en-tête + zone scrollable bordée). */
export function SuperAdminTableCard({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <SuperAdminPanel title={title} actions={actions}>
      <div className="sa-table-wrap">{children}</div>
    </SuperAdminPanel>
  );
}

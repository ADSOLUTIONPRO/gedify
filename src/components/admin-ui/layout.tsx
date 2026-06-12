import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, CheckCircle2, AlertTriangle, XCircle, Inbox, ChevronRight } from "lucide-react";

/* Cartes, stats, badges, alertes, tabs, empty-state — design system Admin. */

export function AdminCard({ icon: Icon, title, subtitle, actions, flush, accent, id, children }: {
  icon?: LucideIcon; title?: string; subtitle?: string; actions?: ReactNode; flush?: boolean; accent?: boolean; id?: string; children: ReactNode;
}) {
  return (
    <section className={`au-card${accent ? " au-card--accent" : ""}`} id={id}>
      {title || actions ? (
        <div className="au-card__head">
          {Icon ? <span className="au-card__icon"><Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /></span> : null}
          <div className="min-w-0 flex-1">
            {title ? <div className="au-card__title">{title}</div> : null}
            {subtitle ? <div className="au-card__sub">{subtitle}</div> : null}
          </div>
          {actions ? <div className="au-toolbar">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`au-card__body${flush ? " au-card__body--flush" : ""}`}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const SPARK_COLOR: Record<Tone, string> = {
  neutral: "#94A3B8", accent: "#F6508A", success: "#10B981", warning: "#F59E0B", danger: "#EF4444", info: "#2563EB",
};
/** Sparkline purement décoratif (pas de données) — repère visuel sur les stat cards. */
function AuSpark({ tone }: { tone: Tone }) {
  const c = SPARK_COLOR[tone];
  return (
    <svg className="au-stat__spark" width="62" height="22" viewBox="0 0 62 22" fill="none" aria-hidden="true">
      <path d="M1 17 L11 13 L21 15 L31 8 L42 10 L52 4 L61 6 L61 21 L1 21 Z" fill={c} opacity="0.10" />
      <path d="M1 17 L11 13 L21 15 L31 8 L42 10 L52 4 L61 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminStatCard({ label, value, desc, tone = "neutral", icon: Icon, spark }: {
  label: string; value: ReactNode; desc?: string; tone?: Tone; icon?: LucideIcon; spark?: boolean;
}) {
  return (
    <div className={`au-stat${tone !== "neutral" ? ` au-stat--${tone}` : ""}`}>
      {Icon || spark ? (
        <div className="au-stat__top">
          {Icon ? <span className={`au-stat__icon au-stat__icon--${tone}`}><Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /></span> : null}
          <span className="au-stat__label" style={{ flex: "1 1 auto" }}>{label}</span>
          {spark ? <AuSpark tone={tone} /> : null}
        </div>
      ) : (
        <div className="au-stat__label">{label}</div>
      )}
      <div className="au-stat__value">{value}</div>
      {desc ? <div className="au-stat__desc">{desc}</div> : null}
    </div>
  );
}
export function AdminStats({ children }: { children: ReactNode }) {
  return <div className="au-stats">{children}</div>;
}

export function AdminBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`au-badge au-badge--${tone}`}>{children}</span>;
}

const ALERT_ICON: Record<string, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
export function AdminAlert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`au-alert au-alert--${tone}`} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <Icon className="au-alert__icon h-4 w-4" strokeWidth={2} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function AdminEmptyState({ icon: Icon = Inbox, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="au-empty">
      <span className="au-empty__icon"><Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" /></span>
      <div className="au-empty__title">{title}</div>
      {children ? <div className="mt-1 text-[13px]">{children}</div> : null}
    </div>
  );
}

/** Bouton de navigation plein (bleu nuit ou rose Gedify) — remplace les
    « widgets » cliquables plats par de vrais boutons identifiables. */
export function AdminNavTile({ href, icon: Icon, title, desc, tone = "navy" }: {
  href: string; icon?: LucideIcon; title: string; desc?: string; tone?: "navy" | "pink";
}) {
  return (
    <a href={href} className={`au-navtile au-navtile--${tone}`}>
      {Icon ? <span className="au-navtile__icon"><Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /></span> : null}
      <span className="au-navtile__body">
        <span className="au-navtile__title">{title}</span>
        {desc ? <span className="au-navtile__desc">{desc}</span> : null}
      </span>
      <ChevronRight className="au-navtile__chevron h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

/** Grille responsive de boutons de navigation (AdminNavTile). */
export function AdminNavGrid({ columns = 4, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return <div className={`au-navgrid au-navgrid--${columns}`}>{children}</div>;
}

export function AdminTabs({ tabs }: { tabs: { href: string; label: string; active?: boolean }[] }) {
  return (
    <nav className="au-tabs">
      {tabs.map((t) => <a key={t.href} href={t.href} className={`au-tab${t.active ? " au-tab--active" : ""}`}>{t.label}</a>)}
    </nav>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="au-toolbar">{children}</div>;
}
export function AdminToolbarSpacer() { return <span className="au-toolbar__spacer" />; }

/** Badge d'espace courant pour la topbar (Superadmin vs Tenant). */
export function AdminScopeBadge({ variant, children }: { variant: "admin" | "tenant"; children: ReactNode }) {
  return <span className={`au-badge-scope au-badge-scope--${variant}`}>{children}</span>;
}

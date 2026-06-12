import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, CheckCircle2, AlertTriangle, XCircle, Inbox } from "lucide-react";

/* Cartes, stats, badges, alertes, tabs, empty-state — design system Admin. */

export function AdminCard({ icon: Icon, title, subtitle, actions, flush, children }: {
  icon?: LucideIcon; title?: string; subtitle?: string; actions?: ReactNode; flush?: boolean; children: ReactNode;
}) {
  return (
    <section className="au-card">
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
export function AdminStatCard({ label, value, desc, tone = "neutral" }: { label: string; value: ReactNode; desc?: string; tone?: Tone }) {
  return (
    <div className={`au-stat${tone !== "neutral" ? ` au-stat--${tone}` : ""}`}>
      <div className="au-stat__label">{label}</div>
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

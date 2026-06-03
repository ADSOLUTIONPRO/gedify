import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type BackLink = {
  href: string;
  label: string;
};

type Crumb = {
  href?: string;
  label: string;
};

type PageHeaderProps = {
  eyebrow?: string;
  breadcrumb?: Crumb[];
  title: string;
  greeting?: string;
  description?: string;
  actions?: ReactNode;
  backLink?: BackLink;
  /** When true, applies tighter spacing/typography for dense pages. */
  compact?: boolean;
};

export function PageHeader({
  eyebrow,
  breadcrumb,
  title,
  greeting,
  description,
  actions,
  backLink,
  compact,
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col justify-between gap-4 lg:flex-row lg:items-end ${
        compact ? "mb-4" : "mb-5"
      }`}
    >
      <div className="min-w-0">
        {backLink ? (
          <Link
            href={backLink.href}
            className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {backLink.label}
          </Link>
        ) : null}
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav
            aria-label="Fil d'Ariane"
            className="mb-1.5 flex items-center gap-1 text-[12px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {breadcrumb.map((crumb, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="transition hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span style={{ color: isLast ? "var(--text-main)" : "var(--text-muted)" }}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast ? (
                    <ChevronRight className="h-3 w-3 opacity-50" strokeWidth={2} aria-hidden="true" />
                  ) : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        {eyebrow ? (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--blue-600)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        {greeting ? (
          <p
            className="mt-1 text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {greeting}
          </p>
        ) : null}
        <h1
          className={`font-extrabold tracking-tight ${
            compact ? "text-xl lg:text-2xl" : "text-2xl lg:text-[28px]"
          } ${eyebrow || breadcrumb ? "mt-0.5" : ""}`}
          style={{ color: "var(--text-main)" }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="mt-1 max-w-3xl text-sm leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

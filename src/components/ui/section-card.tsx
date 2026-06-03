import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type SectionCardProps = {
  id?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={`rounded-2xl bg-white ${className}`}
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 2px 16px -4px rgba(8,18,37,0.07)",
      }}
    >
      {title || actions ? (
        <div
          className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-start gap-3 min-w-0">
            {Icon ? (
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(11,92,255,0.08)",
                  color: "var(--blue-600)",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2
                  className="text-base font-extrabold tracking-tight"
                  style={{ color: "var(--text-main)" }}
                >
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

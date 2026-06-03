import type { ReactNode } from "react";

type CompactCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CompactCard({
  title,
  description,
  actions,
  children,
  className = "",
}: CompactCardProps) {
  return (
    <section
      className={`rounded-2xl bg-white ${className}`}
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 10px -4px rgba(8,18,37,0.08)",
      }}
    >
      {title || actions ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            {title ? (
              <h2 className="truncate text-sm font-extrabold" style={{ color: "var(--text-main)" }}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

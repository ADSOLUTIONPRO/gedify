import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type GradientPanelProps = {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  ctaLabel?: string;
  ctaHref?: string;
  children?: ReactNode;
  className?: string;
  variant?: "default" | "compact";
};

export function GradientPanel({
  title,
  subtitle,
  icon: Icon,
  ctaLabel,
  ctaHref,
  children,
  className = "",
  variant = "default",
}: GradientPanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: "linear-gradient(160deg, #061B4A 0%, #082060 50%, #0A2875 100%)",
        border: "1px solid rgba(43,123,255,0.25)",
        boxShadow:
          "0 0 40px -10px rgba(43,123,255,0.22), 0 8px 32px -8px rgba(6,19,38,0.45)",
      }}
    >
      <div
        className="pointer-events-none absolute right-0 top-0 h-40 w-40"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(43,123,255,0.3) 0%, transparent 60%)",
        }}
      />
      <div className={`relative ${variant === "compact" ? "p-4" : "p-5"}`}>
        {(title || subtitle) && (
          <div className="flex items-start gap-3">
            {Icon ? (
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(43,123,255,0.18)",
                  color: "#9CC1FF",
                  border: "1px solid rgba(43,123,255,0.28)",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h3 className="text-base font-extrabold tracking-tight text-white">
                  {title}
                </h3>
              ) : null}
              {subtitle ? (
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "rgba(150,185,240,0.85)" }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        )}
        {children ? <div className={title || subtitle ? "mt-4" : ""}>{children}</div> : null}
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

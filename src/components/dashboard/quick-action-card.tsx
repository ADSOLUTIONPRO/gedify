import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type QuickActionCardProps = {
  href: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description: string;
  badge?: string;
};

export function QuickActionCard({
  href,
  icon: Icon,
  iconBg = "rgba(11,92,255,0.1)",
  iconColor = "var(--blue-600)",
  title,
  description,
  badge,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl bg-white p-4 transition hover:shadow-md hover:-translate-y-0.5"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 8px -2px rgba(8,18,37,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} strokeWidth={1.75} aria-hidden="true" />
        </span>
        {badge ? (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(124,58,237,0.1)", color: "var(--violet)" }}>
            {badge}
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-main)" }}>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>
    </Link>
  );
}

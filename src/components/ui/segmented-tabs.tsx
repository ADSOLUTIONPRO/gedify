import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type SegmentedTab = {
  href: string;
  label: string;
  icon?: LucideIcon;
  count?: number | string;
  matchPath?: string;
};

type SegmentedTabsProps = {
  tabs: SegmentedTab[];
  activeHref: string;
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedTabs({
  tabs,
  activeHref,
  size = "md",
  className = "",
}: SegmentedTabsProps) {
  const heightClass = size === "sm" ? "h-9" : "h-10";
  const paddingClass = size === "sm" ? "px-3" : "px-3.5";
  const textClass = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl p-1 ${className}`}
      style={{
        background: "white",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px -1px rgba(8,18,37,0.05)",
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          activeHref === tab.href ||
          (tab.matchPath && activeHref.startsWith(tab.matchPath));
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex ${heightClass} items-center gap-1.5 rounded-lg ${paddingClass} font-semibold ${textClass} transition`}
            style={
              isActive
                ? {
                    background: "var(--navy-900)",
                    color: "white",
                  }
                : {
                    color: "var(--text-muted)",
                  }
            }
          >
            {Icon ? (
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            ) : null}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && tab.count !== "" ? (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={
                  isActive
                    ? {
                        background: "rgba(255,255,255,0.18)",
                        color: "white",
                      }
                    : {
                        background: "rgba(11,92,255,0.10)",
                        color: "var(--blue-600)",
                      }
                }
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type ViewToggleOption = {
  value: string;
  icon: LucideIcon;
  label: string;
};

type ViewToggleProps = {
  options: ViewToggleOption[];
  active: string;
  hrefBuilder: (value: string) => string;
};

/**
 * Segmented control « Grille / Liste » : conteneur pilule clair, segment actif
 * en bleu nuit, inactif neutre. Icône + label (label masqué < sm).
 */
export function ViewToggle({ options, active, hrefBuilder }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full p-1"
      style={{ background: "var(--bg-card-soft)" }}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = option.value === active;
        const Icon = option.icon;
        return (
          <Link
            key={option.value}
            href={hrefBuilder(option.value)}
            role="tab"
            aria-selected={isActive}
            title={option.label}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition"
            style={
              isActive
                ? { background: "var(--gedify-navy)", color: "#fff", boxShadow: "var(--shadow-xs)" }
                : { color: "var(--text-secondary)" }
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type HeroMetricCardProps = {
  label: string;
  value: ReactNode;
  helper: ReactNode;
  icon: LucideIcon;
  iconColor?: string;
};

export function HeroMetricCard({ label, value, helper, icon: Icon, iconColor = "#60A5FA" }: HeroMetricCardProps) {
  return (
    <div
      className="flex min-w-[100px] flex-col gap-1 rounded-xl p-2.5"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <Icon className="h-3 w-3" style={{ color: iconColor }} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: "rgba(210,217,231,0.82)" }}>
          {label}
        </span>
      </div>
      <div className="text-lg font-extrabold text-white leading-none">{value}</div>
      <div className="text-[10px] font-medium leading-tight truncate" style={{ color: "rgba(193,202,219,0.8)" }}>
        {helper}
      </div>
    </div>
  );
}

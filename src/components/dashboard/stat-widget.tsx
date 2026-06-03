import { WidgetShell } from "@/components/dashboard/widget-shell";
import { Sparkline } from "@/components/dashboard/sparkline";
import { TrendingUp } from "lucide-react";
import { getSpaceById } from "@/config/spaces";

/**
 * Widget statistique (Documents, Messagerie, Finances, Analyse IA) :
 * grande valeur + libellé + tendance (↗ +X ce mois-ci) + sparkline.
 */
export function StatWidget({
  spaceId,
  title,
  href,
  value,
  label,
  trend,
  ctaLabel,
  ctaHref,
  dragHandleProps,
}: {
  spaceId: string;
  title: string;
  href?: string;
  value: string | number;
  label: string;
  trend?: string;
  ctaLabel?: string;
  ctaHref?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const color = getSpaceById(spaceId)?.color ?? "#8B95A7";

  return (
    <WidgetShell spaceId={spaceId} title={title} href={href} ctaLabel={ctaLabel} ctaHref={ctaHref} dragHandleProps={dragHandleProps} tone="soft">
      <p className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: "var(--text-main)" }}>
        {value}
      </p>
      <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {trend ? (
        <p className="mt-1 flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--text-hint)" }}>
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {trend}
        </p>
      ) : null}
      <div className="mt-3">
        <Sparkline color={color} />
      </div>
    </WidgetShell>
  );
}

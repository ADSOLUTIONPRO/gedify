import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { RightRailCard } from "@/components/ui/right-rail-card";
import {
  formatDateRelative,
  formatEventSource,
} from "@/lib/activity/activity-formatters";
import type { ActivityEvent } from "@/lib/activity/activity-aggregator";

type ActivityAlertsCardProps = {
  alerts: ActivityEvent[];
};

export function ActivityAlertsCard({ alerts }: ActivityAlertsCardProps) {
  return (
    <RightRailCard
      title="Alertes / erreurs"
      icon={AlertTriangle}
      iconTone={alerts.length > 0 ? "rose" : "emerald"}
      ctaHref={alerts.length > 0 ? "/journaux" : undefined}
      ctaLabel={alerts.length > 0 ? "Voir tout" : undefined}
    >
      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} strokeWidth={2} />
          Aucune alerte détectée.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alerts.slice(0, 6).map((alert) => {
            const item = (
              <div className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(239,68,68,0.10)",
                    color: "#DC2626",
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-bold"
                    style={{ color: "var(--text-main)" }}
                    title={alert.title}
                  >
                    {alert.title}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                    title={alert.description}
                  >
                    {alert.description}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatEventSource(alert.source)} · {formatDateRelative(alert.timestamp)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={alert.id}>
                {alert.href ? (
                  <Link href={alert.href} className="block">
                    {item}
                  </Link>
                ) : (
                  item
                )}
              </li>
            );
          })}
        </ul>
      )}
    </RightRailCard>
  );
}

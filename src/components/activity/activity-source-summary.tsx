import { Layers3 } from "lucide-react";
import { RightRailCard } from "@/components/ui/right-rail-card";
import {
  formatEventSource,
  sourceAccent,
  type ActivitySource,
} from "@/lib/activity/activity-formatters";

type ActivitySourceSummaryProps = {
  counts: Record<ActivitySource, number>;
};

export function ActivitySourceSummary({ counts }: ActivitySourceSummaryProps) {
  const rows: { source: ActivitySource; count: number }[] = (
    ["paperless", "tasks", "ai", "email", "budget", "workflow", "system"] as ActivitySource[]
  )
    .map((source) => ({ source, count: counts[source] ?? 0 }))
    .filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <RightRailCard title="Activité par source" icon={Layers3} iconTone="blue">
      {rows.length === 0 ? (
        <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Aucune activité enregistrée pour le moment.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            const accent = sourceAccent(row.source);
            return (
              <div key={row.source}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold" style={{ color: "var(--text-main)" }}>
                    {formatEventSource(row.source)}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      {row.count}
                    </span>{" "}
                    · {pct}%
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "rgba(11,92,255,0.06)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, pct)}%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RightRailCard>
  );
}

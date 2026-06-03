import Link from "next/link";
import {
  CheckCircle2,
  Cog,
  Loader2,
  XCircle,
} from "lucide-react";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatDateRelative,
  formatEventStatus,
  type ActivityStatus,
} from "@/lib/activity/activity-formatters";
import type { ActivityEvent } from "@/lib/activity/activity-aggregator";

type RecentTasksListProps = {
  tasks: ActivityEvent[];
};

function StatusIcon({ status }: { status: ActivityStatus }) {
  const props = { className: "h-3.5 w-3.5", strokeWidth: 2 };
  if (status === "success" || status === "imported") {
    return <CheckCircle2 {...props} style={{ color: "#16A34A" }} />;
  }
  if (status === "error") {
    return <XCircle {...props} style={{ color: "#DC2626" }} />;
  }
  if (status === "in_progress") {
    return <Loader2 {...props} className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--blue-600)" }} />;
  }
  return <Cog {...props} style={{ color: "var(--text-muted)" }} />;
}

function statusTone(status: ActivityStatus): "emerald" | "blue" | "rose" | "amber" | "slate" {
  if (status === "success" || status === "imported") return "emerald";
  if (status === "error") return "rose";
  if (status === "in_progress") return "blue";
  if (status === "to_validate" || status === "pending") return "amber";
  return "slate";
}

export function RecentTasksList({ tasks }: RecentTasksListProps) {
  return (
    <RightRailCard
      title="Tâches en cours"
      icon={Cog}
      iconTone="blue"
      ctaHref="/journaux"
      ctaLabel="Voir tout"
    >
      {tasks.length === 0 ? (
        <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Aucune tâche récente détectée.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 6).map((task) => {
            const item = (
              <div className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                <span className="mt-0.5">
                  <StatusIcon status={task.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-bold"
                    style={{ color: "var(--text-main)" }}
                    title={task.title}
                  >
                    {task.title}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                    title={task.description}
                  >
                    {task.description}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDateRelative(task.timestamp)}
                  </p>
                </div>
                <StatusPill tone={statusTone(task.status)} dot>
                  {formatEventStatus(task.status)}
                </StatusPill>
              </div>
            );
            return (
              <li key={task.id}>
                {task.href ? (
                  <Link href={task.href} className="block">
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

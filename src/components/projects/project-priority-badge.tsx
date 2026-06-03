import type { ProjectPriority } from "@/lib/projects/project-types";

type ProjectPriorityBadgeProps = {
  priority: ProjectPriority;
};

const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  Basse: "bg-slate-50 text-slate-600 ring-slate-200",
  Normale: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Haute: "bg-amber-50 text-amber-700 ring-amber-100",
  Urgente: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function ProjectPriorityBadge({ priority }: ProjectPriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${PRIORITY_CLASSES[priority]}`}
    >
      Priorité {priority.toLowerCase()}
    </span>
  );
}

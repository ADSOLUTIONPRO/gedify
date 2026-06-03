import type { ProjectStatus } from "@/lib/projects/project-types";

type ProjectStatusBadgeProps = {
  status: ProjectStatus;
};

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  "En cours": "bg-blue-50 text-blue-700 ring-blue-100",
  "À traiter": "bg-amber-50 text-amber-700 ring-amber-100",
  "En attente": "bg-violet-50 text-violet-700 ring-violet-100",
  Important: "bg-rose-50 text-rose-700 ring-rose-100",
  Terminé: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Archivé: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}

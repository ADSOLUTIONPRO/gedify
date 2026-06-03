import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Pencil, Users } from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";
import type { ProjectFolder } from "@/lib/projects/project-types";

type ProjectCardProps = {
  project: ProjectFolder;
  correspondents?: PaperlessCorrespondent[];
  tags?: PaperlessTag[];
  types?: PaperlessDocumentType[];
};

function namesFromIds<T extends { id: number; name: string }>(items: T[], ids: number[], limit = 2) {
  return items
    .filter((item) => ids.includes(item.id))
    .slice(0, limit)
    .map((item) => item.name);
}

export function ProjectCard({
  project,
  correspondents = [],
  tags = [],
  types = [],
}: ProjectCardProps) {
  const linkedTags = tags.filter((tag) => project.linkedTagIds.includes(tag.id)).slice(0, 3);
  const linkedCorrespondents = namesFromIds(correspondents, project.linkedCorrespondentIds);
  const linkedTypes = namesFromIds(types, project.linkedDocumentTypeIds);

  return (
    <article className="group rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_12px_36px_-18px_rgba(15,23,42,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_18px_46px_-20px_rgba(37,99,235,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: project.color }}
          >
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              {project.category}
            </p>
            <h2 className="mt-1 truncate text-lg font-extrabold tracking-tight text-slate-950">
              {project.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
              {project.description || "Aucune description renseignée."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ProjectStatusBadge status={project.status} />
          <ProjectPriorityBadge priority={project.priority} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50/80 p-4 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-slate-600">
          <FileText className="h-4 w-4 text-blue-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="font-semibold text-slate-900">{project.linkedDocumentIds.length}</span>
          document(s)
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="h-4 w-4 text-emerald-500" strokeWidth={1.75} aria-hidden="true" />
          <span className="font-semibold text-slate-900">
            {project.linkedCorrespondentIds.length}
          </span>
          correspondant(s)
        </div>
        <div className="flex items-center gap-2 text-slate-600 sm:col-span-2">
          <CalendarClock className="h-4 w-4 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
          <span>Échéance : {formatDate(project.dueDate)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {linkedTags.length > 0 ? (
            linkedTags.map((tag) => <BadgeTag key={tag.id} tag={tag} compact />)
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              Aucun tag lié
            </span>
          )}
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {linkedCorrespondents.length > 0
            ? `Correspondants : ${linkedCorrespondents.join(", ")}`
            : "Aucun correspondant lié"}
          {linkedTypes.length > 0 ? ` · Types : ${linkedTypes.join(", ")}` : ""}
        </p>
        <p className="text-xs text-slate-400">Mis à jour le {formatDateTime(project.updatedAt)}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/dossiers/${project.id}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.35)] transition hover:from-blue-500 hover:to-blue-600"
        >
          Ouvrir
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
        <Link
          href={`/dossiers/${project.id}/modifier`}
          className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Modifier
        </Link>
      </div>
    </article>
  );
}

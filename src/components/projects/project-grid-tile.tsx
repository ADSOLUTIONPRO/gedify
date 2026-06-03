import Link from "next/link";
import { CalendarClock, FileText, Users } from "lucide-react";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { formatDate } from "@/lib/format";
import type { ProjectFolder } from "@/lib/projects/project-types";

type ProjectGridTileProps = {
  project: ProjectFolder;
};

export function ProjectGridTile({ project }: ProjectGridTileProps) {
  return (
    <Link
      href={`/dossiers/${project.id}`}
      className="group flex flex-col gap-4 rounded-2xl bg-white p-4 transition hover:shadow-md"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 8px -2px rgba(8,18,37,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: project.color || "var(--blue-600)" }}
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "var(--text-muted)" }}
            >
              {project.category}
            </p>
            <p
              className="mt-0.5 truncate text-sm font-extrabold tracking-tight"
              style={{ color: "var(--text-main)" }}
              title={project.name}
            >
              {project.name}
            </p>
          </div>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {project.description ? (
        <p
          className="line-clamp-2 text-xs leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          {project.description}
        </p>
      ) : null}

      <div
        className="grid grid-cols-3 gap-3 rounded-xl p-3"
        style={{ background: "rgba(11,92,255,0.04)" }}
      >
        <div className="text-center">
          <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
            {project.linkedDocumentIds.length}
          </p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Docs
          </p>
        </div>
        <div className="text-center" style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
            {project.linkedCorrespondentIds.length}
          </p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Acteurs
          </p>
        </div>
        <div className="text-center">
          <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
            {project.linkedTagIds.length}
          </p>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Tags
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {project.dueDate ? `Échéance ${formatDate(project.dueDate)}` : "Sans échéance"}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {project.priority}
        </span>
      </div>
    </Link>
  );
}

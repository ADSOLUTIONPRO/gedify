import Link from "next/link";
import { Folder, FolderKanban, ChevronRight, Plus } from "lucide-react";
import type { ProjectFolder } from "@/lib/projects/project-types";

type RecentProjectsCardProps = {
  projects: ProjectFolder[];
};

export function RecentProjectsCard({ projects }: RecentProjectsCardProps) {
  return (
    <div
      className="rounded-2xl bg-white p-5"
      style={{ border: "1px solid var(--border)", boxShadow: "0 2px 16px -4px rgba(8,18,37,0.07)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "rgba(11,92,255,0.1)" }}
          >
            <FolderKanban className="h-4 w-4" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3 className="text-sm font-extrabold" style={{ color: "var(--text-main)" }}>
            Dossiers / Projets récents
          </h3>
        </div>
        <Link
          href="/dossiers"
          className="text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--blue-600)" }}
        >
          Voir tous →
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "rgba(11,92,255,0.07)" }}
          >
            <Folder className="h-7 w-7" style={{ color: "var(--blue-600)" }} strokeWidth={1.25} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
              Aucun dossier actif
            </p>
            <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
              Créez des dossiers/projets pour regrouper<br />les documents liés à une affaire.
            </p>
          </div>
          <Link
            href="/dossiers/nouveau"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Créer un dossier
          </Link>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {projects.slice(0, 4).map((project) => (
            <Link
              key={project.id}
              href={`/dossiers/${project.id}`}
              className="flex items-center justify-between gap-3 py-3 transition hover:opacity-80"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {project.name}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {project.status} · {project.linkedDocumentIds.length} doc(s)
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

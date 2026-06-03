import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  FileText,
  FolderKanban,
  FolderPlus,
  LayoutGrid,
  ListChecks,
  Sparkles,
  Table2,
  Wallet,
} from "lucide-react";
import { ProjectGridTile } from "@/components/projects/project-grid-tile";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatCard } from "@/components/ui/stat-card";
import { ViewToggle } from "@/components/ui/view-toggle";
import { formatDate } from "@/lib/format";
import { firstParam, type PageSearchParams } from "@/lib/page-params";
import { getCorrespondents, getDocumentTypes, getTags } from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";
import type { ProjectFolder } from "@/lib/projects/project-types";

export const dynamic = "force-dynamic";

function buildQueryString(
  current: Record<string, string | string[] | undefined>,
  changes: Record<string, string | undefined>
) {
  const merged: Record<string, string> = {};
  for (const key of Object.keys(current)) {
    const v = firstParam(current, key);
    if (v) merged[key] = v;
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === "") {
      delete merged[k];
    } else {
      merged[k] = v;
    }
  }
  const usp = new URLSearchParams(merged).toString();
  return usp ? `?${usp}` : "";
}

function filterByStatus(projects: ProjectFolder[], status: string) {
  if (status === "active") {
    return projects.filter((p) => p.status !== "Archivé" && p.status !== "Terminé");
  }
  if (status === "completed") {
    return projects.filter((p) => p.status === "Terminé");
  }
  if (status === "archived") {
    return projects.filter((p) => p.status === "Archivé");
  }
  if (status === "urgent") {
    return projects.filter((p) => p.priority === "Urgente" || p.status === "Important");
  }
  return projects;
}

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const view = firstParam(params, "view", "grid");
  const status = firstParam(params, "status", "all");

  try {
    const [projects, correspondentsData, tagsData, typesData] = await Promise.all([
      listProjectFolders(),
      getCorrespondents({ page_size: 1000 }),
      getTags({ page_size: 1000 }),
      getDocumentTypes({ page_size: 1000 }),
    ]);

    const correspondents = correspondentsData.results ?? [];
    const tags = tagsData.results ?? [];
    const types = typesData.results ?? [];

    void correspondents;
    void tags;
    void types;

    const activeProjects = projects.filter(
      (p) => p.status !== "Archivé" && p.status !== "Terminé"
    );
    const completedProjects = projects.filter((p) => p.status === "Terminé");
    const archivedProjects = projects.filter((p) => p.status === "Archivé");
    const urgentProjects = projects.filter(
      (p) => p.priority === "Urgente" || p.status === "Important"
    );
    const linkedDocumentCount = projects.reduce(
      (total, p) => total + p.linkedDocumentIds.length,
      0
    );
    const upcomingProjects = projects
      .filter((p) => p.dueDate && new Date(p.dueDate) >= new Date())
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
      .slice(0, 5);

    const filtered = filterByStatus(projects, status);

    const tabs = [
      { href: `/dossiers${buildQueryString(params, { status: undefined })}`, label: "Tous", count: projects.length },
      { href: `/dossiers${buildQueryString(params, { status: "active" })}`, label: "Actifs", count: activeProjects.length },
      { href: `/dossiers${buildQueryString(params, { status: "urgent" })}`, label: "Urgents", count: urgentProjects.length },
      { href: `/dossiers${buildQueryString(params, { status: "completed" })}`, label: "Terminés", count: completedProjects.length },
      { href: `/dossiers${buildQueryString(params, { status: "archived" })}`, label: "Archivés", count: archivedProjects.length },
    ];

    const currentTabHref =
      status === "active"
        ? tabs[1].href
        : status === "urgent"
        ? tabs[2].href
        : status === "completed"
        ? tabs[3].href
        : status === "archived"
        ? tabs[4].href
        : tabs[0].href;

    const columns: DataTableColumn<ProjectFolder>[] = [
      {
        header: "Dossier",
        cell: (project) => (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: project.color || "var(--blue-600)" }}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <Link
                href={`/dossiers/${project.id}`}
                className="font-bold transition hover:opacity-80"
                style={{ color: "var(--text-main)" }}
              >
                {project.name}
              </Link>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {project.category}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: "Statut",
        cell: (project) => <ProjectStatusBadge status={project.status} />,
      },
      {
        header: "Priorité",
        cell: (project) => <ProjectPriorityBadge priority={project.priority} />,
      },
      {
        header: "Docs",
        cell: (project) => (
          <span className="font-bold" style={{ color: "var(--text-main)" }}>
            {project.linkedDocumentIds.length}
          </span>
        ),
      },
      {
        header: "Échéance",
        cell: (project) => (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {project.dueDate ? formatDate(project.dueDate) : "—"}
          </span>
        ),
      },
      {
        header: "",
        className: "text-right",
        cell: (project) => (
          <Link
            href={`/dossiers/${project.id}`}
            className="text-xs font-bold"
            style={{ color: "var(--blue-600)" }}
          >
            Ouvrir →
          </Link>
        ),
      },
    ];

    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { label: "Dossiers / Projets" },
          ]}
          title="Dossiers / Projets"
          description="Organisez vos affaires et regroupez vos documents par dossier ou par projet."
          actions={
            <>
              <ViewToggle
                options={[
                  { value: "grid", icon: LayoutGrid, label: "Grille" },
                  { value: "table", icon: Table2, label: "Liste" },
                ]}
                active={view}
                hrefBuilder={(v) => `/dossiers${buildQueryString(params, { view: v })}`}
              />
              <Link
                href="/dossiers/nouveau"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--blue-600)" }}
              >
                <FolderPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Créer un dossier
              </Link>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Dossiers"
            value={projects.length}
            helper="surcouche Gedify"
            icon={FolderKanban}
            tone="blue"
          />
          <StatCard
            label="Actifs"
            value={activeProjects.length}
            helper="hors terminés et archivés"
            icon={ListChecks}
            tone="emerald"
          />
          <StatCard
            label="Documents liés"
            value={linkedDocumentCount}
            helper="liaisons documents"
            icon={FileText}
            tone="violet"
          />
          <StatCard
            label="Urgents"
            value={urgentProjects.length}
            helper="priorité haute"
            icon={AlertTriangle}
            tone={urgentProjects.length > 0 ? "amber" : "slate"}
          />
        </div>

        <SegmentedTabs tabs={tabs} activeHref={currentTabHref} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left column */}
          <div className="space-y-5">
            <SectionCard
              title="Dossiers"
              description={`${filtered.length} dossier(s) affiché(s) · ${projects.length} au total`}
              bodyClassName=""
            >
              {filtered.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="Aucun dossier ne correspond"
                  description="Modifie le filtre actif ou crée un premier dossier pour commencer."
                  action={
                    <Link
                      href="/dossiers/nouveau"
                      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "var(--blue-600)" }}
                    >
                      <FolderPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      Créer un dossier
                    </Link>
                  }
                />
              ) : view === "table" ? (
                <DataTable
                  rows={filtered}
                  columns={columns}
                  getRowKey={(p) => p.id}
                  emptyTitle="Aucun dossier"
                />
              ) : (
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((project) => (
                    <ProjectGridTile key={project.id} project={project} />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right rail */}
          <aside className="space-y-5">
            <RightRailCard
              title="Aperçu rapide"
              icon={Sparkles}
              iconTone="violet"
            >
              {projects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: "rgba(11,92,255,0.08)" }}
                  >
                    <FolderKanban
                      className="h-6 w-6"
                      style={{ color: "var(--blue-600)" }}
                      strokeWidth={1.5}
                    />
                  </span>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    Aucun dossier actif
                  </p>
                  <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                    Crée des dossiers/projets pour regrouper les documents liés à une même affaire.
                  </p>
                  <Link
                    href="/dossiers/nouveau"
                    className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90"
                    style={{ background: "var(--blue-600)" }}
                  >
                    <FolderPlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Créer un dossier
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Actifs</span>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      {activeProjects.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Urgents</span>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      {urgentProjects.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Terminés</span>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      {completedProjects.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Documents liés</span>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      {linkedDocumentCount}
                    </span>
                  </div>
                </div>
              )}
            </RightRailCard>

            <RightRailCard
              title="Échéances à venir"
              icon={CalendarClock}
              iconTone="amber"
              ctaHref="/dossiers"
              ctaLabel="Voir tous"
              bodyClassName="space-y-2"
            >
              {upcomingProjects.length === 0 ? (
                <p className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Aucune échéance planifiée.
                </p>
              ) : (
                upcomingProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dossiers/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                      {p.name}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(p.dueDate!)}
                    </span>
                  </Link>
                ))
              )}
            </RightRailCard>

            <RightRailCard
              title="Budget par dossier"
              icon={Wallet}
              iconTone="emerald"
              ctaHref="/budget"
              ctaLabel="Voir le détail"
            >
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Lie des dossiers à des documents financiers pour calculer un budget consolidé par
                affaire.
              </p>
              <Link
                href="/budget"
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition hover:bg-slate-50"
                style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "white" }}
              >
                Configurer le budget
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </RightRailCard>
          </aside>
        </div>
      </PageShell>
    );
  } catch (error) {
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { label: "Dossiers / Projets" },
          ]}
          title="Dossiers / Projets"
          description="Impossible de charger les dossiers/projets pour le moment."
        />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </PageShell>
    );
  }
}

import Link from "next/link";
import {
  ArrowDownToLine,
  CalendarClock,
  ExternalLink,
  FileText,
  FolderKanban,
  Pencil,
  Plus,
  Tags,
  Users,
} from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { FolderImportButton } from "@/components/projects/folder-import-button";
import { FolderDropZone } from "@/components/projects/folder-drop-zone";
import { ProjectDocumentPicker } from "@/components/projects/project-document-picker";
import { ProjectLinkedDocuments } from "@/components/projects/project-linked-documents";
import { ProjectPriorityBadge } from "@/components/projects/project-priority-badge";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import { formatDate, formatDateTime } from "@/lib/format";
import { isDocumentToProcess } from "@/lib/document-utils";
import {
  getCorrespondents,
  getDocument,
  getDocumentTypes,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";
import type { PaperlessDocument } from "@/lib/paperless-types";
import { getProjectFolder, listProjectFolders } from "@/lib/projects/project-store";
import { childrenOf, getProjectStats, indexFoldersById } from "@/lib/projects/project-utils";

export const dynamic = "force-dynamic";

type DossierDetailPageProps = {
  params: Promise<{ id: string }>;
};

function fulfilledDocuments(results: PromiseSettledResult<PaperlessDocument>[]) {
  return results
    .filter((result): result is PromiseFulfilledResult<PaperlessDocument> => result.status === "fulfilled")
    .map((result) => result.value);
}

export default async function DossierDetailPage({ params }: DossierDetailPageProps) {
  const { id } = await params;

  try {
    const project = await getProjectFolder(id);

    if (!project) {
      return (
        <main className="p-4 lg:p-8">
          <PageHeader
            eyebrow="Classement"
            title="Dossier introuvable"
            backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
          />
          <ErrorState
            title="Dossier/projet introuvable"
            message="Ce dossier n'existe pas dans la couche Gedify ou le stockage local a été réinitialisé."
            action={
              <Link
                href="/dossiers"
                className="inline-flex h-10 items-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                Voir les dossiers
              </Link>
            }
          />
        </main>
      );
    }

    const [correspondentsData, tagsData, typesData, documentResults, allFolders] = await Promise.all([
      getCorrespondents({ page_size: 1000 }),
      getTags({ page_size: 1000 }),
      getDocumentTypes({ page_size: 1000 }),
      Promise.allSettled(project.linkedDocumentIds.map((documentId) => getDocument(documentId))),
      listProjectFolders(),
    ]);

    // Fil d'Ariane (ancêtres) + sous-dossiers directs.
    const byId = indexFoldersById(allFolders);
    const crumbs: typeof allFolders = [];
    const seenCrumbs = new Set<string>();
    let walk: (typeof allFolders)[number] | undefined = project;
    while (walk && !seenCrumbs.has(walk.id)) {
      crumbs.unshift(walk);
      seenCrumbs.add(walk.id);
      walk = walk.parentId ? byId.get(walk.parentId) : undefined;
    }
    const subFolders = childrenOf(project.id, allFolders);

    const correspondents = correspondentsData.results ?? [];
    const tags = tagsData.results ?? [];
    const types = typesData.results ?? [];
    const linkedDocuments = fulfilledDocuments(documentResults);
    const linkedCorrespondents = correspondents.filter((item) =>
      project.linkedCorrespondentIds.includes(item.id)
    );
    const linkedTags = tags.filter((item) => project.linkedTagIds.includes(item.id));
    const stats = getProjectStats(project);
    const documentsToProcess = linkedDocuments.filter((document) => isDocumentToProcess(document, tags));
    const paperlessUrl = getPaperlessPublicUrl();
    const lastActivity = project.timeline[0]?.at ?? project.updatedAt;

    return (
      <main className="relative p-4 lg:p-8">
        <FolderDropZone folderId={project.id} folderName={project.name} />
        <PageHeader
          eyebrow="Dossiers / Projets"
          title={project.name}
          description={project.description || "Dossier de regroupement Gedify lié à vos documents Gedify."}
          backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
          actions={
            <>
              <Link
                href={`/dossiers/${project.id}/modifier`}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Modifier
              </Link>
              <Link
                href={`/dossiers/nouveau?parent=${project.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <FolderKanban className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Sous-dossier
              </Link>
              <FolderImportButton folderId={project.id} folderName={project.name} />
              <a
                href="#ajouter-documents"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Ajouter des documents
              </a>
              <ProjectArchiveButton projectId={project.id} />
              {paperlessUrl ? (
                <Link
                  href={paperlessUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Gedify
                </Link>
              ) : null}
            </>
          }
        />

        {/* Fil d'Ariane */}
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-[12.5px]" aria-label="Fil d'Ariane">
          <Link href="/organiser/dossiers" className="font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>Dossiers</Link>
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span style={{ color: "var(--text-hint)" }}>›</span>
              {c.id === project.id ? (
                <span className="font-bold" style={{ color: "var(--text-main)" }}>{c.name}</span>
              ) : (
                <Link href={`/dossiers/${c.id}`} className="font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>{c.name}</Link>
              )}
            </span>
          ))}
        </nav>

        <section className="mb-6 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.category}
            </span>
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              Échéance : {formatDate(project.dueDate)}
            </span>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Documents liés"
            value={stats.totalDocuments}
            helper="pièces dans ce dossier"
            icon={FileText}
            tone="blue"
          />
          <StatCard
            label="Correspondants"
            value={stats.totalCorrespondents}
            helper="acteurs associés"
            icon={Users}
            tone="emerald"
          />
          <StatCard
            label="Tags"
            value={stats.totalTags}
            helper="mots-clés Gedify liés"
            icon={Tags}
            tone="violet"
          />
          <StatCard
            label="Documents à traiter"
            value={documentsToProcess.length}
            helper="métadonnées incomplètes"
            icon={ArrowDownToLine}
            tone={documentsToProcess.length > 0 ? "amber" : "slate"}
          />
          <StatCard
            label="Échéance proche"
            value={stats.overdue ? "Dépassée" : stats.dueSoon ? "Oui" : "Non"}
            helper={`Dernière activité : ${formatDateTime(lastActivity)}`}
            icon={CalendarClock}
            tone={stats.overdue || stats.dueSoon ? "amber" : "slate"}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <SectionCard
              icon={FolderKanban}
              title="Résumé"
              description="Notes, progression et informations importantes du dossier."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {project.description || "Aucune description renseignée."}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Progression
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Statut {project.status.toLowerCase()}, priorité {project.priority.toLowerCase()}.
                    Dernière activité le {formatDateTime(lastActivity)}.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/80 p-4 md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {project.notes || "Aucune note renseignée."}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={FolderKanban}
              title="Sous-dossiers"
              description="Dossiers contenus directement dans ce dossier."
            >
              {subFolders.length === 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">Aucun sous-dossier pour l&apos;instant.</p>
                  <Link href={`/dossiers/nouveau?parent=${project.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-[13px] font-semibold text-white">
                    <Plus className="h-4 w-4" strokeWidth={1.75} /> Ajouter
                  </Link>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {subFolders.map((sf) => (
                    <Link key={sf.id} href={`/dossiers/${sf.id}`} className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-blue-300 hover:bg-blue-50/40">
                      <span className="h-7 w-7 shrink-0 rounded-lg" style={{ backgroundColor: sf.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold text-slate-900">{sf.name}</span>
                        <span className="block truncate text-[12px] text-slate-500">{sf.linkedDocumentIds.length} doc{sf.linkedDocumentIds.length > 1 ? "s" : ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={FileText}
              title="Documents liés"
              description="Documents Gedify regroupés dans ce dossier Gedify."
            >
              <ProjectLinkedDocuments
                projectId={project.id}
                documents={linkedDocuments}
                correspondents={correspondents}
                types={types}
                tags={tags}
                editable
              />
            </SectionCard>

            <SectionCard
              id="ajouter-documents"
              icon={Plus}
              title="Ajouter des documents"
              description="Recherchez dans la GED, filtrez, sélectionnez plusieurs documents puis ajoutez-les au dossier."
            >
              <ProjectDocumentPicker
                projectId={project.id}
                linkedDocumentIds={project.linkedDocumentIds}
                correspondents={correspondents}
                types={types}
                tags={tags}
              />
            </SectionCard>
          </div>

          <aside className="space-y-6">
            <SectionCard icon={Users} title="Correspondants liés">
              {linkedCorrespondents.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Aucun correspondant lié"
                  description="Associez des correspondants depuis le formulaire de modification."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {linkedCorrespondents.map((item) => (
                    <Link
                      key={item.id}
                      href={`/correspondants/${item.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-blue-700"
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="text-xs text-slate-400">{item.document_count ?? 0}</span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={Tags} title="Tags liés">
              {linkedTags.length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="Aucun tag lié"
                  description="Associez des tags Gedify au dossier pour renforcer le classement."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {linkedTags.map((tag) => (
                    <BadgeTag key={tag.id} tag={tag} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={CalendarClock} title="Timeline / activité du dossier">
              <ProjectTimeline events={project.timeline} />
            </SectionCard>
          </aside>
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title="Dossiers / Projets"
          backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
        />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}

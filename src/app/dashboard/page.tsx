import Link from "next/link";
import { CheckCircle2, FileText, FolderKanban, Inbox, Search, Sparkles, Upload } from "lucide-react";
import { DocumentPreview } from "@/components/ui/document-preview";
import { Button } from "@/components/ui/button";
import { CompactCard } from "@/components/ui/compact-card";
import { PinnedFoldersWidget } from "@/components/dashboard/pinned-folders-widget";
import { SavedViewsWidget } from "@/components/dashboard/saved-views-widget";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { ErrorState } from "@/components/ui/error-state";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageShell } from "@/components/ui/page-shell";
import { QuickAccessCard, QuickAccessGrid } from "@/components/ui/quick-access-card";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { isDocumentToProcess } from "@/lib/document-utils";
import { getTitleOverridesMap } from "@/lib/documents/document-title-store";
import { pickLatestAnalysis, resolveTitlesForDocuments } from "@/lib/documents/document-title-utils";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import {
  getDocuments,
  getPaperlessPublicUrl,
  getPaperlessStatus,
  getTags,
} from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";
import { getSetupSteps } from "@/lib/setup/setup-status";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const [documentsData, tagsData, status, projects, analyses, setupSteps] = await Promise.all([
      getDocuments({ page_size: 10, ordering: "-added" }),
      getTags(),
      getPaperlessStatus(),
      listProjectFolders(),
      listAnalyses(),
      getSetupSteps(),
    ]);

    const documents = documentsData.results ?? [];
    const tags = tagsData.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const toProcess = documents.filter((document) => isDocumentToProcess(document, tags));
    const activeProjects = projects.filter(
      (project) => project.status !== "Archivé" && project.status !== "Terminé"
    );

    const documentIds = documents.map((document) => Number(document.id));
    const titleOverrides = await getTitleOverridesMap(documentIds);
    const analysesByDocId = new Map(documentIds.map((id) => [id, pickLatestAnalysis(analyses, id)]));
    const titles = resolveTitlesForDocuments(documents, titleOverrides, analysesByDocId);
    const importantAnalyses = analyses.filter(
      (entry) => entry.status === "ready-to-validate" || entry.financialImpact.length > 0
    );

    return (
      <PageShell>
        <CompactPageHeader
          eyebrow="Accueil"
          title="Tableau de bord"
          description="L’essentiel pour démarrer : importer, traiter, chercher et valider."
          actions={
            <>
              <Button href="/import" variant="primary" size="md" icon={Upload}>
                Importer
              </Button>
              <Button href="/recherche" variant="secondary" size="md" icon={Search}>
                Rechercher
              </Button>
            </>
          }
        />

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <InfoMetric label="Documents" value={documentsData.count} helper="dans la GED" icon={FileText} tone="blue" />
          <InfoMetric label="À traiter" value={toProcess.length} helper="dans le lot récent" icon={Inbox} tone={toProcess.length > 0 ? "amber" : "green"} />
          <InfoMetric label="Analyses à valider" value={importantAnalyses.length} helper="IA et budget" icon={Sparkles} tone="violet" />
          <InfoMetric
            label="Gedify"
            value={status.connected ? "OK" : "Erreur"}
            helper={status.version ? `v${status.version}` : "connexion API"}
            icon={CheckCircle2}
            tone={status.connected ? "green" : "red"}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
          <div className="space-y-5">
            <CompactCard
              title="Documents récents"
              description="Ce qui vient d’arriver dans la GED."
              actions={<Link href="/documents" className="text-xs font-bold text-blue-700 hover:underline">Voir tous</Link>}
            >
              {documents.length === 0 ? (
                <CompactEmptyState
                  icon={Inbox}
                  title="Aucun document"
                  description="Importez un premier petit lot pour commencer."
                  action={<Button href="/import" variant="primary" size="sm">Importer</Button>}
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.slice(0, 6).map((document) => (
                    <Link
                      key={document.id}
                      href={`/documents/${document.id}`}
                      className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <DocumentPreview
                        documentId={document.id}
                        title={titles.get(Number(document.id))?.displayTitle}
                        fileName={document.original_file_name ?? document.filename}
                        mimeType={document.mime_type}
                        size="sm"
                        showBadge={false}
                        className="h-14 w-11"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-slate-950">
                          {titles.get(Number(document.id))?.displayTitle ?? document.title ?? `Document #${document.id}`}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {document.correspondent__name || "Correspondant à compléter"}
                          {document.document_type__name ? ` · ${document.document_type__name}` : ""}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-blue-700">Ouvrir</span>
                    </Link>
                  ))}
                </div>
              )}
            </CompactCard>

            <CompactCard title="Accès rapides" description="Les actions les plus utiles au démarrage.">
              <QuickAccessGrid>
                <QuickAccessCard href="/a-traiter" icon={Inbox} tone="amber" title="À traiter" description="Corriger les classements." />
                <QuickAccessCard href="/ia" icon={Sparkles} tone="violet" title="Analyser avec IA" description="Résumer et proposer." />
                <QuickAccessCard href="/dossiers" icon={FolderKanban} tone="blue" title="Dossiers / Projets" description="Regrouper par affaire." />
                <QuickAccessCard href="/messagerie/inbox" icon={Upload} tone="emerald" title="Mails" description="Connecter progressivement." />
              </QuickAccessGrid>
            </CompactCard>
          </div>

          <aside className="space-y-5">
            <CompactCard
              title="Dossiers / Projets épinglés"
              description="Vos dossiers épinglés depuis Organiser."
              actions={<Link href="/organiser/dossiers" className="text-xs font-bold text-blue-700 hover:underline">Organiser</Link>}
            >
              <PinnedFoldersWidget />
            </CompactCard>

            <CompactCard
              title="Vues enregistrées"
              description="Vos filtres Documents sauvegardés."
              actions={<Link href="/documents" className="text-xs font-bold text-blue-700 hover:underline">Documents</Link>}
            >
              <SavedViewsWidget />
            </CompactCard>

            <CompactCard
              title="Mise en place"
              description="Étapes restantes, sans bruit technique."
              actions={<Link href="/mise-en-place" className="text-xs font-bold text-blue-700 hover:underline">Voir</Link>}
            >
              <SetupChecklist steps={setupSteps} compact />
            </CompactCard>

            <CompactCard title="Alertes importantes">
              {toProcess.length === 0 && importantAnalyses.length === 0 ? (
                <CompactEmptyState title="Rien d’urgent" description="Aucun élément prioritaire dans le lot récent." />
              ) : (
                <div className="space-y-2 text-sm">
                  {toProcess.length > 0 ? (
                    <Link href="/a-traiter" className="block rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                      {toProcess.length} document(s) à classer
                    </Link>
                  ) : null}
                  {importantAnalyses.length > 0 ? (
                    <Link href="/ia/classement" className="block rounded-xl bg-violet-50 px-3 py-2 font-semibold text-violet-800">
                      {importantAnalyses.length} proposition(s) IA à valider
                    </Link>
                  ) : null}
                </div>
              )}
            </CompactCard>

            <CompactCard title="Dossiers actifs">
              {activeProjects.length === 0 ? (
                <CompactEmptyState title="Aucun dossier actif" action={<Button href="/dossiers/nouveau" variant="secondary" size="sm">Créer</Button>} />
              ) : (
                <div className="space-y-2">
                  {activeProjects.slice(0, 4).map((project) => (
                    <Link key={project.id} href={`/dossiers/${project.id}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      <span className="truncate">{project.name}</span>
                      <span className="text-xs text-slate-400">{project.linkedDocumentIds.length}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CompactCard>

            {paperlessUrl ? (
              <Link href={paperlessUrl} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-slate-500 hover:text-blue-700">
                Ouvrir Gedify original
              </Link>
            ) : null}
          </aside>
        </div>
      </PageShell>
    );
  } catch (error) {
    return (
      <PageShell>
        <CompactPageHeader title="Tableau de bord" description="Impossible de charger les données." />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </PageShell>
    );
  }
}

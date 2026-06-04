import {
  Clock,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Notebook,
  Pencil,
  Share2,
} from "lucide-react";
import { AnalyzeDocumentButton } from "@/components/ai/analyze-document-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FileTypeBadge } from "@/components/ui/file-type-badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TechnicalAccordion } from "@/components/ui/technical-accordion";
import { getNameById, getTagsForDocument, isDocumentToProcess } from "@/lib/document-utils";
import {
  getDocumentDisplayTitle,
  pickLatestAnalysis,
} from "@/lib/documents/document-title-utils";
import { getTitleOverride } from "@/lib/documents/document-title-store";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { bulkUpsertFromSynthesis } from "@/lib/ai/detected-info-store";
import { synthesizeDetectedInfos } from "@/lib/ai/detected-info-utils";
import { AIValidationPanel } from "@/components/ai/ai-validation-panel";
import { DetectedInfoEditableList } from "@/components/ai/detected-info-editable-list";
import { DocumentAiActions } from "@/components/documents/document-ai-actions";
import Link from "next/link";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";
import { DocumentTitleEditor } from "@/components/documents/document-title-editor";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { DocumentSendMailButton } from "@/components/documents/document-send-mail-button";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import { DocumentInfoCard } from "@/components/documents/document-info-card";
import { OcrViewerButton } from "@/components/documents/ocr-viewer-button";
import { DocumentOcrInfo } from "@/components/documents/document-ocr-info";
import { DocumentNotesEditor } from "@/components/documents/document-notes-editor";
import { DocumentLinkedActions } from "@/components/documents/document-linked-actions";
import { DocumentHistory } from "@/components/documents/document-history";
import { compactText, formatDate, formatDateTime } from "@/lib/format";
import {
  formatPaperlessValue,
  safePaperlessCollection,
  safePaperlessObject,
} from "@/lib/paperless-resources";
import {
  getCorrespondents,
  getDocument,
  getDocumentTypes,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";

export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
};

function TechnicalKeyValueList({ data }: { data: unknown }) {
  const entries: Array<[string, unknown]> =
    data && typeof data === "object" && !Array.isArray(data)
      ? Object.entries(data as Record<string, unknown>)
      : [["valeur", data]];

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-xl px-3 py-2"
          style={{ background: "rgba(11,92,255,0.04)", border: "1px solid var(--border)" }}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
            {key}
          </dt>
          <dd className="mt-1 break-words text-sm font-medium" style={{ color: "var(--text-main)" }}>
            {formatPaperlessValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function DocumentDetailPage({ params }: DocumentPageProps) {
  const { id } = await params;

  try {
    const docIdNum = Number.parseInt(id, 10);
    const [
      document,
      correspondentsData,
      typesData,
      tagsData,
      history,
      metadata,
      suggestions,
      override,
      analyses,
    ] = await Promise.all([
      getDocument(id),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
      safePaperlessCollection(`/api/documents/${id}/history/`),
      safePaperlessObject(`/api/documents/${id}/metadata/`),
      safePaperlessObject(`/api/documents/${id}/suggestions/`),
      Number.isFinite(docIdNum) ? getTitleOverride(docIdNum) : Promise.resolve(null),
      listAnalyses(),
    ]);
    const latestAnalysis = Number.isFinite(docIdNum)
      ? pickLatestAnalysis(analyses, docIdNum)
      : null;
    const resolvedTitle = getDocumentDisplayTitle({
      document,
      override,
      aiSuggestedTitle: latestAnalysis?.suggestedTitle ?? null,
      aiTitleConfidence: latestAnalysis?.titleConfidence ?? null,
    });

    const correspondents = correspondentsData.results ?? [];
    const documentTypes = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const documentTags = getTagsForDocument(tags, document);
    const paperlessUrl = getPaperlessPublicUrl();
    const correspondent =
      document.correspondent__name ?? getNameById(correspondents, document.correspondent);
    const documentType =
      document.document_type__name ?? getNameById(documentTypes, document.document_type);
    const paperlessDocumentUrl = paperlessUrl ? `${paperlessUrl}/documents/${document.id}` : null;
    const fileName =
      document.original_file_name ?? document.original_filename ?? document.filename;
    const mimeType = document.mime_type ?? null;
    const toProcess = isDocumentToProcess(document, tags);

    // Suggestions Gedify résolues (id → nom) pour les accordéons.
    const suggData =
      suggestions.ok && suggestions.data && typeof suggestions.data === "object" && !Array.isArray(suggestions.data)
        ? (suggestions.data as { correspondents?: number[]; tags?: number[]; document_types?: number[]; dates?: string[] })
        : null;
    const suggestionGroups = suggData
      ? {
          correspondents: (suggData.correspondents ?? []).map((i) => getNameById(correspondents, i)).filter((x): x is string => !!x),
          types: (suggData.document_types ?? []).map((i) => getNameById(documentTypes, i)).filter((x): x is string => !!x),
          tags: (suggData.tags ?? []).map((i) => tags.find((t) => t.id === i)?.name ?? null).filter((x): x is string => !!x),
          dates: (suggData.dates ?? []).map((d) => formatDate(d)),
        }
      : null;

    // Peuple le store « informations détectées » (édition/validation par champ)
    // pour que la zone « Analyse IA & validation » de la fiche ait des données.
    if (latestAnalysis) {
      await bulkUpsertFromSynthesis(synthesizeDetectedInfos(latestAnalysis)).catch(() => {});
    }

    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { href: "/documents", label: "Documents" },
            { label: resolvedTitle.displayTitle },
          ]}
          backLink={{ href: "/documents", label: "Retour aux documents" }}
          title={resolvedTitle.displayTitle}
          description={
            compactText(document.content, 200) || "Détail complet du document Gedify."
          }
          actions={
            <>
              <AnalyzeDocumentButton documentId={Number(document.id)} variant="compact" />
              <a
                href={`/api/paperless/documents/${document.id}/download`}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--blue-600)" }}
              >
                <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Télécharger
              </a>
              <DocumentSendMailButton documentId={Number(document.id)} title={resolvedTitle.displayTitle} />
              <SignDocumentButton documentId={Number(document.id)} title={resolvedTitle.displayTitle} mimeType={mimeType} variant="outline" />
              {paperlessDocumentUrl ? (
                <a
                  href={paperlessDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Gedify
                </a>
              ) : null}
            </>
          }
        />

        {/* Quick status banner */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <FileTypeBadge fileName={fileName} mimeType={mimeType} />
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {fileName ?? "Sans nom"}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              · {document.page_count ?? "—"} page(s)
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: "rgba(11,92,255,0.07)", color: "var(--blue-600)" }}
            >
              <Hash className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {document.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {toProcess ? (
              <StatusPill tone="amber" dot>
                À traiter
              </StatusPill>
            ) : (
              <StatusPill tone="emerald" dot>
                Validé
              </StatusPill>
            )}
            <a
              href={`/api/paperless/documents/${document.id}/preview`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              Aperçu
            </a>
            <button
              type="button"
              disabled
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Partager
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]">
          {/* Colonne centrale : lecteur PDF remonté + accordéons avancés */}
          <section className="space-y-5">
            <div className="rounded-[20px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
                  <FileText className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={2} aria-hidden="true" />
                  Document
                </h2>
                <OcrViewerButton content={document.content ?? null} />
              </div>
              <DocumentViewer
                documentId={document.id}
                documentTitle={document.title}
                mimeType={mimeType}
              />
            </div>

            {/* Avancé : données techniques + historique (collapsés par défaut) */}
            <div className="space-y-3">
              <TechnicalAccordion
                title="OCR et indexation"
                description="Moteur, langue, qualité du texte extrait — et relance OCR."
              >
                <DocumentOcrInfo documentId={document.id} />
              </TechnicalAccordion>

              <TechnicalAccordion
                title="Données techniques"
                description="Métadonnées brutes renvoyées par Gedify."
              >
                {metadata.ok ? (
                  <TechnicalKeyValueList data={metadata.data} />
                ) : (
                  <ErrorState title="Métadonnées indisponibles" message={metadata.error} />
                )}
              </TechnicalAccordion>

              <TechnicalAccordion
                title="Historique"
                description="Journal des modifications côté Gedify."
              >
                {!history.ok ? (
                  <ErrorState title="Historique indisponible" message={history.error} />
                ) : history.data.results.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="Aucun événement"
                    description="Gedify n'a pas renvoyé d'historique pour ce document."
                  />
                ) : (
                  <DocumentHistory entries={history.data.results} />
                )}
              </TechnicalAccordion>
            </div>
          </section>

          {/* Colonne droite : traitement, titre, classement + métadonnées, notes */}
          <aside className="space-y-5">
            <SectionCard
              icon={Loader2}
              title="Traitement du document"
              description="Statut en temps réel — OCR et analyse IA."
            >
              <DocumentProcessingProgress documentId={Number(document.id)} />
            </SectionCard>

            <SectionCard
              icon={FileText}
              title="Analyse IA & OCR"
              description="Analyse rapide (cloud), avancée, locale (Ollama), complétion, OCR et validation — directement ici."
            >
              <div className="space-y-4">
                <DocumentAiActions
                  documentId={Number(document.id)}
                  show={["analyse", "ocr"]}
                />

                {latestAnalysis ? (
                  <>
                    <AIValidationPanel analysis={latestAnalysis} />
                    <DetectedInfoEditableList documentId={Number(document.id)} analysisId={latestAnalysis.id} />
                  </>
                ) : (
                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "#FCFAF7" }}>
                    <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
                      Aucune analyse IA pour ce document.
                    </p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                      Lancez l&apos;analyse pour détecter le correspondant, le type, les dates, montants et tags proposés — puis validez-les ici.
                    </p>
                    <div className="mt-2">
                      <AnalyzeDocumentButton documentId={Number(document.id)} variant="compact" />
                    </div>
                  </div>
                )}

                <Link
                  href={`/ia/document/${document.id}`}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  Analyse IA avancée (données structurées, finances) →
                </Link>
              </div>
            </SectionCard>

            <RightRailCard title="Titre du document" icon={Pencil} iconTone="blue">
              <DocumentTitleEditor
                documentId={Number(document.id)}
                displayTitle={resolvedTitle.displayTitle}
                source={resolvedTitle.source}
                confidence={resolvedTitle.confidence}
                editedByUser={resolvedTitle.editedByUser}
                originalFilename={resolvedTitle.originalFilename}
                paperlessTitle={document.title ?? null}
                aiSuggestedTitle={latestAnalysis?.suggestedTitle ?? null}
              />
            </RightRailCard>

            <DocumentInfoCard
              document={document}
              correspondents={correspondents}
              documentTypes={documentTypes}
              tags={tags}
              correspondentName={correspondent ?? null}
              typeName={documentType ?? null}
              dateCreated={formatDate(document.created)}
              dateAdded={formatDateTime(document.added)}
              asn={document.archive_serial_number ? String(document.archive_serial_number) : null}
              pages={document.page_count ?? null}
              statusLabel={toProcess ? "À traiter" : "Validé"}
              statusTone={toProcess ? "amber" : "emerald"}
              documentTags={documentTags.map((t) => ({ id: t.id, name: t.name, color: t.color, text_color: t.text_color }))}
              suggestions={suggestionGroups}
            />

            <DocumentLinkedActions documentId={Number(document.id)} />

            <RightRailCard title="Notes" icon={Notebook} iconTone="violet">
              <DocumentNotesEditor documentId={Number(document.id)} />
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
            { href: "/documents", label: "Documents" },
            { label: `Document #${id}` },
          ]}
          backLink={{ href: "/documents", label: "Retour aux documents" }}
          title="Document introuvable"
          description="Impossible de charger le détail depuis Gedify."
        />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </PageShell>
    );
  }
}

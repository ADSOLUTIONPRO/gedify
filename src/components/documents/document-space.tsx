"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDetailPanel } from "@/components/layout/responsive-detail-panel";
import { DocumentBulkActions } from "@/components/documents/document-bulk-actions";
import { DocumentBulkEditPanel } from "@/components/documents/document-bulk-edit-panel";
import { DocumentAddToFolderPanel } from "@/components/documents/document-add-to-folder-panel";
import { DocumentEmptyState } from "@/components/documents/document-empty-state";
import { DocumentFilters, type DocumentFilterValues } from "@/components/documents/document-filters";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentPreviewPanel } from "@/components/documents/document-preview-panel";
import { DocumentSpaceCard } from "@/components/documents/document-space-card";
import type { DocActionHandlers } from "@/components/documents/document-action-menu";
import { DocumentLightbox } from "@/components/documents/document-lightbox";
import { DocumentAiSheet } from "@/components/documents/document-ai-sheet";
import { DocumentAiResultDialog } from "@/components/documents/document-ai-result-dialog";
import { BulkAnalyzeDialog } from "@/components/documents/bulk-analyze-dialog";
import type { DocumentVM } from "@/components/documents/types";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { GedifyProgressModal } from "@/components/ui/gedify-progress-modal";
import { useGedifyProgress } from "@/lib/hooks/use-gedify-progress";
import { setAssistantOverrides, clearAssistantOverrides } from "@/components/ai-assistant/assistant-context-provider";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { fetchCurrentUser } from "@/lib/documents/document-quick-edit";
import { ANALYSIS_ACTIONS, logAiAction, runAiAction, type AiActionId, type AiActionResult } from "@/lib/documents/document-ai";
import { CheckSquare, Sparkles, Square } from "lucide-react";

type Option = { id: number | string; name: string };

type DocumentSpaceProps = {
  docs: DocumentVM[];
  /** Nombre total de documents de la collection (tous les pages confondues). */
  totalCount: number;
  /** Query des filtres pour /api/documents/ids (sélection de la TOTALITÉ). */
  selectAllQuery?: string;
  view: "grid" | "table";
  filterValues: DocumentFilterValues;
  correspondents: Option[];
  types: Option[];
  tags: Option[];
  hidden: Record<string, string>;
  resetHref: string;
  footer?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  showImport: boolean;
  paperlessUrl: string | null;
  /** Cible des filtres (défaut /documents). Permet de rester dans un dossier. */
  basePath?: string;
};

/**
 * Attend la fin du job miniature d'un document (poll de /jobs) pour rafraîchir
 * la vignette au bon moment. Renvoie l'issue ; n'échoue jamais (timeout borné).
 */
async function pollThumbnailJob(docId: number, jobId: string | null, timeoutMs = 30000): Promise<"done" | "failed" | "timeout"> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await fetch(`/api/documents/${docId}/jobs`, { credentials: "include", cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { jobs?: { id: string; type: string; status: string }[] };
      const job = (data.jobs ?? []).find((j) => (jobId ? j.id === jobId : j.type === "thumbnail"));
      if (job) {
        if (job.status === "done" || job.status === "skipped") return "done";
        if (job.status === "failed") return "failed";
      } else if (jobId) {
        return "done"; // job purgé de la liste → considéré terminé
      }
    } catch {
      /* on continue à poller */
    }
  }
  return "timeout";
}

export function DocumentSpace({
  docs,
  totalCount,
  selectAllQuery,
  view,
  filterValues,
  correspondents,
  types,
  tags,
  hidden,
  resetHref,
  footer,
  emptyTitle,
  emptyDescription,
  showImport,
  paperlessUrl,
  basePath,
}: DocumentSpaceProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Sélection de la TOTALITÉ (tous les documents du filtre, pas juste la page).
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  // Modale de progression commune (miniature/OCR/IA groupés).
  const progress = useGedifyProgress();
  // Cache-bust par document : bumpé après régénération de miniature pour forcer
  // le rechargement immédiat de la vignette (sans recharger la page).
  const [thumbBust, setThumbBust] = useState<Record<number, number>>({});
  // Ancre pour la sélection par plage (Maj + clic sur une case).
  const lastIndexRef = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(docs[0]?.id ?? null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showAddToFolder, setShowAddToFolder] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentVM | null>(null);
  const [aiSheetDoc, setAiSheetDoc] = useState<DocumentVM | null>(null);
  const [aiBusyId, setAiBusyId] = useState<number | null>(null);
  const [confirmReanalyzeDoc, setConfirmReanalyzeDoc] = useState<DocumentVM | null>(null);
  const [aiUser, setAiUser] = useState<string | null>(null);
  // Popup de progression/résultat d'analyse (lancée depuis une vignette).
  const [aiDialogDoc, setAiDialogDoc] = useState<DocumentVM | null>(null);
  const [aiDialogLoading, setAiDialogLoading] = useState(false);
  const [aiDialogResult, setAiDialogResult] = useState<AiActionResult | null>(null);
  // Suppression d'un document depuis le menu « … » de la vignette.
  const [docToDelete, setDocToDelete] = useState<DocumentVM | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  // Analyse IA groupée.
  const [bulkDocs, setBulkDocs] = useState<{ id: number; title: string }[] | null>(null);
  // Action document unitaire (menu « … ») ciblant les panneaux groupés sur un seul doc.
  const [singleActionDoc, setSingleActionDoc] = useState<DocumentVM | null>(null);

  useEffect(() => {
    void Promise.resolve().then(async () => setAiUser(await fetchCurrentUser()));
  }, []);

  // Expose la sélection / le document actif à l'assistant IA contextuel.
  useEffect(() => {
    setAssistantOverrides({ selectedDocumentIds: [...selectedIds], activeDocumentId: activeId });
    return () => clearAssistantOverrides();
  }, [selectedIds, activeId]);

  async function runAi(doc: DocumentVM, action: AiActionId) {
    if (aiBusyId) return;
    const isAnalysis = ANALYSIS_ACTIONS.includes(action);
    setAiBusyId(doc.id);
    if (isAnalysis) { setAiDialogDoc(doc); setAiDialogResult(null); setAiDialogLoading(true); }
    const res = await runAiAction(doc.id, action);
    await logAiAction(doc.id, action, res.ok, aiUser);
    setAiBusyId(null);
    if (isAnalysis) {
      setAiDialogResult(res);
      setAiDialogLoading(false);
    } else {
      setToast(res.message);
      window.setTimeout(() => setToast(null), 4000);
    }
    if (res.ok) router.refresh();
  }

  async function deleteSingle() {
    if (!docToDelete) return;
    setDeletingSingle(true);
    await fetch(`/api/paperless/documents/${docToDelete.id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    setDeletingSingle(false);
    setDocToDelete(null);
    router.refresh();
  }

  function openBulkAnalyze() {
    const targets = selectedIds.size > 0 ? docs.filter((d) => selectedIds.has(d.id)) : docs;
    setBulkDocs(targets.map((d) => ({ id: d.id, title: d.displayTitle })));
  }

  function handleAiAction(doc: DocumentVM, action: AiActionId) {
    // Confirmation avant ré-analyse si une analyse existe déjà.
    if (action === "reanalyser" && doc.ai) { setConfirmReanalyzeDoc(doc); return; }
    void runAi(doc, action);
  }

  const activeDoc = useMemo(() => docs.find((d) => d.id === activeId) ?? null, [docs, activeId]);
  const selectedDocs = useMemo(() => docs.filter((d) => selectedIds.has(d.id)), [docs, selectedIds]);

  function toggle(id: number, shift = false) {
    const idx = docs.findIndex((d) => d.id === id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shift && lastIndexRef.current != null && idx >= 0) {
        // Maj + clic : sélectionne toute la plage entre l'ancre et la case cliquée.
        const a = Math.min(lastIndexRef.current, idx);
        const b = Math.max(lastIndexRef.current, idx);
        for (let i = a; i <= b; i++) next.add(docs[i].id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!shift && idx >= 0) lastIndexRef.current = idx;
  }
  function toggleAll() {
    if (allMatchingSelected || selectedIds.size === docs.length) {
      setSelectedIds(new Set());
      setAllMatchingSelected(false);
    } else {
      setAllMatchingSelected(false);
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  }
  function clearSelection() { setSelectedIds(new Set()); setAllMatchingSelected(false); lastIndexRef.current = null; }

  /** Sélectionne TOUS les documents du filtre courant (toutes pages). */
  async function selectAllMatching() {
    if (!selectAllQuery || selectingAll) return;
    setSelectingAll(true);
    try {
      const res = await fetch(`/api/documents/ids?${selectAllQuery}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { ids?: number[] };
      if (Array.isArray(data.ids)) {
        setSelectedIds(new Set(data.ids));
        setAllMatchingSelected(true);
      }
    } finally {
      setSelectingAll(false);
    }
  }

  const primary = selectedDocs[0] ?? activeDoc;
  const allSelected = docs.length > 0 && selectedIds.size === docs.length;
  // Peut-on proposer la sélection de la totalité ? (page entière sélectionnée +
  // plus de documents que la page + endpoint dispo + pas déjà tout sélectionné)
  const canSelectAllMatching =
    Boolean(selectAllQuery) && allSelected && !allMatchingSelected && totalCount > docs.length;

  function downloadSelection() {
    // Utilise la sélection complète (inclut la « totalité » sélectionnée hors page).
    const ids = [...selectedIds];
    if (ids.length === 0) {
      if (activeDoc) window.open(activeDoc.downloadUrl, "_blank", "noopener");
      return;
    }
    if (ids.length === 1) {
      const d = docs.find((x) => x.id === ids[0]) ?? activeDoc;
      if (d) window.open(d.downloadUrl, "_blank", "noopener");
      return;
    }
    // Plusieurs documents → archive ZIP.
    window.location.href = `/api/documents/download-zip?ids=${ids.join(",")}`;
  }

  function sendByMail() {
    const targets = selectedDocs.length > 0 ? selectedDocs : activeDoc ? [activeDoc] : [];
    if (targets.length === 0) return;
    openComposer({
      subject: targets.length === 1 ? `Document : ${targets[0].displayTitle}` : `${targets.length} documents joints`,
      attachments: targets.map((d) => ({ documentId: d.id, name: d.displayTitle })),
    });
  }

  // Action groupée longue pilotée par la modale de progression commune
  // (GedifyProgressModal). Pour la miniature : attend la fin du job puis
  // cache-bust la vignette → rafraîchissement immédiat. Erreurs → GedifyErrorHint.
  const runBulkProgress = async (opts: {
    title: string;
    errorCode: string;
    makeUrls: (id: number) => string[];
    pollThumbnail?: boolean;
  }) => {
    const targets = selectedDocs.length > 0 ? selectedDocs : activeDoc ? [activeDoc] : [];
    if (targets.length === 0) return;
    progress.setRetry(() => void runBulkProgress(opts));
    progress.start({ title: opts.title, total: targets.length });
    for (const doc of targets) {
      progress.setStep(`Document #${doc.id} — ${doc.displayTitle}`);
      let ok = true;
      let lastErr = "";
      for (const url of opts.makeUrls(doc.id)) {
        const isPreview = opts.pollThumbnail && url.includes("regenerate-preview");
        try {
          const res = await fetch(url, { method: "POST", credentials: "include" });
          if (isPreview) continue; // aperçu : best-effort, ne fait pas échouer le doc
          if (!res.ok) { ok = false; lastErr = `HTTP ${res.status}`; continue; }
          if (opts.pollThumbnail && url.includes("regenerate-thumbnail")) {
            const data = (await res.json().catch(() => ({}))) as { jobId?: string | null };
            const outcome = await pollThumbnailJob(doc.id, data.jobId ?? null);
            if (outcome === "failed") { ok = false; lastErr = "Job miniature en échec"; }
          }
        } catch (e) {
          if (isPreview) continue;
          ok = false;
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (opts.pollThumbnail) setThumbBust((prev) => ({ ...prev, [doc.id]: Date.now() }));
      if (ok) progress.bumpSucceeded();
      else progress.bumpFailed(lastErr, opts.errorCode);
    }
    progress.finish();
    router.refresh();
  };

  const reanalyzeSelection = () =>
    runBulkProgress({ title: "Analyse IA", errorCode: "ai_failed", makeUrls: (id) => [`/api/documents/${id}/reanalyze`] });
  const redoOcrSelection = () =>
    runBulkProgress({ title: "Relancer l'OCR", errorCode: "ocr_failed", makeUrls: (id) => [`/api/documents/${id}/redo-ocr`] });
  const regenerateThumbnailSelection = () =>
    runBulkProgress({
      title: "Régénération miniature + aperçu",
      errorCode: "thumbnail_generation_failed",
      pollThumbnail: true,
      makeUrls: (id) => [`/api/documents/${id}/regenerate-thumbnail`, `/api/documents/${id}/regenerate-preview`],
    });

  async function deleteSelection() {
    setDeleting(true);
    const targets = selectedDocs.length > 0 ? selectedDocs : activeDoc ? [activeDoc] : [];
    for (const doc of targets) {
      await fetch(`/api/paperless/documents/${doc.id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
    }
    setDeleting(false);
    setConfirmDelete(false);
    clearSelection();
    router.refresh();
  }

  // Jeu d'actions document unique, partagé carte / ligne / sidebar.
  const docActions: DocActionHandlers = {
    onView: (d) => router.push(d.detailHref),
    onAi: handleAiAction,
    onFicheIA: (d) => setAiSheetDoc(d),
    onEdit: (d) => { setSingleActionDoc(d); setShowBulkEdit(true); },
    onAddToFolder: (d) => { setSingleActionDoc(d); setShowAddToFolder(true); },
    onSendMail: (d) => openComposer({ subject: `Document : ${d.displayTitle}`, attachments: [{ documentId: d.id, name: d.displayTitle }] }),
    onDownload: (d) => window.open(d.downloadUrl, "_blank", "noopener"),
    onArchive: (d) => router.push(d.detailHref),
    onDelete: (d) => setDocToDelete(d),
  };

  // Vignettes avec cache-bust appliqué (après régénération) — n'affecte QUE l'URL
  // d'image affichée, jamais la logique de sélection (qui reste sur `docs`).
  const displayDocs = useMemo(
    () =>
      docs.map((d) =>
        thumbBust[d.id]
          ? { ...d, thumbUrl: `${d.thumbUrl}${d.thumbUrl.includes("?") ? "&" : "?"}v=${thumbBust[d.id]}` }
          : d,
      ),
    [docs, thumbBust],
  );

  const cards = (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
      {displayDocs.map((doc) => (
        <DocumentSpaceCard
          key={doc.id}
          doc={doc}
          checked={selectedIds.has(doc.id)}
          active={doc.id === activeId}
          onToggle={toggle}
          onActivate={setActiveId}
          onPreview={setPreviewDoc}
          actions={docActions}
          aiBusy={aiBusyId === doc.id}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="flex gap-6">
        {/* Colonne gauche : filtres + actions + liste (le panneau détail démarre tout en haut) */}
        <div className="min-w-0 flex-1 space-y-4">
          <DocumentFilters
            values={filterValues}
            correspondents={correspondents}
            types={types}
            tags={tags}
            hidden={hidden}
            resetHref={resetHref}
            basePath={basePath}
          />

          {docs.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleAll}
                  title="Tout sélectionner — astuce : Maj + clic sur une case pour sélectionner une plage"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold transition hover:bg-[var(--bg-card-soft)]"
                  style={{ borderColor: "var(--border-strong)", color: "var(--gedify-navy)" }}
                >
                  {allSelected || allMatchingSelected ? <CheckSquare className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> : <Square className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                  {allSelected || allMatchingSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  {selectedIds.size > 0 ? (
                    <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{selectedIds.size}</span>
                  ) : null}
                </button>
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  {totalCount.toLocaleString("fr-FR")} document{totalCount > 1 ? "s" : ""}
                </span>
                {canSelectAllMatching ? (
                  <button
                    type="button"
                    onClick={() => void selectAllMatching()}
                    disabled={selectingAll}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                    style={{ background: "var(--accent)" }}
                  >
                    {selectingAll ? "Sélection…" : `Sélectionner les ${totalCount.toLocaleString("fr-FR")} documents`}
                  </button>
                ) : allMatchingSelected ? (
                  <span
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    Toute la liste sélectionnée ({totalCount.toLocaleString("fr-FR")})
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={openBulkAnalyze}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {selectedIds.size > 0 ? `Analyser la sélection (${selectedIds.size})` : "Tout analyser avec IA"}
              </button>
            </div>
          ) : null}

          <DocumentBulkActions
            count={selectedIds.size}
            onClear={clearSelection}
            onDownload={downloadSelection}
            onEdit={() => setShowBulkEdit(true)}
            onAddToFolder={() => setShowAddToFolder(true)}
            onSendByMail={sendByMail}
            onArchive={() => primary && router.push(primary.detailHref)}
            onReanalyze={() => void reanalyzeSelection()}
            onRedoOcr={() => void redoOcrSelection()}
            onRegenerateThumbnail={() => void regenerateThumbnailSelection()}
            onOpenFirst={() => primary && router.push(primary.detailHref)}
            onDelete={() => setConfirmDelete(true)}
            paperlessUrl={paperlessUrl}
            firstDocId={primary?.id ?? null}
          />

          <div className="overflow-hidden rounded-2xl bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
            {docs.length === 0 ? (
              <DocumentEmptyState title={emptyTitle} description={emptyDescription} showImport={showImport} />
            ) : view === "grid" ? (
              <div className="p-3">{cards}</div>
            ) : (
              <>
                <div className="hidden md:block">
                  <DocumentList
                    docs={displayDocs}
                    selectedIds={selectedIds}
                    activeId={activeId}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                    onActivate={setActiveId}
                    actions={docActions}
                    aiBusyId={aiBusyId}
                  />
                </div>
                <div className="p-3 md:hidden">{cards}</div>
              </>
            )}
          </div>
          {footer}
        </div>

        {docs.length > 0 ? (
          <ResponsiveDetailPanel title="Détail" fill>
            <DocumentPreviewPanel doc={activeDoc} />
          </ResponsiveDetailPanel>
        ) : null}
      </div>

      {/* Panneau d'édition groupée */}
      {showBulkEdit && (
        <DocumentBulkEditPanel
          selectedDocs={singleActionDoc ? [singleActionDoc] : selectedDocs.length > 0 ? selectedDocs : activeDoc ? [activeDoc] : []}
          correspondents={correspondents}
          types={types}
          tags={tags}
          onClose={() => { setShowBulkEdit(false); setSingleActionDoc(null); }}
          onSuccess={() => {
            setShowBulkEdit(false);
            setSingleActionDoc(null);
            clearSelection();
            router.refresh();
          }}
        />
      )}

      {/* Ajouter à un dossier / projet */}
      {showAddToFolder && (
        <DocumentAddToFolderPanel
          documentIds={(singleActionDoc ? [singleActionDoc] : selectedDocs.length > 0 ? selectedDocs : activeDoc ? [activeDoc] : []).map((d) => d.id)}
          onClose={() => { setShowAddToFolder(false); setSingleActionDoc(null); }}
          onSuccess={(linkedCount, folderName) => {
            setShowAddToFolder(false);
            setSingleActionDoc(null);
            clearSelection();
            setToast(`${linkedCount} document${linkedCount > 1 ? "s" : ""} ajouté${linkedCount > 1 ? "s" : ""} à « ${folderName} »`);
            window.setTimeout(() => setToast(null), 4000);
            router.refresh();
          }}
        />
      )}

      {/* Toast de confirmation */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl"
          style={{ background: "var(--blue-600)" }}
          role="status"
        >
          {toast}
        </div>
      )}

      {/* Lightbox d'aperçu (clic loupe sur une vignette) */}
      {previewDoc ? <DocumentLightbox doc={previewDoc} onClose={() => setPreviewDoc(null)} /> : null}

      {/* Fiche IA (popup) déclenchée depuis une carte */}
      {aiSheetDoc ? (
        <DocumentAiSheet
          doc={aiSheetDoc}
          onClose={() => setAiSheetDoc(null)}
          onApplied={() => router.refresh()}
        />
      ) : null}

      {/* Confirmation de ré-analyse depuis une carte */}
      <ConfirmActionDialog
        isOpen={confirmReanalyzeDoc !== null}
        onClose={() => setConfirmReanalyzeDoc(null)}
        onConfirm={() => { const d = confirmReanalyzeDoc; setConfirmReanalyzeDoc(null); if (d) void runAi(d, "reanalyser"); }}
        variant="warning"
        title="Ré-analyser ce document ?"
        description="Une analyse existe déjà. La nouvelle sera enregistrée (les précédentes restent dans l'historique)."
        confirmLabel="Ré-analyser"
      />

      {/* Confirmation suppression (sélection groupée) */}
      <ConfirmActionDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deleteSelection()}
        variant="delete"
        title={`Supprimer ${selectedDocs.length || 1} document(s) ?`}
        description="Cette action enverra les documents dans la corbeille Gedify et supprimera toutes les données GED associées."
        confirmLabel="Supprimer"
        loading={deleting}
      />

      {/* Confirmation suppression (un document depuis le menu « … ») */}
      <ConfirmActionDialog
        isOpen={docToDelete !== null}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => void deleteSingle()}
        variant="delete"
        title="Voulez-vous vraiment supprimer ce document ?"
        description="Cette action déplacera le document dans la corbeille et supprimera les données liées (analyses IA, budget non validé, rappels). Si le document provient d'un mail, sa pièce jointe ne sera plus réimportée automatiquement."
        confirmLabel="Supprimer"
        loading={deletingSingle}
      />

      {/* Popup progression / résultat d'analyse depuis une vignette */}
      <DocumentAiResultDialog
        open={aiDialogDoc !== null}
        loading={aiDialogLoading}
        docId={aiDialogDoc?.id ?? 0}
        result={aiDialogResult}
        onClose={() => setAiDialogDoc(null)}
        onOpenSheet={() => { const d = aiDialogDoc; setAiDialogDoc(null); if (d) setAiSheetDoc(d); }}
      />

      {/* Analyse IA groupée */}
      {bulkDocs ? (
        <BulkAnalyzeDialog
          docs={bulkDocs}
          onClose={() => setBulkDocs(null)}
          onDone={() => router.refresh()}
        />
      ) : null}

      {/* Progression commune (miniature / OCR / IA groupés) */}
      <GedifyProgressModal data={progress.data} onClose={progress.close} onRetry={progress.retry} />
    </>
  );
}

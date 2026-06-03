"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileSearch, Trash2, XCircle } from "lucide-react";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import { AIWarningsPanel } from "@/components/ai/ai-warnings-panel";
import { BulkActionsToolbar } from "@/components/common/bulk-actions-toolbar";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import type { AIAnalysisWarning, AIOriginalSuggestion, AIRuleMatch } from "@/lib/ai/types";

type BucketKey = "all" | "needs_review" | "ready" | "validated" | "rejected" | "applied";

const BUCKET_LABELS: Record<BucketKey, string> = {
  all: "Toutes",
  needs_review: "À contrôler",
  ready: "Prêt à valider",
  validated: "Validées",
  rejected: "Rejetées",
  applied: "Appliquées",
};

const BUCKET_TONES: Record<BucketKey, "amber" | "emerald" | "violet" | "rose" | "blue"> = {
  all: "blue",
  needs_review: "amber",
  ready: "blue",
  validated: "emerald",
  applied: "violet",
  rejected: "rose",
};

type AnalysisVM = {
  id: string;
  documentId: number;
  bucket: BucketKey;
  suggestedTitle: string | null | undefined;
  detectedDocumentKind: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  suggestedCorrespondentName: string | null | undefined;
  suggestedDocumentTypeName: string | null | undefined;
  suggestedTagNames: string[];
  financialImpactCount: number;
  warnings: AIAnalysisWarning[];
  autoApplyEligible: boolean | null | undefined;
  blockedAutoApplyReason: string | null | undefined;
  ruleMatches: AIRuleMatch[] | null | undefined;
  originalSuggestion: AIOriginalSuggestion | null | undefined;
};

type Props = {
  analyses: AnalysisVM[];
};

export function IaAnalysisListClient({ analyses }: Props) {
  const router = useRouter();
  const bulk = useBulkSelect(analyses, (a) => a.id);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function bulkDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      const ids = [...bulk.selectedIds] as string[];
      const res = await fetch("/api/ai/analyses/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || "error" in data) throw new Error(data.error ?? `HTTP ${res.status}`);
      bulk.clearAll();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function bulkReject() {
    setRejecting(true);
    setActionError(null);
    try {
      const ids = [...bulk.selectedIds] as string[];
      await Promise.all(
        ids.map((id) =>
          fetch("/api/ai/reject-suggestion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ analysisId: id }),
          }),
        ),
      );
      bulk.clearAll();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors du rejet");
    } finally {
      setRejecting(false);
      setConfirmReject(false);
    }
  }

  if (analyses.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Aucune analyse"
        description="Ouvre un document depuis /documents puis clique sur « Analyser avec IA » pour générer une suggestion."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barre actions groupées */}
      <BulkActionsToolbar
        bulk={bulk}
        entityLabel="analyse"
        actions={[
          {
            label: deleting ? "Suppression…" : "Supprimer",
            icon: Trash2,
            tone: "danger",
            loading: deleting,
            onClick: () => setConfirmDelete(true),
          },
          {
            label: rejecting ? "Rejet…" : "Rejeter",
            icon: XCircle,
            tone: "warning",
            loading: rejecting,
            onClick: () => setConfirmReject(true),
          },
        ]}
      />

      {actionError && (
        <p className="px-1 text-[12.5px] font-semibold text-rose-700">{actionError}</p>
      )}

      {/* Liste */}
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
        {/* En-tête avec "tout sélectionner" */}
        <div
          className="flex items-center gap-3 border-b px-5 py-2.5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <input
            type="checkbox"
            checked={bulk.isAllSelected}
            onChange={() => bulk.toggleAll()}
            aria-label="Tout sélectionner"
            className="h-4 w-4 rounded"
          />
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {bulk.isNoneSelected
              ? `${analyses.length} analyse(s)`
              : `${bulk.selectedCount} / ${analyses.length} sélectionné(s)`}
          </span>
        </div>

        <ul>
          {analyses.map((analysis, index) => {
            const tone = BUCKET_TONES[analysis.bucket];
            const isSelected = bulk.isSelected(analysis.id);
            return (
              <li
                key={analysis.id}
                className="flex items-start gap-4 px-5 py-4"
                style={{
                  borderBottom: index !== analyses.length - 1 ? "1px solid var(--border)" : undefined,
                  background: isSelected ? "rgba(11,92,255,0.04)" : undefined,
                }}
              >
                {/* Checkbox */}
                <span className="mt-1 shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => bulk.toggle(analysis.id)}
                    aria-label={`Sélectionner ${analysis.suggestedTitle ?? `Document #${analysis.documentId}`}`}
                    className="h-4 w-4 rounded"
                  />
                </span>

                {/* Icône */}
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(11,92,255,0.06)", color: "var(--blue-600)" }}
                >
                  <FileSearch className="h-5 w-5" strokeWidth={1.75} />
                </span>

                {/* Contenu */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ia/document/${analysis.documentId}`}
                      className="text-sm font-bold transition hover:opacity-80"
                      style={{ color: "var(--text-main)" }}
                    >
                      {analysis.suggestedTitle ??
                        `${analysis.detectedDocumentKind} · Document #${analysis.documentId}`}
                    </Link>
                    <StatusPill tone={tone} dot>
                      {BUCKET_LABELS[analysis.bucket]}
                    </StatusPill>
                    <AIConfidenceBadge confidence={analysis.confidence} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {analysis.summary}
                  </p>
                  {(Array.isArray(analysis.warnings) && analysis.warnings.length > 0) ||
                  analysis.autoApplyEligible === false ? (
                    <div className="mt-2">
                      <AIWarningsPanel
                        compact
                        warnings={analysis.warnings}
                        autoApplyEligible={analysis.autoApplyEligible ?? undefined}
                        blockedReason={analysis.blockedAutoApplyReason ?? undefined}
                        ruleMatches={analysis.ruleMatches ?? undefined}
                        originalSuggestion={analysis.originalSuggestion ?? undefined}
                        currentCorrespondent={analysis.suggestedCorrespondentName ?? undefined}
                      />
                    </div>
                  ) : null}
                  <div
                    className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {analysis.suggestedCorrespondentName ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold"
                        style={{ background: "rgba(11,92,255,0.06)", color: "var(--blue-600)" }}
                      >
                        {analysis.suggestedCorrespondentName}
                      </span>
                    ) : null}
                    {analysis.suggestedDocumentTypeName ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold"
                        style={{ background: "rgba(16,163,74,0.08)", color: "#16A34A" }}
                      >
                        {analysis.suggestedDocumentTypeName}
                      </span>
                    ) : null}
                    {analysis.suggestedTagNames.length > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold"
                        style={{ background: "rgba(124,58,237,0.08)", color: "#7C3AED" }}
                      >
                        {analysis.suggestedTagNames.slice(0, 3).join(", ")}
                        {analysis.suggestedTagNames.length > 3
                          ? ` +${analysis.suggestedTagNames.length - 3}`
                          : ""}
                      </span>
                    ) : null}
                    {analysis.financialImpactCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold"
                        style={{ background: "rgba(245,158,11,0.10)", color: "#B45309" }}
                      >
                        {analysis.financialImpactCount} impact(s) budget
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/ia/document/${analysis.documentId}`}
                  className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ background: "var(--blue-600)" }}
                >
                  Fiche IA
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Modales de confirmation */}
      <ConfirmActionDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void bulkDelete()}
        variant="delete"
        title={`Supprimer ${bulk.selectedCount} analyse(s) ?`}
        description="Les analyses sélectionnées et leurs données détectées associées seront supprimées définitivement. Les documents Gedify ne sont pas touchés."
        confirmLabel="Supprimer"
        loading={deleting}
      />

      <ConfirmActionDialog
        isOpen={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => void bulkReject()}
        variant="reject"
        title={`Rejeter ${bulk.selectedCount} analyse(s) ?`}
        description="Les analyses sélectionnées seront marquées comme rejetées."
        confirmLabel="Rejeter"
        loading={rejecting}
      />
    </div>
  );
}

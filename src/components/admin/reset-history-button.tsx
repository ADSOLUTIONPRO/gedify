"use client";

import { useState } from "react";
import { Loader2, TriangleAlert, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type ResetResult = {
  ok: true;
  deleted: {
    aiAnalyses: number;
    detectedInfos: number;
    entitySuggestions: number;
    correctionMemory: number;
    budgetDrafts: number;
    actionDrafts: number;
    logs: number;
    mockData: number;
  };
  preserved: {
    paperlessDocuments: true;
    paperlessTaxonomies: true;
    settings: true;
    users: true;
  };
};

export function ResetHistoryButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runReset() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          confirm: "RESET_GED_HISTORY",
          scope: "internal-history-only",
        }),
      });
      const data = (await res.json()) as ResetResult | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      }
      setResult(data as ResetResult);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const totalDeleted = result
    ? Object.values(result.deleted).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Cette action supprime uniquement l&apos;historique interne de Gedify : analyses IA,
        suggestions, infos détectées, mémoire de corrections et brouillons non validés. Les
        documents Gedify, fichiers PDF, tags, correspondants et types existants ne seront
        pas supprimés.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-rose-50"
          style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Vider l&apos;historique interne
        </button>

        {result ? (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ Historique vidé — {totalDeleted} entrée(s) supprimée(s)
          </p>
        ) : null}

        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {error}
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>
            Supprimé
          </p>
          <ul className="grid gap-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <li>Analyses IA : <strong>{result.deleted.aiAnalyses}</strong></li>
            <li>Infos détectées : <strong>{result.deleted.detectedInfos}</strong></li>
            <li>Mémoire de corrections : <strong>{result.deleted.correctionMemory}</strong></li>
            <li>Brouillons budget : <strong>{result.deleted.budgetDrafts}</strong></li>
            <li>Actions / rappels IA : <strong>{result.deleted.actionDrafts}</strong></li>
          </ul>
          <p className="mt-3 mb-1 text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>
            Conservé
          </p>
          <ul className="grid gap-1 text-[12px]" style={{ color: "#16A34A" }}>
            <li>✓ Documents Gedify</li>
            <li>✓ Tags, correspondants et types Gedify</li>
            <li>✓ Paramètres et configuration</li>
            <li>✓ Utilisateurs</li>
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Suppression de l&apos;historique en cours…
        </p>
      ) : null}

      <ConfirmActionDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={runReset}
        variant="delete"
        title="Vider l'historique interne GED ?"
        description="Cette action supprimera toutes les analyses IA, infos détectées, suggestions, mémoire de corrections et brouillons non validés. Les documents Gedify, PDF, tags, correspondants et types ne seront pas touchés. Irréversible."
        confirmLabel="Vider l'historique"
        requireTextConfirmation
        itemName="RESET_GED_HISTORY"
        loading={loading}
      />
    </div>
  );
}

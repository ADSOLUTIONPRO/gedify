"use client";

import { useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type CleanupResult = {
  ok: true;
  deleted: {
    detectedInfos: number;
    aiAnalyses: number;
    financialItems: number;
    actions: number;
    reminders: number;
  };
  checkedDocumentIds: number;
};

export function OrphanCleanupButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCleanup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cleanup/orphan-ai-data", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as CleanupResult | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      }
      setResult(data as CleanupResult);
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-rose-50"
          style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Nettoyer les données orphelines
        </button>

        {result ? (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ Nettoyage terminé — {totalDeleted} entrée(s) supprimée(s) sur{" "}
            {result.checkedDocumentIds} documents vérifiés
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
        <ul className="grid gap-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <li>Infos détectées : <strong>{result.deleted.detectedInfos}</strong></li>
          <li>Analyses IA : <strong>{result.deleted.aiAnalyses}</strong></li>
          <li>Lignes budget : <strong>{result.deleted.financialItems}</strong></li>
          <li>Actions : <strong>{result.deleted.actions}</strong></li>
          <li>Rappels : <strong>{result.deleted.reminders}</strong></li>
        </ul>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse des données en cours…
        </p>
      ) : null}

      <ConfirmActionDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={runCleanup}
        variant="warning"
        title="Nettoyer les données orphelines ?"
        description="Cette action supprimera les données IA (analyses, infos détectées, lignes budget non validées, actions IA non terminées, rappels) qui ne sont plus reliées à aucun document Gedify existant. Les éléments validés manuellement ne sont pas supprimés."
        confirmLabel="Lancer le nettoyage"
        loading={loading}
      />
    </div>
  );
}

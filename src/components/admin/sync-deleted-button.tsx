"use client";

import { useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";

type SyncResult = {
  ok: true;
  checkedDocumentIds: number;
  deletedInPaperless: number[];
  cleaned: {
    aiAnalyses: number;
    detectedInfos: number;
    financialItemsDeleted: number;
    financialItemsDetached: number;
    actionsDeleted: number;
    actionsDetached: number;
    remindersDeleted: number;
    remindersDetached: number;
  };
};

export function SyncDeletedButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sync-deleted-documents", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as SyncResult | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data as SyncResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Vérifie quels documents présents dans la surcouche n&apos;existent plus dans la GED
        et supprime leurs données locales (analyses IA, lignes financières, actions, rappels).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          )}
          Synchroniser les suppressions
        </button>

        {result && result.deletedInPaperless.length === 0 && (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ Aucun document manquant détecté ({result.checkedDocumentIds} vérifiés)
          </p>
        )}

        {result && result.deletedInPaperless.length > 0 && (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ {result.deletedInPaperless.length} document(s) manquant(s) nettoyés
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {result && result.deletedInPaperless.length > 0 && (
        <ul className="grid gap-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <li>Analyses IA supprimées : <strong>{result.cleaned.aiAnalyses}</strong></li>
          <li>Infos détectées : <strong>{result.cleaned.detectedInfos}</strong></li>
          <li>Lignes budget supprimées : <strong>{result.cleaned.financialItemsDeleted}</strong></li>
          <li>Lignes budget détachées : <strong>{result.cleaned.financialItemsDetached}</strong></li>
          <li>Actions supprimées : <strong>{result.cleaned.actionsDeleted}</strong></li>
          <li>Rappels supprimés : <strong>{result.cleaned.remindersDeleted}</strong></li>
        </ul>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Vérification des documents Gedify en cours…
        </p>
      )}
    </div>
  );
}

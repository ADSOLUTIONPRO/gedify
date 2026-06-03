"use client";

import { useState } from "react";
import { Loader2, Tag, TriangleAlert } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type CleanupResult = { ok: true; tagsFound: number; documentsCleaned: number; message?: string };

/**
 * Maintenance : retire le tag « Permis de conduire » appliqué à tort en masse
 * (auto-matching Gedify) et désactive sa repose automatique.
 */
export function PermisTagCleanupButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCleanup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cleanup/permis-tag", { method: "POST", credentials: "include", cache: "no-store" });
      const data = (await res.json()) as CleanupResult | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data as CleanupResult);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-amber-50"
          style={{ borderColor: "#FDE68A", color: "#B45309" }}
        >
          <Tag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Nettoyer le tag « Permis de conduire »
        </button>

        {result ? (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ {result.tagsFound > 0 ? `${result.documentsCleaned} document(s) nettoyé(s) · auto-matching désactivé` : (result.message ?? "Rien à nettoyer")}
          </p>
        ) : null}

        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {error}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Retrait du tag en cours…
        </p>
      ) : null}

      <ConfirmActionDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={runCleanup}
        variant="warning"
        title="Nettoyer le tag « Permis de conduire » ?"
        description="Le tag sera retiré de tous les documents qui le portent et son auto-matching Gedify sera désactivé (il ne sera plus reposé automatiquement). Les documents réellement liés à un permis de conduire devront être re-taggés manuellement."
        confirmLabel="Nettoyer"
        loading={loading}
      />
    </div>
  );
}

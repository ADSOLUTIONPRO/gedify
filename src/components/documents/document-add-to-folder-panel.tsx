"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FolderPlus, Loader2, Search, TriangleAlert, X } from "lucide-react";
import type { ProjectFolder } from "@/lib/projects/project-types";

type Props = {
  documentIds: number[];
  onClose: () => void;
  onSuccess: (linkedCount: number, folderName: string) => void;
};

/**
 * Modale d'action groupée : rattache les documents sélectionnés à un
 * dossier/projet existant via POST /api/projects/{id}/documents/link.
 */
export function DocumentAddToFolderPanel({ documentIds, onClose, onSuccess }: Props) {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "linking" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const count = documentIds.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects", { credentials: "include" });
        const data = (await res.json()) as { results?: ProjectFolder[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (!cancelled) setFolders(data.results ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les dossiers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(q) || folder.category.toLowerCase().includes(q),
    );
  }, [folders, query]);

  const selectedFolder = folders.find((folder) => folder.id === selectedId) ?? null;

  async function link() {
    if (!selectedFolder) return;
    setStatus("linking");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${selectedFolder.id}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentIds }),
      });
      const data = (await res.json()) as { error?: string; details?: string };
      if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`);
      setStatus("success");
      setTimeout(() => onSuccess(count, selectedFolder.name), 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>
              Ajouter à un dossier
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {count} document{count > 1 ? "s" : ""} à rattacher
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {status === "success" ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" strokeWidth={1.5} />
              <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                {count} document{count > 1 ? "s" : ""} ajouté{count > 1 ? "s" : ""} à « {selectedFolder?.name} »
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden="true" />
            </div>
          ) : folders.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
                Aucun dossier/projet pour l&apos;instant.
              </p>
              <Link
                href="/dossiers/nouveau"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white"
                style={{ background: "var(--blue-600)" }}
              >
                <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
                Créer un dossier
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--text-hint)" }}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un dossier…"
                  className="h-10 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                />
              </div>

              <ul className="space-y-1.5">
                {filtered.map((folder) => {
                  const isSelected = folder.id === selectedId;
                  return (
                    <li key={folder.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(folder.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          isSelected
                            ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <span
                          className="h-7 w-7 shrink-0 rounded-lg"
                          style={{ backgroundColor: folder.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold text-slate-900">
                            {folder.name}
                          </span>
                          <span className="block truncate text-[12px] text-slate-500">
                            {folder.category} · {folder.status} · {folder.linkedDocumentIds.length} doc
                            {folder.linkedDocumentIds.length > 1 ? "s" : ""}
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-[12.5px] font-medium text-slate-500">
                    Aucun dossier ne correspond à « {query} ».
                  </li>
                ) : null}
              </ul>

              {error ? (
                <p className="flex items-center gap-1.5 text-[12.5px] text-rose-700">
                  <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {status !== "success" && folders.length > 0 ? (
          <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectedFolder || status === "linking"}
              onClick={() => void link()}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--blue-600)" }}
            >
              {status === "linking" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <FolderPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              Ajouter à ce dossier ({count})
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

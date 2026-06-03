"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FolderPlus, Loader2, Search, TriangleAlert, X } from "lucide-react";
import type { ProjectFolder } from "@/lib/projects/project-types";

type Props = {
  /** Threads à classer (ids Gmail). */
  threadIds: string[];
  onClose: () => void;
  onSuccess: (count: number, folderName: string) => void;
};

/**
 * Classe un ou plusieurs mails dans la GED en les liant à un dossier/projet
 * (`POST /api/messaging/links`, target `project`). Même UX que pour les documents.
 */
export function MailClassifyPanel({ threadIds, onClose, onSuccess }: Props) {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "linking" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const count = threadIds.length;

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
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  }, [folders, query]);

  const selectedFolder = folders.find((f) => f.id === selectedId) ?? null;

  async function link() {
    if (!selectedFolder) return;
    setStatus("linking");
    setError(null);
    try {
      const res = await fetch("/api/messaging/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          emailIds: threadIds,
          scope: "thread",
          target: { kind: "project", projectId: selectedFolder.id, projectName: selectedFolder.name },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus("success");
      setTimeout(() => onSuccess(count, selectedFolder.name), 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 mx-4 flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh", overflow: "hidden" }}>
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Classer dans un dossier</h2>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {count} mail{count > 1 ? "s" : ""} à rattacher
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {status === "success" ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" strokeWidth={1.5} />
              <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                {count} mail{count > 1 ? "s" : ""} classé{count > 1 ? "s" : ""} dans « {selectedFolder?.name} »
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden="true" />
            </div>
          ) : folders.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Aucun dossier/projet pour l&apos;instant.</p>
              <Link href="/dossiers/nouveau" className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}>
                <FolderPlus className="h-4 w-4" strokeWidth={1.75} />Créer un dossier
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un dossier…" className="h-10 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
              </div>
              <ul className="space-y-1.5">
                {filtered.map((folder) => {
                  const isSelected = folder.id === selectedId;
                  return (
                    <li key={folder.id}>
                      <button type="button" onClick={() => setSelectedId(folder.id)} className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition" style={{ borderColor: isSelected ? "var(--accent)" : "var(--border)", background: isSelected ? "var(--accent-soft)" : "#fff" }}>
                        <span className="h-7 w-7 shrink-0 rounded-lg" style={{ backgroundColor: folder.color }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>{folder.name}</span>
                          <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{folder.category} · {folder.status}</span>
                        </span>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: isSelected ? "var(--accent)" : "#CBD5E1", background: isSelected ? "var(--accent)" : "#fff" }} aria-hidden="true">
                          {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 ? <li className="rounded-xl border border-dashed px-3 py-4 text-center text-[12.5px] font-medium text-slate-500" style={{ borderColor: "var(--border)" }}>Aucun dossier ne correspond à « {query} ».</li> : null}
              </ul>
              {error ? <p className="flex items-center gap-1.5 text-[12.5px] text-rose-700"><TriangleAlert className="h-4 w-4 shrink-0" /> {error}</p> : null}
            </div>
          )}
        </div>

        {status !== "success" && folders.length > 0 ? (
          <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={onClose} className="rounded-[20px] border-[1.5px] px-4 py-2 text-[13px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
            <button type="button" disabled={!selectedFolder || status === "linking"} onClick={() => void link()} className="inline-flex items-center gap-1.5 rounded-[20px] px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {status === "linking" ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" /> : <FolderPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
              Classer ({count})
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

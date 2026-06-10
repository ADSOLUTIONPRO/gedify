"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Link2, Loader2, Plus, X } from "lucide-react";
import { AssistantDocumentPicker } from "@/components/ai-assistant/assistant-document-picker";

type LinkedDoc = { id: number; title: string };

/**
 * Bloc « Documents liés » : liste les documents rattachés au document courant,
 * permet d'en lier un (sélecteur de recherche) ou d'en détacher. Réutilisé dans
 * l'aperçu (sidebar), la Fiche Doc et la page du document. Relation symétrique
 * (/api/documents/:id/links).
 */
export function DocumentLinks({ documentId }: { documentId: number }) {
  const [docs, setDocs] = useState<LinkedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/links`, { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { ids?: number[] };
      const ids = data.ids ?? [];
      if (ids.length === 0) { setDocs([]); return; }
      const params = new URLSearchParams({ id__in: ids.join(","), page_size: String(Math.min(ids.length, 60)) });
      const dRes = await fetch(`/api/paperless/documents?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const dData = (await dRes.json()) as { results?: { id: number; title?: string }[] };
      const byId = new Map((dData.results ?? []).map((d) => [Number(d.id), d.title || `Document ${d.id}`]));
      setDocs(ids.map((id) => ({ id, title: byId.get(id) ?? `Document ${id}` })));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function linkDoc(targetId: number) {
    setPicker(false);
    if (targetId === documentId) return;
    setBusyId(targetId);
    try {
      await fetch(`/api/documents/${documentId}/links`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ targetId }),
      });
      await load();
    } finally { setBusyId(null); }
  }

  async function unlink(targetId: number) {
    setBusyId(targetId);
    try {
      await fetch(`/api/documents/${documentId}/links?targetId=${targetId}`, { method: "DELETE", credentials: "include" });
      setDocs((prev) => prev.filter((d) => d.id !== targetId));
    } finally { setBusyId(null); }
  }

  return (
    <section className="rounded-2xl bg-white p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Link2 className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
        </span>
        <h3 className="text-[13.5px] font-extrabold" style={{ color: "var(--text-main)" }}>Documents liés</h3>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[12px] font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Lier
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : docs.length === 0 ? (
        <p className="py-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun document lié. Cliquez sur « Lier » pour rattacher un document.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--bg-card-soft)" }}>
              <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
              <Link href={`/documents/${d.id}`} className="min-w-0 flex-1 truncate text-[12.5px] font-semibold transition hover:underline" style={{ color: "var(--gedify-navy)" }} title={d.title}>
                {d.title}
              </Link>
              <button
                type="button"
                onClick={() => void unlink(d.id)}
                disabled={busyId === d.id}
                aria-label="Détacher"
                title="Détacher"
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-white disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
              >
                {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {picker ? <AssistantDocumentPicker onPick={(id) => void linkDoc(id)} onClose={() => setPicker(false)} /> : null}
    </section>
  );
}

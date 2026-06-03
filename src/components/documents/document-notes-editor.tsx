"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Nature = "appel" | "rdv" | "autre";
type Note = {
  id: string;
  documentId: number;
  content: string;
  nature: Nature;
  noteDate: string;
  author: string | null;
};

const NATURE_META: Record<Nature, { label: string; bg: string; color: string }> = {
  appel: { label: "Appel", bg: "#ECF3FF", color: "#2563EB" },
  rdv: { label: "RDV", bg: "#F2ECFF", color: "#7C3AED" },
  autre: { label: "Autre", bg: "#F4F6F8", color: "#475569" },
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDateTimeLocal(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Notes GED enrichies (nature Appel/RDV/Autre + date éditable + auteur).
 * Récupère ses données via `/api/documents/[id]/notes`. Réutilisé dans la
 * sidebar d'aperçu et dans la page détail `/documents/[id]`.
 */
export function DocumentNotesEditor({ documentId }: { documentId: number }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftNature, setDraftNature] = useState<Nature>("autre");
  const [draftDate, setDraftDate] = useState(() => toDateTimeLocal(new Date().toISOString()));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editNature, setEditNature] = useState<Nature>("autre");
  const [editDate, setEditDate] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const base = `/api/documents/${documentId}/notes`;

  useEffect(() => {
    let cancelled = false;
    fetch(base, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d: { notes?: Note[] }) => {
        if (!cancelled) setNotes(d.notes ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function add() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, nature: draftNature, noteDate: fromDateTimeLocal(draftDate) }),
      });
      if (!res.ok) throw new Error();
      const { note } = (await res.json()) as { note: Note };
      setNotes((prev) => [note, ...prev].sort((a, b) => b.noteDate.localeCompare(a.noteDate)));
      setDraft("");
      setDraftNature("autre");
      setDraftDate(toDateTimeLocal(new Date().toISOString()));
      setAdding(false);
    } catch {
      setError("Ajout impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const content = editContent.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, nature: editNature, noteDate: fromDateTimeLocal(editDate) }),
      });
      if (!res.ok) throw new Error();
      const { note } = (await res.json()) as { note: Note };
      setNotes((prev) => prev.map((n) => (n.id === id ? note : n)).sort((a, b) => b.noteDate.localeCompare(a.noteDate)));
      setEditingId(null);
    } catch {
      setError("Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmId(null);
    } catch {
      setError("Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Votre note…"
            className="w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={draftNature}
              onChange={(e) => setDraftNature(e.target.value as Nature)}
              className="h-8 rounded-lg border px-2 text-[12px] outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="appel">Appel</option>
              <option value="rdv">RDV</option>
              <option value="autre">Autre</option>
            </select>
            <input
              type="datetime-local"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="h-8 rounded-lg border px-2 text-[12px] outline-none"
              style={{ borderColor: "var(--border)" }}
            />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => { setAdding(false); setDraft(""); }} className="inline-flex h-8 items-center rounded-[20px] border-[1.5px] px-3 text-[12px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>
                Annuler
              </button>
              <button type="button" onClick={() => void add()} disabled={busy || !draft.trim()} className="inline-flex h-8 items-center gap-1 rounded-[20px] px-3.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[12.5px] font-bold transition hover:bg-[#FCFAF7]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Ajouter une note
        </button>
      )}

      {error ? <p className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Chargement…
        </p>
      ) : notes.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune note pour ce document.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => {
            const meta = NATURE_META[note.nature] ?? NATURE_META.autre;
            return (
              <li key={note.id} className="rounded-xl p-3" style={{ background: "rgba(31,41,55,0.03)", border: "1px solid var(--border)" }}>
                {editingId === note.id ? (
                  <>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select value={editNature} onChange={(e) => setEditNature(e.target.value as Nature)} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }}>
                        <option value="appel">Appel</option>
                        <option value="rdv">RDV</option>
                        <option value="autre">Autre</option>
                      </select>
                      <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }} />
                      <div className="ml-auto flex items-center gap-2">
                        <button type="button" onClick={() => setEditingId(null)} className="inline-flex h-7 items-center rounded-[20px] border-[1.5px] px-2.5 text-[11.5px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
                        <button type="button" onClick={() => void saveEdit(note.id)} disabled={busy || !editContent.trim()} className="inline-flex h-7 items-center rounded-[20px] px-3 text-[11.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Enregistrer</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-hint)" }}>
                        {note.noteDate ? formatDateTime(note.noteDate) : ""}{note.author ? ` · ${note.author}` : ""}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-6" style={{ color: "var(--text-main)" }}>{note.content}</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {confirmId === note.id ? (
                        <span className="flex items-center gap-1.5 text-[11.5px]">
                          <span style={{ color: "var(--text-muted)" }}>Supprimer ?</span>
                          <button type="button" onClick={() => void remove(note.id)} disabled={busy} className="font-bold" style={{ color: "var(--danger)" }}>Oui</button>
                          <button type="button" onClick={() => setConfirmId(null)} className="font-bold" style={{ color: "var(--text-muted)" }}>Non</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <button type="button" onClick={() => { setEditingId(note.id); setEditContent(note.content); setEditNature(note.nature); setEditDate(toDateTimeLocal(note.noteDate)); }} aria-label="Modifier" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700">
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                          <button type="button" onClick={() => setConfirmId(note.id)} aria-label="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--text-hint)" }}>
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Note = { id: number; note: string; created: string };

function normalize(data: unknown, fallback: Note[]): Note[] {
  if (!Array.isArray(data)) return fallback;
  return (data as Note[])
    .filter((n) => n && typeof n.note === "string")
    .slice()
    .sort((a, b) => (b.created > a.created ? 1 : -1));
}

/**
 * Notes du document : liste triée (récent en premier), ajout, modification
 * (Gedify n'a pas d'édition native → suppression + recréation) et
 * suppression avec confirmation. Endpoint `/api/paperless/documents/[id]/notes`.
 */
export function DocumentNotes({ documentId, initialNotes }: { documentId: number; initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(() => normalize(initialNotes, initialNotes));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/paperless/documents/${documentId}/notes`;

  async function add() {
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: value }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes((prev) => normalize(data, prev));
      setDraft("");
      setAdding(false);
    } catch {
      setError("Ajout impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(noteId: number) {
    const value = editDraft.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fetch(`${base}?id=${noteId}`, { method: "DELETE" });
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: value }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes((prev) => normalize(data, prev));
      setEditingId(null);
    } catch {
      setError("Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}?id=${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes((prev) => normalize(data, prev.filter((n) => n.id !== noteId)));
      setConfirmId(null);
    } catch {
      setError("Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Ajouter une note */}
      {adding ? (
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Votre note..."
            className="w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft(""); }} className="inline-flex h-8 items-center rounded-[20px] border-[1.5px] px-3 text-[12px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>
              Annuler
            </button>
            <button type="button" onClick={() => void add()} disabled={busy || !draft.trim()} className="inline-flex h-8 items-center gap-1 rounded-[20px] px-3.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Enregistrer
            </button>
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

      {/* Liste */}
      {notes.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune note pour ce document.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl p-3" style={{ background: "rgba(31,41,55,0.03)", border: "1px solid var(--border)" }}>
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="inline-flex h-7 items-center rounded-[20px] border-[1.5px] px-2.5 text-[11.5px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
                    <button type="button" onClick={() => void saveEdit(note.id)} disabled={busy || !editDraft.trim()} className="inline-flex h-7 items-center rounded-[20px] px-3 text-[11.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Enregistrer</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[13px] leading-6" style={{ color: "var(--text-main)" }}>{note.note}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-hint)" }}>
                      {note.created ? formatDateTime(note.created) : ""}
                    </span>
                    {confirmId === note.id ? (
                      <span className="flex items-center gap-1.5 text-[11.5px]">
                        <span style={{ color: "var(--text-muted)" }}>Supprimer ?</span>
                        <button type="button" onClick={() => void remove(note.id)} disabled={busy} className="font-bold" style={{ color: "var(--danger)" }}>Oui</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="font-bold" style={{ color: "var(--text-muted)" }}>Non</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => { setEditingId(note.id); setEditDraft(note.note); }} aria-label="Modifier" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700">
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                        <button type="button" onClick={() => setConfirmId(note.id)} aria-label="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white" style={{ color: "var(--text-hint)" }}>
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
